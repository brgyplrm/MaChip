const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller.js');
const { loginLimiter } = require('../middleware/rateLimiter');

// URL will be: http://localhost:4000/api/auth/login
router.post('/login', loginLimiter, authController.loginUser);

// URL will be: http://localhost:4000/api/auth/logout
router.post('/logout', authController.logoutUser);

module.exports = router;