const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Company = require('../models/company.model');

const DEFAULT_AVATAR = 'https://tu-dominio.com/img/default-avatar.png'; // cámbialo si quieres

// Helpers
function buildSafeUser(userDoc) {
  const { password, __v, ...rest } = userDoc.toObject();
  return rest;
}

exports.register = async (req, res) => {
  const { email, password, companyId, name, phone, photoUrl } = req.body;

  if (!email || !password || !companyId) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: 'El usuario ya existe' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({
    email,
    password: hashedPassword,
    companyId,
    name,
    phone,
    photoUrl: photoUrl || DEFAULT_AVATAR,
  });
  await user.save();

  const token = jwt.sign(
    { id: user._id, companyId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.status(201).json({
    message: 'Usuario registrado',
    token,
    user: buildSafeUser(user), // ← devuelve photoUrl al front
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Credenciales inválidas' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: 'Credenciales inválidas' });

  const token = jwt.sign(
    { id: user._id, companyId: user.companyId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({
    message: 'Login exitoso',
    token,
    user: buildSafeUser(user), // ← incluye photoUrl
  });
};

exports.registerCompany = async (req, res) => {
  const { companyId, companyName, email, password, name, phone, photoUrl } = req.body;

  if (!companyId || !companyName || !email || !password) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }

  const existingCompany = await Company.findOne({ companyId });
  if (existingCompany) {
    return res.status(400).json({ message: 'La empresa ya existe' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: 'El usuario ya existe' });
  }

  const company = new Company({ companyId, name: companyName });
  await company.save();

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({
    email,
    password: hashedPassword,
    companyId,
    name,
    phone,
    photoUrl: photoUrl || DEFAULT_AVATAR,
  });
  await user.save();

  const token = jwt.sign(
    { id: user._id, companyId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.status(201).json({
    message: 'Empresa y usuario creados',
    token,
    user: buildSafeUser(user),
  });
};

/**
 * PUT /api/users/:userId/photo
 * Body: { photoUrl: "https://..." }
 * Auth: Bearer <token>
 */
exports.updatePhotoUrl = async (req, res) => {
  const { userId } = req.params;
  const { photoUrl } = req.body;

  if (!photoUrl) {
    return res.status(400).json({ message: 'Falta la URL de la foto' });
  }

  const updated = await User.findByIdAndUpdate(
    userId,
    { photoUrl },
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: 'Usuario no encontrado' });

  res.json({ message: 'Foto actualizada', user: buildSafeUser(updated) });
};
