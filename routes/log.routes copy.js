const express = require('express');
const router = express.Router();
const {
  createLog,
  getLogs,
  getLogLevels,
  getServiceStatus // 👈 nueva función
} = require('../controllers/log.controller');
const verifyToken = require('../middlewares/verifyToken');

router.post('/logs', verifyToken, createLog);
router.get('/logs', verifyToken, getLogs);
router.get('/logs/levels', verifyToken, getLogLevels);

// NUEVO ENDPOINT
router.get('/service-status', verifyToken, getServiceStatus); // ✅

module.exports = router;
