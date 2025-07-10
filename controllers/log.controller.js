const Log = require('../models/log.model');

// POST /api/logs → guardar log con companyId y userId
exports.createLog = async (req, res) => {
  try {
    const { id: userId, companyId } = req.user;

    const log = new Log({
      ...req.body,
      userId,
      companyId,
      timestamp: req.body.timestamp || new Date().toISOString() // fallback si no viene
    });

    await log.save();
    res.status(201).json({ message: 'Log saved', log });
  } catch (err) {
    console.error('Error al guardar log:', err);
    res.status(500).json({ message: 'Error saving log' });
  }
};

// GET /api/logs → traer solo logs de la empresa
exports.getLogs = async (req, res) => {
  try {
    const { companyId } = req.user;

    const logs = await Log.find({ companyId }).sort({ timestamp: -1 }).limit(1000);
    res.json(logs);
  } catch (err) {
    console.error('Error al obtener logs:', err);
    res.status(500).json({ message: 'Error retrieving logs' });
  }
};

// GET /api/logs/levels → obtener niveles de criticidad únicos por empresa
exports.getLogLevels = async (req, res) => {
  try {
    const { companyId } = req.user;
    const levels = await Log.distinct('level', { companyId });

    res.json(levels);
  } catch (err) {
    console.error('Error al obtener niveles:', err);
    res.status(500).json({ message: 'Error al obtener niveles de criticidad' });
  }
};

