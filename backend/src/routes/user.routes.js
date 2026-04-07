const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller.js");
const rfidController = require("../controllers/rfid.controller.js");
const authController = require("../controllers/auth.controller.js");
const upload = require("../middleware/upload.js");

// URL will be: http://localhost:4000/api/users/registerUser
router.post("/registerUser", upload.single("user_ProfilePic"), userController.registerUser);

// Logout
router.post("/logout", authController.logoutUser);

// Get the next auto-incremented user ID
router.get("/nextId", userController.getNextUserId);

// Route for generating RFID
router.get("/generateRfid", rfidController.generateRfid);

// This creates the URL: http://localhost:4000/api/users/all
router.get("/all", userController.viewAllUsers);

// GET archived users (soft-deleted)
router.get("/archived", userController.viewArchivedUsers);

// GET user by user_Id
router.get("/:user_Id", userController.viewUserById);
// DELETE user by user_Id (soft delete — sets deletedAt)
router.delete("/deleteUser/:user_Id", userController.deleteUser);

// Password Reset Request
router.post("/request-password-reset", userController.requestPasswordReset);

// Force Delete

// RESTORE a soft-deleted user (clears deletedAt)
router.patch("/restoreUser/:user_Id", userController.restoreUser);

// PERMANENTLY delete a user (hard delete, cannot be undone)
router.delete("/forceDelete/:user_Id", userController.forceDeleteUser);

//UPDATE user by user_Id
router.put("/updateUser/:user_Id", upload.single("user_ProfilePic"), userController.updateUser);

// GET employee masterlist with daily rate columns
router.get("/employees/masterlist", userController.getMasterlist);

// PATCH employee daily rate
router.patch("/employees/:user_Id/daily-rate", userController.updateDailyRate);

module.exports = router;