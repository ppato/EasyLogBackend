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

/* -------- CORS dinámico (prod + previews Vercel + local) -------- */
// Define en Render: CORS_ORIGIN=https://easy-log-saa-s.vercel.app,http://localhost:4200
const allowList = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean); // ej.: ['https://easy-log-saa-s.vercel.app','http://localhost:4200']

const corsOptions = {
  origin(origin, cb) {
    // Permite llamadas sin Origin (curl/Postman/healthchecks)
    if (!origin) return cb(null, true);

    let ok = false;
    try {
      const host = new URL(origin).hostname;
      // Permite lista explícita y cualquier *.vercel.app (previews)
      ok = allowList.includes(origin) || /\.vercel\.app$/i.test(host);
    } catch (_) {
      ok = false;
    }
    return cb(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Preflight

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
// Asegúrate de que estas rutas exporten un router de Express
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
