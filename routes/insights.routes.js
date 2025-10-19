// routes/insights.routes.js
const express = require('express');
const router = express.Router();

const {
  getInsights,
  getSpikesOnly
} = require('../controllers/insights.controller');

const verifyToken = require('../middlewares/verifyToken'); // mismo middleware que usas en log.routes

// ✅ Insights generales (spikes, patrones, anomalías)
// GET /api/insights
router.get('/', verifyToken, getInsights);

// ✅ Solo spikes (útil si quieres una vista rápida de anomalías críticas)
// GET /api/insights/spikes
router.get('/spikes', verifyToken, getSpikesOnly);

module.exports = router;



