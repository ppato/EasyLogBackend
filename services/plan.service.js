// services/plan.service.js
const Plan = require('../models/plan.model');

/**
 * Lee SIEMPRE desde la colección "plans" (sin caché).
 * Normaliza el code a lowercase y usa read('primary') para evitar réplicas retrasadas.
 */
async function getPlanByCode(code) {
  if (!code) return null;
  const planCode = String(code).toLowerCase();
  return Plan.findOne({ code: planCode }).read('primary').lean();
}

module.exports = { getPlanByCode };
