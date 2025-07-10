const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  companyId: { type: String, required: true, unique: true },
  name:      { type: String, required: true },
  plan:      { type: String, default: 'free' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Company', companySchema);
