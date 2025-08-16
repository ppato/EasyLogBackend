// models/usage.model.js
const mongoose = require('mongoose');

const UsageSchema = new mongoose.Schema(
  {
    // Si usas ObjectId en companies, cambia a:
    // companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true }
    companyId: { type: String, required: true, index: true },

    // Periodo "YYYYMM"
    period: {
      type: String,
      required: true,
      match: /^\d{6}$/,
      index: true,
    },

    // Contador mensual
    logsIngested: {
      type: Number,
      default: 0,
      min: 0,
      set: v => Math.max(0, Math.trunc(v)), // fuerza entero y >= 0
    },
  },
  {
    collection: 'usages',
    versionKey: false,
    timestamps: { createdAt: true, updatedAt: true }, // << auto createdAt/updatedAt
  }
);

// Un registro por (companyId, period)
UsageSchema.index({ companyId: 1, period: 1 }, { unique: true });

// Para listados recientes por empresa
UsageSchema.index({ companyId: 1, updatedAt: -1 });

// Helper: periodo actual
UsageSchema.statics.currentPeriodYYYYMM = function (date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
};

// Helper: incremento atómico con upsert (evita conflictos)
UsageSchema.statics.incUsage = async function ({ companyId, period, incBy = 1 }) {
  if (!period) period = this.currentPeriodYYYYMM();
  return this.findOneAndUpdate(
    { companyId, period },
    {
      $setOnInsert: { companyId, period, logsIngested: 0 },
      $inc: { logsIngested: incBy },
      // updatedAt se actualiza solo por timestamps
    },
    { upsert: true, new: true }
  ).lean();
};

module.exports = mongoose.model('Usage', UsageSchema);
