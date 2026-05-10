/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { registerRules, loginRules, validate } = require('../middleware/validation');

router.post('/register', registerRules, validate, register);
router.post('/login', loginRules, validate, login);
router.get('/me', authenticate, getMe);

module.exports = router;
