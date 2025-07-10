const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  companyId: { type: String, required: true },
  name:      { type: String },
  phone:     { type: String },
  photoUrl:  { type: String }  // 👈 URL de la imagen de perfil
});

module.exports = mongoose.model('User', userSchema);
