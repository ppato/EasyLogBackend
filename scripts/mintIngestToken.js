// scripts/mintIngestToken.js
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { getActiveSigningKey } = require('../utils/jwtKeys');

// Uso: node scripts/mintIngestToken.js <companyId> [service] [ttlDays]
// Ej:  node scripts/mintIngestToken.js evercom frontend-web 60
(async () => {
  const [,, companyId, service = 'generic', ttlDays = '90'] = process.argv;
  if (!companyId) {
    console.error('Uso: node scripts/mintIngestToken.js <companyId> [service] [ttlDays]');
    process.exit(1);
  }
  try {
    const { kid, secret } = getActiveSigningKey();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (parseInt(ttlDays, 10) * 24 * 3600);

    const token = jwt.sign(
      {
        iss: 'easylogs',
        aud: 'logs',
        sub: companyId,      // companyId
        svc: service,        // opcional: servicio emisor
        scope: 'logs:write', // SOLO ingesta
        jti: randomUUID()
      },
      secret,
      { algorithm: 'HS256', header: { kid }, expiresIn: exp - now }
    );

    console.log(token);
  } catch (e) {
    console.error('Error al emitir token:', e.message);
    process.exit(1);
  }
})();
