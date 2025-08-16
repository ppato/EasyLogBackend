// controllers/query.controller.js
const Log = require('../models/log.model');
const { parseSqlQuery, ALLOWED_FIELDS } = require('../utils/sql-to-mongo');

// Quitar cualquier campo de inquilino que venga en el WHERE del cliente
const TENANT_FIELDS = ['companyId']; // si quieres también por usuario: ['companyId','userId']

function stripTenantFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  // Si es array (e.g. $and, $or)
  if (Array.isArray(obj)) return obj.map(stripTenantFields);

  // Si es objeto
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (TENANT_FIELDS.includes(k)) {
      // ⚠️ Ignoramos filtros sobre companyId/userId que vengan del cliente
      continue;
    }
    // recursivo para $and / $or / anidados
    clean[k] = (typeof v === 'object' && v !== null) ? stripTenantFields(v) : v;
  }
  return clean;
}

exports.queryLogs = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ ok: false, message: 'Falta "query"' });

    const tenantCompanyId = req.user?.companyId;
    if (!tenantCompanyId) return res.status(401).json({ ok: false, message: 'Token sin companyId' });

    const { projection, filter, sort, limit, offset } = parseSqlQuery(query);

    // 1) Limpiamos cualquier intento de filtrar tenant vía SQL
    const userFilter = stripTenantFields(filter);

    // 2) Forzamos el guard del tenant desde el token (no negociable)
    const finalFilter = { $and: [ { companyId: tenantCompanyId }, userFilter ] };

    const cursor = Log.find(finalFilter, projection || undefined)
      .sort(sort)
      .skip(offset)
      .limit(limit);

    const [rows, total] = await Promise.all([
      cursor.lean(),
      Log.countDocuments(finalFilter)
    ]);

    res.json({
      ok: true,
      total,
      count: rows.length,
      limit,
      offset,
      sort,
      filter: finalFilter,
      columns: projection ? Object.keys(projection) : ALLOWED_FIELDS,
      rows
    });
  } catch (err) {
    console.error('❌ queryLogs error:', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
};
