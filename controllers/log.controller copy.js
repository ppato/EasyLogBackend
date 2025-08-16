const Log = require('../models/log.model');

// POST /api/logs → guardar log con companyId y userId
exports.createLog = async (req, res) => {
  try {
    const { id: userId, companyId } = req.user;

    const {
      level,
      service,
      app,
      message,
      url,
      context,
      timestamp
    } = req.body;

    const log = new Log({
      level,
      service,
      app,
      message,
      url,
      context,
      timestamp: timestamp || new Date().toISOString(),
      userId,
      companyId
    });

    await log.save();
    res.status(201).json({ message: 'Log saved', log });
  } catch (err) {
    console.error('Error al guardar log:', err);
    res.status(500).json({ message: 'Error saving log' });
  }
};

// GET /api/logs → traer solo logs de la empresa
exports.getLogs = async (req, res) => {
  try {
    const { companyId } = req.user;

    const logs = await Log.find({ companyId }).sort({ timestamp: -1 }).limit(1000);
    res.json(logs);
  } catch (err) {
    console.error('Error al obtener logs:', err);
    res.status(500).json({ message: 'Error retrieving logs' });
  }
};

// GET /api/logs/levels → obtener niveles de criticidad únicos por empresa
exports.getLogLevels = async (req, res) => {
  try {
    const { companyId } = req.user;
    const levels = await Log.distinct('level', { companyId });

    res.json(levels);
  } catch (err) {
    console.error('Error al obtener niveles:', err);
    res.status(500).json({ message: 'Error al obtener niveles de criticidad' });
  }
};

// GET /api/service-status → estado por servicio/app
exports.getServiceStatus = async (req, res) => {
  try {
    const { companyId } = req.user;

    const logs = await Log.find({ companyId }).sort({ timestamp: -1 });

    const servicioMap = new Map();

    logs.forEach(log => {
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
    });

    const estados = Array.from(servicioMap.values());

    const summary = {
      total: estados.length,
      critical: estados.filter(s => s.level === 'critical').length,
      warning: estados.filter(s => s.level === 'warning').length,
      info: estados.filter(s => s.level === 'info').length
    };

    res.json({
      summary,
      alerts: estados
    });
  } catch (err) {
    console.error('Error en /api/service-status:', err);
    res.status(500).json({ message: 'Error obteniendo estado de servicios' });
  }
};
