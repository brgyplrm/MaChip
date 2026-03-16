const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller.js");
const upload = require("../middleware/upload.js");

// URL will be: http://localhost:4000/api/users/registerUser
router.post("/registerUser", upload.single("user_ProfilePic"), userController.registerUser);

// Get the next auto-incremented user ID
router.get("/nextId", userController.getNextUserId);

// Route for generating RFID
router.get("/generateRfid", userController.generateRfid);

// This creates the URL: http://localhost:4000/api/users/all
router.get("/all", userController.viewAllUsers);

// GET user by user_Id
router.get("/:user_Id", userController.viewUserById);

// DELETE user by user_Id (soft delete — sets deletedAt)
router.delete("/deleteUser/:user_Id", userController.deleteUser);

// RESTORE a soft-deleted user (clears deletedAt)
router.patch("/restoreUser/:user_Id", userController.restoreUser);

// PERMANENTLY delete a user (hard delete, cannot be undone)
router.delete("/forceDelete/:user_Id", userController.forceDeleteUser);

//UPDATE user by user_Id
router.put("/updateUser/:user_Id", upload.single("user_ProfilePic"), userController.updateUser);

module.exports = router;
