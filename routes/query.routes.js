const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const { queryLogs } = require('../controllers/query.controller');

// POST /api/query-logs
router.post('/query-logs', verifyToken, queryLogs);

module.exports = router;

