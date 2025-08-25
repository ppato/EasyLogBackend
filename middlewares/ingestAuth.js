// middlewares/ingestAuth.js
const jwt = require('jsonwebtoken');
const { getSecretByKid } = require('../utils/jwtKeys'); // OJO: carpeta utils

module.exports = function ingestAuth(req, res, next) {
  try {
    const auth = req.header('Authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ message: 'Missing bearer token' });

    const token = m[1];

    // 1) Resolver secret por kid desde el header del JWT
    let headerObj;
    try {
      headerObj = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    } catch {
      return res.status(403).json({ message: 'Invalid token header' });
    }

    const kid = headerObj.kid;
    if (!kid) return res.status(403).json({ message: 'Missing kid in token header' });

    let secret;
    try {
      secret = getSecretByKid(kid);
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }

    // 2) Verificar y validar claims
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'easylogs',
      audience: 'logs'
    });

    if (payload.scope !== 'logs:write') {
      return res.status(403).json({ message: 'Invalid scope' });
    }
    if (!payload.sub || typeof payload.sub !== 'string' || !payload.sub.trim()) {
      return res.status(400).json({ message: 'Missing companyId (sub) in token' });
    }

    // 3) Inyectar en req para el controlador
    req.companyId = payload.sub.trim();      // p.ej. "evercom"
    req.serviceId = payload.svc || null;     // opcional
    req.ingestTokenJti = payload.jti || null;

    return next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token', detail: err.message });
  }
};
