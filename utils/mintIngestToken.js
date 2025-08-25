#!/usr/bin/env node
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { getActiveSigningKey } = require('../util/jwtKeys');

const [,, companyId, service = 'generic', ttlDays = '90'] = process.argv;
if (!companyId) {
  console.error('Uso: node scripts/mintIngestToken.js <companyId> [service] [ttlDays]');
  process.exit(1);
}
const { kid, secret } = getActiveSigningKey();
const now = Math.floor(Date.now() / 1000);
const exp = now + (parseInt(ttlDays,10) * 24 * 3600);

const token = jwt.sign(
  { iss: 'easylogs', aud: 'logs', sub: companyId, svc: service, scope: 'logs:write', jti: randomUUID() },
  secret,
  { algorithm: 'HS256', header: { kid }, expiresIn: exp - now }
);

console.log(token);
