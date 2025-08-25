const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const logRoutes = require('./routes/log.routes');
const userRoutes = require('./routes/user.routes');

// 👇 NUEVO: rutas de consultas SQL-like
const queryRoutes = require('./routes/query.routes');
const quotaRoutes  = require('./routes/quota.routes'); // 👈 agrega este require
dotenv.config();
const app = express();

app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST'], // si luego usas PUT/DELETE, agrégalos aquí
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

app.use('/api', authRoutes);
app.use('/api', logRoutes);
app.use('/api/users', userRoutes);

// 👇 NUEVO: monta POST /api/query-logs
app.use('/api', queryRoutes);

// server.js (montaje)
app.use('/api', quotaRoutes); // 👈 monta GET /api/quota/summary


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

//https://easylogbackend.onrender.com