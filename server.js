// server.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Rutas
const authRoutes  = require('./routes/auth.routes');
const logRoutes   = require('./routes/log.routes');
const userRoutes  = require('./routes/user.routes');
const queryRoutes = require('./routes/query.routes');
const quotaRoutes = require('./routes/quota.routes');

const app = express();

/* -------- Seguridad / compresión -------- */
app.use(helmet());
app.use(compression());

/* -------- CORS dinámico (local + prod Render + previews Vercel) -------- */
// En Render define: CORS_ORIGIN=https://easy-log-saa-s.vercel.app
// En local puedes dejarlo vacío y usará los orígenes por defecto (localhost).
const rawEnvOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Orígenes por defecto en desarrollo (si CORS_ORIGIN no está seteado)
const defaultDevOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

// Allowlist final
const allowList = rawEnvOrigins.length > 0
  ? rawEnvOrigins
  : (process.env.NODE_ENV === 'production' ? [] : defaultDevOrigins);

console.log('[CORS] allowList =', allowList);

const corsOptions = {
  origin(origin, cb) {
    // Permite llamadas sin Origin (curl/Postman/healthchecks)
    if (!origin) {
      console.log('[CORS] request sin Origin -> ALLOW');
      return cb(null, true);
    }

    let ok = false;
    try {
      const url  = new URL(origin);
      const base = `${url.protocol}//${url.hostname}`; // mismo host sin puerto
      const host = url.hostname;

      ok =
        allowList.includes(origin) ||        // match exacto (con puerto)
        allowList.includes(base)   ||        // por si el puerto difiere
        /\.vercel\.app$/i.test(host);        // *preview* de Vercel

    } catch (_) {
      ok = false;
    }

    console.log(`[CORS] Origin: ${origin} -> ${ok ? 'ALLOW' : 'BLOCK'}`);
    return cb(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With']
};

// Modo permisivo temporal (solo para debug local): exporta CORS_ANY=1
if (process.env.CORS_ANY === '1') {
  console.warn('[CORS] Modo permisivo habilitado (CORS_ANY=1)');
  app.use(cors());
  app.options('*', cors());
} else {
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions)); // Preflight
}

/* -------- Body parsing -------- */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* -------- Healthcheck -------- */
app.get('/health', (_, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

/* -------- MongoDB -------- */
mongoose.set('strictQuery', true);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

/* -------- Rutas API -------- */
app.use('/api', authRoutes);
app.use('/api', logRoutes);
app.use('/api/users', userRoutes);
app.use('/api', queryRoutes);
app.use('/api', quotaRoutes);

/* -------- 404 API -------- */
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not Found', path: req.path });
  }
  next();
});

/* -------- Error handler -------- */
app.use((err, req, res, next) => {
  console.error('💥 Error:', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

/* -------- Server -------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
