const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller.js');

// URL will be: http://localhost:3000/api/users/add-temp
router.post('/add-temp', userController.createTempUser);

module.exports = router;