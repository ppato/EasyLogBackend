// utils/sql-to-mongo.js
// Parser simple de consultas SQL-like → { projection, filter, sort, limit, offset }

const ALLOWED_FIELDS = [
  '_id', 'timestamp', 'level', 'service', 'app', 'companyId', 'message', 'userId', 'url'
];

const ALLOWED_ORDER = ['ASC', 'DESC'];

// ❗ Campos prohibidos en WHERE (se fuerzan desde el token en el controller)
const DISALLOWED_WHERE_FIELDS = ['companyId']; // agrega 'userId' si quieres también bloquearlo

function mustAllowed(field) {
  if (!ALLOWED_FIELDS.includes(field)) {
    throw new Error(`Campo no permitido: ${field}`);
  }
}
function mustAllowedInWhere(field) {
  if (DISALLOWED_WHERE_FIELDS.includes(field)) {
    throw new Error(`No se permite filtrar por ${field} en WHERE`);
  }
}

function parseValue(v) {
  const s = v.trim();
  const mStr = s.match(/^'(.*)'$/);
  if (mStr) return mStr[1];
  if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^\d{4}-\d{2}-\d{2}T.*Z$/.test(s)) return new Date(s);
  return s;
}

function splitByLogical(input, op) {
  const parts = [];
  let buf = '';
  let inQuote = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === "'" || c === '"') {
      inQuote = !inQuote;
      buf += c;
      continue;
    }
    if (!inQuote && input.slice(i).toUpperCase().startsWith(` ${op} `)) {
      parts.push(buf.trim());
      buf = '';
      i += op.length + 1; // espacio + op
    } else {
      buf += c;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function parseCondition(cond) {
  // BETWEEN
  const mBetween = cond.match(/^([a-zA-Z0-9_\.]+)\s+BETWEEN\s+(.+)\s+AND\s+(.+)$/i);
  if (mBetween) {
    const field = mBetween[1];
    mustAllowed(field);
    mustAllowedInWhere(field);
    const a = parseValue(mBetween[2]);
    const b = parseValue(mBetween[3]);
    return { [field]: { $gte: a, $lte: b } };
  }

  // IN
  const mIn = cond.match(/^([a-zA-Z0-9_\.]+)\s+IN\s*\((.+)\)$/i);
  if (mIn) {
    const field = mIn[1];
    mustAllowed(field);
    mustAllowedInWhere(field);
    const listRaw = mIn[2].split(',').map(s => parseValue(s.trim()));
    return { [field]: { $in: listRaw } };
  }

  // LIKE
  const mLike = cond.match(/^([a-zA-Z0-9_\.]+)\s+LIKE\s+'(.+)'$/i);
  if (mLike) {
    const field = mLike[1];
    mustAllowed(field);
    mustAllowedInWhere(field);
    const pattern = mLike[2].replace(/%/g, '.*');
    if (pattern.length > 200) throw new Error('Patrón LIKE muy largo');
    return { [field]: { $regex: pattern, $options: 'i' } };
  }

  // Comparadores
  const mComp = cond.match(/^([a-zA-Z0-9_\.]+)\s*(=|!=|>=|<=|>|<)\s*(.+)$/);
  if (mComp) {
    const field = mComp[1];
    const op = mComp[2];
    const val = parseValue(mComp[3]);
    mustAllowed(field);
    mustAllowedInWhere(field);
    switch (op) {
      case '=':  return { [field]: val };
      case '!=': return { [field]: { $ne: val } };
      case '>=': return { [field]: { $gte: val } };
      case '<=': return { [field]: { $lte: val } };
      case '>':  return { [field]: { $gt: val } };
      case '<':  return { [field]: { $lt: val } };
      default: throw new Error(`Operador no soportado: ${op}`);
    }
  }

  throw new Error(`Condición WHERE no soportada o mal formada: "${cond}"`);
}

/**
 * 👇 Clave: primero intentamos parsear TODA la expresión como UNA condición.
 * Si falla (no es BETWEEN/IN/LIKE/comp simple), recién la dividimos por AND.
 */
function parseAndGroup(expr) {
  const trimmed = expr.trim();
  try {
    return parseCondition(trimmed);
  } catch {
    const andParts = splitByLogical(trimmed, 'AND');
    const andConds = andParts.map(p => parseCondition(p.trim())).filter(Boolean);
    if (andConds.length > 1) return { $and: andConds };
    return andConds[0] || {};
  }
}

function parseWhere(where) {
  const orGroups = splitByLogical(where, 'OR');
  if (orGroups.length > 1) {
    return { $or: orGroups.map(g => parseAndGroup(g)) };
  }
  return parseAndGroup(where);
}

function parseSqlQuery(sqlRaw) {
  if (!sqlRaw || typeof sqlRaw !== 'string') throw new Error('Query inválida');
  const sql = sqlRaw.replace(/\s+/g, ' ').trim();

  if (!/^SELECT\s+/i.test(sql)) throw new Error('Debe comenzar con SELECT');
  if (!/\sFROM\s+logs\b/i.test(sql)) throw new Error('Debe consultar desde FROM logs');

  // SELECT
  const mSelect = sql.match(/^SELECT\s+(.+?)\s+FROM\s+logs\b/i);
  const selectPart = mSelect ? mSelect[1].trim() : '*';

  // WHERE
  const mWhere = sql.match(/\bWHERE\s+(.+?)(\s+ORDER\s+BY|\s+LIMIT|\s+OFFSET|;|$)/i);
  const wherePart = mWhere ? mWhere[1].trim() : '';

  // ORDER BY
  const mOrder = sql.match(/\bORDER\s+BY\s+([a-zA-Z0-9_\.]+)(?:\s+(ASC|DESC))?/i);
  const orderField = mOrder ? mOrder[1] : null;
  const orderDir = mOrder && mOrder[2] ? mOrder[2].toUpperCase() : 'ASC';

  // LIMIT / OFFSET
  const mLimit = sql.match(/\bLIMIT\s+(\d+)/i);
  let limit = mLimit ? parseInt(mLimit[1], 10) : 50;
  const mOffset = sql.match(/\bOFFSET\s+(\d+)/i);
  let offset = mOffset ? parseInt(mOffset[1], 10) : 0;

  if (limit > 200) limit = 200;
  if (offset < 0) offset = 0;

  if (orderField && !ALLOWED_FIELDS.includes(orderField)) {
    throw new Error(`ORDER BY no permitido: ${orderField}`);
  }
  if (!ALLOWED_ORDER.includes(orderDir)) {
    throw new Error(`Dirección ORDER BY inválida: ${orderDir}`);
  }

  // Proyección
  let projection = null;
  if (selectPart !== '*') {
    const fields = selectPart.split(',').map(s => s.trim());
    projection = {};
    for (const f of fields) {
      if (!ALLOWED_FIELDS.includes(f)) throw new Error(`Campo no permitido en SELECT: ${f}`);
      projection[f] = 1;
    }
  }

  // WHERE → filter
  const filter = wherePart ? parseWhere(wherePart) : {};

  // Sort
  const sort = orderField ? { [orderField]: (orderDir === 'ASC' ? 1 : -1) } : { timestamp: -1 };

  return { projection, filter, sort, limit, offset };
}

module.exports = {
  parseSqlQuery,
  ALLOWED_FIELDS,
  DISALLOWED_WHERE_FIELDS
};
