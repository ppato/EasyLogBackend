v1.0 — alcance y lineamientos
1) Ingesta REST mínima pero sólida

Endpoint único: POST /api/logs

Auth: Token de Ingesta (JWT HS256) con sub=companyId, scope=logs:write, kid para rotación.

Body (estable): level, service, app, message, url?, context?, timestamp?, userId?

Regla: ignorar companyId del body; forzar desde el token.

Respuestas: 201 { ok, id, ingestedAt }, 400, 401/403, 429 limit_exceeded, 5xx.

2) Seguridad operable (sin fricción)

Emisión de tokens por empresa/servicio con script (mintIngestToken.js) y rotación con doble kid (superposición 7–14 días).

Expiración: 60–90 días (MVP).

Revocación por jti (persistir y chequear opcional).

3) Cuotas y límites

Cuota mensual por empresa (atomic $inc con retry).

Rate limit razonable (p.ej., 100 req/min/empresa); devolver 429 y recomendar backoff.

4) Documentación lista para copiar/pegar

Manual técnico (ya lo tienes en canvas).

Sección “Tokens” (ya creada).

Guías de integración ultra-cortas por lenguaje (JS, Python, Java, .NET, VB6/VBA, cURL).
Objetivo: una línea usando un mini helper/snippet.

5) SDK “mínimo” (solo 1 en v1.0)

Publica un SDK oficial: easylogs en npm (Node/TS).

Método: log(token, event) con retries y timeout.

El resto de lenguajes: snippets en la doc (evitas mantener 5 SDKs).

6) Observabilidad/ops

Service health: GET /api/service-status (ya lo tienes).

Logs internos de la API (nivel error) y métricas simples (req/s, latencia, 4xx/5xx).

Alerta futura (v1.1): webhook por level=critical.

7) Compatibilidad y estabilidad

Contrato v1.0 congelado (no rompes esquema ni rutas).

Si cambias algo, usa v1.1 y deja v1.0 activo un tiempo.

8) Checklist de salida a prod

 Token de Ingesta funcionando (sub=companyId), ingestAuth aplicado solo en POST /logs.

 createLog fuerza companyId desde token.

 Cuota mensual verificada (429 con payload claro).

 Docs con ejemplos por lenguaje + cURL.

 SDK npm publicado o repo listo para npm i desde Git.

 Variables/secretos en Render configurados (EASYLOGS_JWT_KEYS, EASYLOGS_ACTIVE_KID).

 Pruebas: éxito, 400, 401/403, 429, 5xx.

9) Roadmap corto (v1.1–v1.2)

Client Credentials (/api/auth/ingest-token) para tokens cortos auto-renovables.

Batch POST /api/logs/batch (reduce overhead).

Webhooks critical + firmas HMAC.

SDK Python (lo segundo más pedido normalmente).

Resumen ejecutivo

Mantén 1 endpoint, 1 token de ingesta, 1 SDK (npm) y snippets para el resto.

Seguridad real (sub desde token), operable (rotación con kid) y docs claras.

Eso te da integración en 5 min para cualquiera y base firme para crecer.