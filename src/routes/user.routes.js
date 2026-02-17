const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller.js');

// URL will be: http://localhost:3000/api/users/registerUser
router.post('/registerUser', userController.registerUser);

// This creates the URL: http://localhost:3000/api/users/all
router.get('/all', userController.viewAllUsers);

module.exports = router;