const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Company = require('../models/company.model');

exports.register = async (req, res) => {
  const { email, password, companyId, name, phone } = req.body;

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
    phone
  });
  await user.save();

  const token = jwt.sign(
    { id: user._id, companyId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.status(201).json({ message: 'Usuario registrado', token });
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

  res.json({ message: 'Login exitoso', token });
};

exports.registerCompany = async (req, res) => {
  const { companyId, companyName, email, password, name, phone } = req.body;

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
    phone
  });
  await user.save();

  const token = jwt.sign(
    { id: user._id, companyId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.status(201).json({ message: 'Empresa y usuario creados', token });
};
