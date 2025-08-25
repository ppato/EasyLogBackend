Manual – Creación de Tokens de Ingesta
1. ¿Qué son?

Un token de ingesta es un JWT especial que se usa para insertar logs en el backend (POST /api/logs).

Tiene scope: logs:write.

Va firmado con una clave interna (kid).

Contiene el companyId como sub.

Opcional: puede incluir svc (nombre del servicio/app).

Ejemplo de claim:

{
  "iss": "easylogs",
  "aud": "logs",
  "sub": "evercom",           // 👈 companyId
  "svc": "frontend-web",      // 👈 opcional: servicio origen
  "scope": "logs:write",
  "exp": 1692230400,          // fecha de expiración
  "jti": "uuid-random"        // id único del token
}

2. Script para generar tokens

Ya tienes el archivo:
scripts/mintIngestToken.js

📌 Sintaxis:

node scripts/mintIngestToken.js <companyId> <serviceId> <minutes>


companyId: código único de la empresa (evercom, empresa123, etc.).

serviceId: nombre del servicio o app que enviará logs (frontend-web, api-gateway, etc.).

minutes: duración del token en minutos.

3. Ejemplo práctico
Generar un token de 60 minutos para la empresa evercom desde el servicio frontend-web:
node scripts/mintIngestToken.js evercom frontend-web 60


👉 Esto devuelve algo así:

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2025-08-16T22:30:00.000Z"
}

4. Usar el token para enviar logs

Cada request debe incluir el token en la cabecera:

curl -X POST http://localhost:4000/api/logs \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "level": "critical",
    "service": "frontend-web",
    "app": "easylogs",
    "message": "Login fallido",
    "url": "/login",
    "context": { "ip": "1.2.3.4", "browser": "Firefox" },
    "timestamp": "2025-08-16T21:50:00.000Z"
  }'

5. Verificar que se guardó

En MongoDB:

db.logs.find({ companyId: "evercom" }).sort({ timestamp: -1 }).limit(5).pretty()

6. Tips

⚠️ Cada compañía debe tener su companyId registrado en companies.

🔑 Genera un token distinto por servicio (API, frontend, batch).

⏳ Usa expiraciones cortas (ej: 60 min) para seguridad, y renueva tokens con un proceso automático si es necesario.

📜 Si necesitas tokens permanentes para pruebas, pon un minutes muy alto (ej: 525600 = 1 año).


Duración de tu token actual:
Cuando ejecutaste:

node scripts/mintIngestToken.js evercom frontend-web 60


El 60 corresponde a minutos de validez.

O sea, ese token dura 60 minutos (1 hora) desde que lo generaste.

Después de ese tiempo, el backend lo rechazará con Invalid token (expired).

👉 Para probar y usar en v1.0 real, lo que te conviene es:

Generar tokens de 30 días (43200 minutos) o 90 días (129600 minutos).

Ejemplo para 30 días:

node scripts/mintIngestToken.js evercom frontend-web 43200


Ejemplo para 90 días:

node scripts/mintIngestToken.js evercom frontend-web 129600


📌 Recomendación:

Para clientes finales → usa 30–90 días (balance entre seguridad y comodidad).

Para pruebas o demos rápidas → 60 min o 1 día (1440 min).