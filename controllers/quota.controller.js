// controllers/quota.controller.js
const Company = require('../models/company.model');
const Usage   = require('../models/usage.model');
const { getPlanByCode } = require('../services/plan.service'); // ← usa la tabla "plans"

// Helpers
function currentPeriodYYYYMM(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}
function endOfMonthUTC(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  // 1° del mes siguiente a las 00:00:00Z
  return new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
}

/**
 * GET /api/quota/summary
 * Responde el plan de la empresa, límite mensual desde "plans",
 * uso del periodo actual, restantes, % y fecha estimada de reset.
 */
exports.getQuotaSummary = async (req, res) => {
  try {
    const { companyId } = req.user; // viene del JWT (string único, ej: "evercom")
    if (!companyId) {
      return res.status(400).json({ message: 'companyId missing in token' });
    }

    // 1) Buscar la empresa por companyId (NO por _id)
    const company = await Company.findOne({ companyId }).lean();
    const planCode = (company?.plan || 'free').toLowerCase();

    // 2) Traer el plan desde la colección plans (con caché)
    const planDoc = await getPlanByCode(planCode);

    // Política de fallback:
    // - Si no existe el plan en DB, sé estricto y deja limit = 0 (bloquea ingesta).
    //   Si prefieres "gracioso", podrías fallback a un default (ej. free=3000).
    const limit = Number.isFinite(planDoc?.monthlyLogLimit) ? planDoc.monthlyLogLimit : 0;

    // 3) Uso del período actual en usages
    const period = currentPeriodYYYYMM();
    const usageDoc = await Usage.findOne({ companyId, period }).lean();
    const used = usageDoc?.logsIngested ?? 0;

    // 4) Cálculos
    const remaining = Math.max(0, limit - used);
    const usagePct  = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    // 5) Respuesta
    return res.json({
      companyId,
      plan: planCode,                 // 'free' | 'starter' | 'pro' | ...
      period,                         // 'YYYYMM'
      limit,                          // desde tabla plans
      used,                           // desde usages
      remaining,
      usagePct,
      resetsAt: endOfMonthUTC().toISOString(),
      // metadatos útiles
      updatedAt: usageDoc?.updatedAt ?? null,
      planName: planDoc?.name ?? null // ej: 'Starter'
    });
  } catch (err) {
    console.error('getQuotaSummary error:', err);
    return res.status(500).json({ message: 'Internal error' });
  }
};
