/**
 * scripts/seed-logs.js
 * Genera logs simulados para probar el módulo Smart Insights.
 * Inserta directo en MongoDB usando tu MONGO_URI (sin token, sin cupo).
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ✅ toma automáticamente tu cadena del .env
const MONGO_URI = process.env.MONGO_URI;
const COMPANY_ID = 'empresa123'; // tu empresa de prueba
const APP = 'easylogs';

const LogSchema = new mongoose.Schema({
  level: String,
  service: String,
  app: String,
  companyId: String,
  message: String,
  context: Object,
  userId: mongoose.Schema.Types.ObjectId,
  url: String,
  timestamp: Date
}, { collection: 'logs' });

const Log = mongoose.model('Log', LogSchema);

/* ===================== CONFIGURACIÓN ===================== */
const SERVICES = [
  {
    service: 'auth-service',
    baselinePerHour: { warning: 2, critical: 0.2 },
    spike: {
      startISO: '2025-08-10T23:00:00Z',
      durationHours: 2,
      multiplier: 6,
      level: 'warning',
      message: 'Intento de login fallido'
    }
  },
  {
    service: 'dss-service',
    baselinePerHour: { critical: 0.15 },
    spike: {
      startISO: '2025-08-10T23:00:00Z',
      durationHours: 1,
      multiplier: 8,
      level: 'critical',
      message: 'Timeout en dependencia DSS'
    }
  }
];

const END_ISO = '2025-08-15T23:59:59Z';
const DAYS = 14;
const CLEAN_BEFORE = true;

/* ===================== FUNCIONES AUXILIARES ===================== */
function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function* hoursBetween(start, end) {
  let t = new Date(start);
  while (t < end) {
    yield new Date(t);
    t = new Date(t.getTime() + 60 * 60 * 1000);
  }
}

/* ===================== EJECUCIÓN ===================== */
async function run() {
  console.log('🌱 Conectando a MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Conectado a', MONGO_URI);

  const end = new Date(END_ISO);
  const start = new Date(end.getTime() - DAYS * 24 * 60 * 60 * 1000);

  if (CLEAN_BEFORE) {
    const del = await Log.deleteMany({
      companyId: COMPANY_ID,
      app: APP,
      timestamp: { $gte: start, $lte: end }
    });
    console.log(`🧹 Eliminados ${del.deletedCount} logs previos del rango.`);
  }

  const docs = [];
  for (const svc of SERVICES) {
    const spikeStart = new Date(svc.spike.startISO);
    const spikeEnd = new Date(spikeStart.getTime() + svc.spike.durationHours * 60 * 60 * 1000);

    for (const hour of hoursBetween(start, end)) {
      for (const [level, baseLambda] of Object.entries(svc.baselinePerHour)) {
        let lambda = baseLambda;
        if (hour >= spikeStart && hour < spikeEnd && level === svc.spike.level) {
          lambda *= svc.spike.multiplier;
        }

        const count = poisson(lambda);
        for (let i = 0; i < count; i++) {
          const ts = new Date(hour.getTime() + Math.floor(Math.random() * 60) * 60 * 1000);
          docs.push({
            level,
            service: svc.service,
            app: APP,
            companyId: COMPANY_ID,
            message:
              (hour >= spikeStart && hour < spikeEnd && level === svc.spike.level)
                ? svc.spike.message
                : (level === 'critical' ? 'Falla crítica detectada' : 'Intento de login fallido'),
            context: { errorCode: level === 'critical' ? 500 : 401 },
            userId: null,
            timestamp: ts
          });
        }
      }
    }
  }

  if (docs.length === 0) {
    console.log('⚠️ No se generaron logs (verifica configuración).');
    process.exit(0);
  }

  console.log(`📦 Insertando ${docs.length} documentos...`);
  await Log.insertMany(docs, { ordered: false });
  console.log('✅ Seed completado con éxito.');

  await mongoose.disconnect();
  console.log('🔌 Desconectado de MongoDB.');
}

run().catch(err => {
  console.error('💥 Error en seed:', err);
  process.exit(1);
});
