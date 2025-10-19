// scripts/seed-logs-v2.js
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
const companyId = 'empresa123';

const LogSchema = new mongoose.Schema({
  level: String,
  service: String,
  app: String,
  companyId: String,
  message: String,
  context: Object,
  userId: String,
  timestamp: Date
});

const Log = mongoose.model('Log', LogSchema);

async function seed() {
  console.log('🌱 Conectando a MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Conectado.');

  // 🧹 Eliminar registros del rango específico
  const start = new Date('2025-10-12T22:16:53.890Z');
  const end   = new Date('2025-10-19T22:16:53.890Z');
  const del = await Log.deleteMany({
    companyId,
    timestamp: { $gte: start, $lte: end }
  });
  console.log(`🧹 Eliminados ${del.deletedCount} logs previos del rango.`);

  const services = [
    'auth-service',
    'payment-service',
    'scheduler-service',
    'reporting-service'
  ];
  const apps = ['easylogs', 'web-store', 'admin-console', 'api-gateway'];
  const messages = {
    critical: [
      'Error crítico en base de datos',
      'Falla grave en /checkout',
      'Servicio fuera de línea',
      'Spike de errores 500 detectado'
    ],
    warning: [
      'Intento de login fallido',
      'Timeout en API externa',
      'Latencia sobre p95',
      'Reintentos excesivos detectados'
    ],
    info: [
      'Operación completada con éxito',
      'Inicio de sesión correcto',
      'Tarea programada ejecutada',
      'Sincronización finalizada'
    ]
  };

  const totalDocs = 1000;
  const docs = [];

  for (let i = 0; i < totalDocs; i++) {
    const randomService = services[Math.floor(Math.random() * services.length)];
    const randomApp = apps[Math.floor(Math.random() * apps.length)];
    const levels = ['critical', 'warning', 'info'];
    const level = levels[Math.floor(Math.random() * levels.length)];

    const msgArr = messages[level];
    const message = msgArr[Math.floor(Math.random() * msgArr.length)];

    const ts = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

    docs.push({
      level,
      service: randomService,
      app: randomApp,
      companyId,
      message,
      context: {
        errorCode: level === 'critical' ? 500 : level === 'warning' ? 408 : 200,
        extra: `Simulado (${level}) - ${randomService}`
      },
      userId: '686d980ae505e3266f091932',
      timestamp: ts
    });
  }

  console.log(`📦 Insertando ${docs.length} documentos...`);
  await Log.insertMany(docs);
  console.log('✅ Seed completado con éxito.');

  await mongoose.disconnect();
  console.log('🔌 Desconectado de MongoDB.');
}

seed().catch(err => {
  console.error('❌ Error en seed:', err);
  mongoose.disconnect();
});
