const express = require('express');
const router = express.Router();
const { createLog, getLogs, getLogLevels } = require('../controllers/log.controller'); // 👈 Agregado getLogLevels
const verifyToken = require('../middlewares/verifyToken');

router.post('/logs', verifyToken, createLog);
router.get('/logs', verifyToken, getLogs);
router.get('/logs/levels', verifyToken, getLogLevels); // ✅ Ruta para niveles

module.exports = router;
// Exportamos el router para usarlo en app.js
// Asegúrate de que verifyToken esté correctamente implementado para validar JWT y extraer
// companyId y userId del token. Aquí asumimos que req.user tiene esos campos después de la verificación    