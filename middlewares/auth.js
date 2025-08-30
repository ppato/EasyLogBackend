// middlewares/auth.js
const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ code: 'NO_TOKEN', message: 'Falta token' });

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Sesión expirada' });
      }
      return res.status(401).json({ code: 'TOKEN_INVALID', message: 'Token inválido' });
    }
    req.user = payload; // { id, companyId, iat, exp }
    next();
  });
};
