const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller.js');

// URL will be: http://localhost:4000/api/auth/login
router.post('/login', authController.loginUser);

// URL will be: http://localhost:4000/api/auth/logout
router.post('/logout', authController.logoutUser);

module.exports = router;