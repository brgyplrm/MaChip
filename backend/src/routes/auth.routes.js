const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller.js');
const { loginLimiter, verifyLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');

const authMiddleware = require('../middleware/auth');

// URL will be: http://localhost:4000/api/auth/login
router.post('/login', loginLimiter, authController.loginUser);

// URL will be: http://localhost:4000/api/auth/logout
router.post('/logout', authController.logoutUser);

// URL will be: http://localhost:4000/api/auth/verify
router.get('/verify', authMiddleware, authController.verifySession);

// URL will be: http://localhost:4000/api/auth/verify-password
router.post('/verify-password', authMiddleware, verifyLimiter, authController.verifyPassword);

// First login password setup
router.post('/set-initial-password', authMiddleware, verifyLimiter, authController.setInitialPassword);

// Self-service password reset routes (public with dedicated rate limiting)
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.get('/verify-reset-token/:token', passwordResetLimiter, authController.verifyResetToken);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);

module.exports = router;