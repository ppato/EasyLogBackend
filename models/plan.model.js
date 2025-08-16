// models/plan.model.js
const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },   // 'free' | 'starter' | 'pro' | ...
  name: { type: String, required: true },                  // 'Free', 'Starter', ...
  monthlyLogLimit: { type: Number, required: true, min: 0 },
}, {
  collection: 'plans',
  timestamps: true,
  versionKey: false,
});

planSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('Plan', planSchema);
