const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const verifyToken = require('../middlewares/verifyToken'); // ✅ protección

// ✅ Ruta protegida con JWT
router.get('/:email', verifyToken, async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const user = await User.findOne({ email }).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (err) {
    console.error('❌ Error al obtener usuario:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;
