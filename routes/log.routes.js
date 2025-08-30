// routes/log.routes.js
const express = require('express');
const router = express.Router();

const {
  createLog,
  getLogs,
  getLogLevels,
  getServiceStatus
} = require('../controllers/log.controller');

const ingestAuth = require('../middlewares/ingestAuth'); // token de ingesta

// ✅ Lista / filtra logs (protegido por auth en server.js)
// GET /api/logs
router.get('/', getLogs);

// ✅ Niveles de log (protegido por auth)
// GET /api/logs/levels
router.get('/levels', getLogLevels);

// ✅ Estado de servicios (protegido por auth)
// GET /api/logs/service-status
router.get('/service-status', getServiceStatus);

// ✅ Crear log desde la app (protegido por auth)
// POST /api/logs
router.post('/', createLog);

// ✅ Ingesta de logs desde agentes externos
// POST /api/logs/ingest
// Nota: con tu server.js actual, esta ruta también queda detrás de auth.
// Si quieres que SOLO pida el token de ingesta (sin auth de usuario),
// monta estas rutas en otro prefijo público (ver nota más abajo).
router.post('/ingest', ingestAuth, createLog);

module.exports = router;
