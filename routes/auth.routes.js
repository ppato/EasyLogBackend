const express = require('express');
const router = express.Router();

const {
  register,
  login,
  registerCompany,
  registerUserInCompany // opcional
} = require('../controllers/auth.controller');

const verifyToken = require('../middlewares/verifyToken');

router.post('/register-company', registerCompany);
router.post('/register', register);
router.post('/login', login);

module.exports = router;
