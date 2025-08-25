// utils/jwtKeys.js
// Formato de env esperado (ejemplo):
// EASYLOGS_JWT_KEYS="kid1:super-secreto-largo-1,kid2:super-secreto-largo-2"
// EASYLOGS_ACTIVE_KID="kid1"

function loadKeys() {
  const raw = process.env.EASYLOGS_JWT_KEYS || '';
  const map = {};
  raw.split(',').forEach(pair => { // ⚠️ separa por coma
    const [kid, ...rest] = pair.split(':');
    const secret = rest.join(':'); // por si el secreto contiene ':'
    if (kid && secret) map[kid] = secret;
  });
  return map;
}

const KEY_MAP = loadKeys();
const ACTIVE_KID = process.env.EASYLOGS_ACTIVE_KID || Object.keys(KEY_MAP)[0];

function getSecretByKid(kid) {
  const sec = KEY_MAP[kid];
  if (!sec) throw new Error(`JWT key not found for kid=${kid}`);
  return sec;
}

function getActiveSigningKey() {
  const sec = KEY_MAP[ACTIVE_KID];
  if (!sec) throw new Error('Active JWT key not configured');
  return { kid: ACTIVE_KID, secret: sec };
}

module.exports = { getSecretByKid, getActiveSigningKey };
