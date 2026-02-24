const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller.js');

// URL will be: http://localhost:4000/api/users/registerUser
router.post('/registerUser', userController.registerUser);

// Get the next auto-incremented user ID
router.get('/nextId', userController.getNextUserId);

// Route for generating RFID
router.get('/generateRfid', userController.generateRfid);

// This creates the URL: http://localhost:4000/api/users/all
router.get('/all', userController.viewAllUsers);

// GET user by user_Id
router.get('/:user_Id', userController.viewUserById);

// DELETE user by user_Id
router.delete('/deleteUser/:user_Id', userController.deleteUser);

//UPDATE user by user_Id
router.put('/updateUser/:user_Id', userController.updateUser);

module.exports = router;