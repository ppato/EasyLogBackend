// scripts/seed-plans.js
require('dotenv').config();
const mongoose = require('mongoose');
const Plan = require('../models/plan.model'); // ajusta ruta si difiere

async function main() {
  await mongoose.connect(process.env.MONGO_URI, {
    // opcional: { dbName: process.env.MONGO_DB }
  });

  // idempotente: upsert por code
  const base = [
    { code: 'free',    name: 'Free',    monthlyLogLimit: 1_000 },
    { code: 'starter', name: 'Starter', monthlyLogLimit: 10_000 },
    { code: 'pro',     name: 'Pro',     monthlyLogLimit: 100_000 },
  ];

  for (const p of base) {
    await Plan.updateOne({ code: p.code }, { $set: p }, { upsert: true });
  }

  console.log('✅ Plans seeded/updated');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
