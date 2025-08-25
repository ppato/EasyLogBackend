// controllers/log.controller.js
const Log     = require('../models/log.model');
const Usage   = require('../models/usage.model');
const Company = require('../models/company.model');
const Plan    = require('../models/plan.model');

function yyyymm(d = new Date()) {
  return d.toISOString().slice(0, 7).replace('-', ''); // "YYYYMM"
}

/**
 * Consume cupo mensual usando $inc atómico.
 * Maneja la carrera del primer upsert (E11000) con retry sin upsert.
 * @returns {Promise<object|null>} Documento de Usage actualizado, o null si no hay cupo.
 */
async function consumeMonthlyQuota({ companyId, limit, incBy }) {
  const period = yyyymm();

  // 1er intento: con upsert (crea doc si no existe)
  try {
    const doc = await Usage.findOneAndUpdate(
      { companyId, period, logsIngested: { $lte: limit - incBy } },
      {
        $setOnInsert: { companyId, period }, // <— SIN logsIngested aquí
        $inc: { logsIngested: incBy },       // <— $inc crea/incrementa
        $set: { updatedAt: new Date() }
      },
      { upsert: true, new: true }
    );
    return doc; // puede ser null si no matcheó condición
  } catch (e) {
    if (e?.code !== 11000) throw e; // otro request creó el doc primero
  }

  // 2do intento: sin upsert (el doc ya existe)
  const doc2 = await Usage.findOneAndUpdate(
    { companyId, period, logsIngested: { $lte: limit - incBy } },
    { $inc: { logsIngested: incBy }, $set: { updatedAt: new Date() } },
    { new: true }
  );
  return doc2; // null => sin cupo
}

// ===================== POST /api/logs =====================
// Guarda log aplicando hard-limit por plan.
// Soporta dos flujos de auth:
//  - Ingesta (middleware ingestAuth):   req.companyId  (preferido)
//  - App/usuario (middleware verifyToken): req.user?.companyId
exports.createLog = async (req, res) => {
  // companyId confiable (prioriza ingestAuth)
  const companyKey = req.companyId || req.user?.companyId;

  if (!companyKey || typeof companyKey !== 'string') {
    return res.status(400).json({ message: 'Missing companyId in token' });
  }

  // userId: si viene de verifyToken úsalo; si no, admite el que venga en el body como metadato
  const userId = req.user?.id || req.body?.userId || null;

  try {
    // 1) Obtener límite mensual desde Company.plan (o 'free') → Plan.monthlyLogLimit
    const company = await Company.findOne({ companyId: companyKey }).lean().catch(() => null);
    const planCode = company?.plan || 'free';
    const plan = await Plan.findOne({ code: planCode }).lean().catch(() => null);
    const limit = (company?.overrideMonthlyLogLimit ?? plan?.monthlyLogLimit) ?? 1000;

    // 2) Consumir cupo con $inc ATÓMICO (con retry anti-duplicado)
    const period = yyyymm();
    const incBy = 1; // este endpoint inserta 1 log por request

    const usageDoc = await consumeMonthlyQuota({
      companyId: companyKey,
      limit,
      incBy
    });

    if (!usageDoc) {
      // Sin cupo → 429 con info útil
      const cur = await Usage.findOne({ companyId: companyKey, period }).lean();
      const used = cur?.logsIngested ?? 0;
      return res.status(429).json({
        error: 'limit_exceeded',
        message: `Cupo mensual (${limit.toLocaleString()}) alcanzado para ${period}.`,
        period,
        used,
        limit,
        remaining: Math.max(limit - used, 0)
      });
    }

    // 3) Construir el log
    const { level, service, app, message, url, context, timestamp } = req.body;

    // Validaciones mínimas (puedes endurecer si quieres)
    if (!level || !message) {
      // Rollback del cupo por payload inválido
      await Usage.updateOne(
        { companyId: companyKey, period },
        { $inc: { logsIngested: -1 }, $set: { updatedAt: new Date() } }
      ).catch(() => {});
      return res.status(400).json({ message: 'level y message son requeridos' });
    }

    let ts = timestamp ? new Date(timestamp) : new Date();
    if (isNaN(ts.getTime())) ts = new Date();

    const log = new Log({
      level,
      service,
      app,
      message,
      url,
      context,
      timestamp: ts,
      userId,
      // ⚠️ Ignora cualquier companyId del body y fuerza el del token
      companyId: companyKey
    });

    try {
      await log.save();
      return res.status(201).json({ message: 'Log saved', log });
    } catch (saveErr) {
      // 4) Rollback del cupo si falló el insert del log
      await Usage.updateOne(
        { companyId: companyKey, period },
        { $inc: { logsIngested: -1 }, $set: { updatedAt: new Date() } }
      ).catch(() => {});
      throw saveErr;
    }
  } catch (err) {
    console.error('Error al guardar log:', err);
    return res.status(500).json({ message: 'Error saving log' });
  }
};

// ===================== GET /api/logs =====================
exports.getLogs = async (req, res) => {
  try {
    const companyKey = req.user?.companyId;
    if (!companyKey) return res.status(401).json({ message: 'Unauthorized' });

    const logs = await Log.find({ companyId: companyKey })
      .sort({ timestamp: -1 })
      .limit(1000);
    return res.json(logs);
  } catch (err) {
    console.error('Error al obtener logs:', err);
    return res.status(500).json({ message: 'Error retrieving logs' });
  }
};

// ===================== GET /api/logs/levels =====================
exports.getLogLevels = async (req, res) => {
  try {
    const companyKey = req.user?.companyId;
    if (!companyKey) return res.status(401).json({ message: 'Unauthorized' });

    const levels = await Log.distinct('level', { companyId: companyKey });
    return res.json(levels);
  } catch (err) {
    console.error('Error al obtener niveles:', err);
    return res.status(500).json({ message: 'Error al obtener niveles de criticidad' });
  }
};

// ===================== GET /api/service-status =====================
exports.getServiceStatus = async (req, res) => {
  try {
    const companyKey = req.user?.companyId;
    if (!companyKey) return res.status(401).json({ message: 'Unauthorized' });

    const logs = await Log.find({ companyId: companyKey }).sort({ timestamp: -1 });

    const servicioMap = new Map();
    for (const log of logs) {
      const key = `${log.app}|${log.service}`;
      if (!servicioMap.has(key)) {
        servicioMap.set(key, {
          app: log.app,
          service: log.service,
          url: log.url,
          message: log.message,
          level: log.level,
          timestamp: log.timestamp
        });
      }
    }

    const estados = Array.from(servicioMap.values());
    const summary = {
      total: estados.length,
      critical: estados.filter(s => s.level === 'critical').length,
      warning: estados.filter(s => s.level === 'warning').length,
      info: estados.filter(s => s.level === 'info').length
    };

    return res.json({ summary, alerts: estados });
  } catch (err) {
    console.error('Error en /api/service-status:', err);
    return res.status(500).json({ message: 'Error obteniendo estado de servicios' });
  }
};
