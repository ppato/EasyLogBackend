// routes/quota.routes.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken'); // 👈 usa el mismo
const { getQuotaSummary } = require('../controllers/quota.controller');

router.get('/quota/summary', verifyToken, getQuotaSummary);

module.exports = router;
