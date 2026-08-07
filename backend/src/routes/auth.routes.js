const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller.js');
const { loginLimiter } = require('../middleware/rateLimiter');

const authMiddleware = require('../middleware/auth');

// URL will be: http://localhost:4000/api/auth/login
router.post('/login', loginLimiter, authController.loginUser);

// URL will be: http://localhost:4000/api/auth/logout
router.post('/logout', authController.logoutUser);

// URL will be: http://localhost:4000/api/auth/verify-password
router.post('/verify-password', authMiddleware, authController.verifyPassword);

module.exports = router;