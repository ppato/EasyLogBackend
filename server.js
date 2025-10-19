// server.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Rutas
const authRoutes  = require('./routes/auth.routes');   // públicas: /api/login, /api/register, etc.
const logRoutes   = require('./routes/log.routes');    // protegidas (montadas en /api/logs)
const userRoutes  = require('./routes/user.routes');   // protegidas (montadas en /api/users)
const queryRoutes = require('./routes/query.routes');  // públicas (o protégelas si quieres)
const quotaRoutes = require('./routes/quota.routes');  // públicas (o protégelas si quieres)

const insightsRoutes = require('./routes/insights.routes');

// Middleware de autenticación (JWT)
const auth = require('./middlewares/auth');

const app = express();

/* -------- Seguridad / compresión -------- */
app.use(helmet());
app.use(compression());

/* -------- CORS dinámico (local + prod Render + previews Vercel) --------
   En Render define: CORS_ORIGIN=https://easy-log-saa-s.vercel.app[,https://tu-dominio.com]
----------------------------------------------------------------------- */
const rawEnvOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const defaultDevOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const allowList = rawEnvOrigins.length > 0
  ? rawEnvOrigins
  : (process.env.NODE_ENV === 'production' ? [] : defaultDevOrigins);

console.log('[CORS] allowList =', allowList);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/Postman/healthchecks

    let ok = false;
    try {
      const url  = new URL(origin);
      const base = `${url.protocol}//${url.hostname}`;
      const host = url.hostname;

      ok =
        allowList.includes(origin) ||
        allowList.includes(base)   ||
        /\.vercel\.app$/i.test(host); // previews Vercel
    } catch (_) {
      ok = false;
    }
    return cb(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With']
};

// Modo permisivo temporal (debug local): exporta CORS_ANY=1
if (process.env.CORS_ANY === '1') {
  console.warn('[CORS] Permissive mode enabled (CORS_ANY=1)');
  app.use(cors());
  app.options('*', cors());
} else {
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
}

/* -------- Body parsing -------- */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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
/* Públicas (no requieren token) */
app.use('/api', authRoutes);   // /api/login, /api/register
app.use('/api', queryRoutes);  // /api/query...
app.use('/api', quotaRoutes);  // /api/quota...

/* Protegidas (requieren token válido) */
// ⭐️ IMPORTANTE: dentro de routes/log.routes.js usa router.get('/') (SIN '/logs')
app.use('/api/logs', auth, logRoutes);   // GET /api/logs, POST /api/logs, etc.
app.use('/api/users', auth, userRoutes); // GET /api/users, ...
app.use('/api/insights', auth, insightsRoutes); // GET /api/insights, GET /api/insights/spikes
/* -------- 404 API -------- */
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not Found', path: req.path });
  }
  next();
});

/* -------- Error handler -------- */
app.use((err, req, res, next) => {
  console.error('💥 Error:', err);
  if (res.headersSent) return next(err);

  // CORS bloqueado
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS_BLOCKED', message: 'Origin no permitido' });
  }

  // Si el middleware de auth u otros seteó un status explícito, respétalo
  const status = err.status || err.statusCode || 500;
  const msg = err.message || 'Internal Server Error';
  res.status(status).json({ error: msg });
});

/* -------- Server -------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
