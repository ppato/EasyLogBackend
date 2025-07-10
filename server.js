const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors'); // 👈 importa cors
const authRoutes = require('./routes/auth.routes');
const logRoutes = require('./routes/log.routes');

dotenv.config();
const app = express();

// 👇 habilita CORS antes de cualquier ruta
app.use(cors({
  origin: 'http://localhost:4200', // permite solo tu frontend local
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

app.use('/api', authRoutes);
app.use('/api', logRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
