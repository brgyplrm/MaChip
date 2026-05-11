const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller.js");
const rfidController = require("../controllers/rfid.controller.js");
const authController = require("../controllers/auth.controller.js");
const upload = require("../middleware/upload.js");
const { requireAdmin, requireStaff } = require("../middleware/roleCheck.js");

// URL will be: http://localhost:4000/api/users/registerUser
router.post("/registerUser", requireAdmin, upload.single("user_ProfilePic"), userController.registerUser);

// Get the next auto-incremented user ID
router.get("/nextId", requireAdmin, userController.getNextUserId);

// Route for generating RFID
router.get("/generateRfid", requireAdmin, rfidController.generateRfid);

// Route for generating Fingerprint
router.get("/generateFingerprint", requireAdmin, rfidController.generateFingerprint);

// Clear Fingerprint Session
router.delete("/clear-fingerprint-session", requireAdmin, rfidController.clearFingerprintSession);

// This creates the URL: http://localhost:4000/api/users/all
router.get("/all", requireStaff, userController.viewAllUsers);

// GET archived users (soft-deleted)
router.get("/archived", requireAdmin, userController.viewArchivedUsers);

// GET user by user_Id
router.get("/:user_Id", userController.viewUserById);
// DELETE user by user_Id (soft delete — sets deletedAt)
router.delete("/deleteUser/:user_Id", requireAdmin, userController.deleteUser);

// Password Reset Request
router.post("/request-password-reset", userController.requestPasswordReset);

// Force Delete

// RESTORE a soft-deleted user (clears deletedAt)
router.patch("/restoreUser/:user_Id", requireAdmin, userController.restoreUser);

// PERMANENTLY delete a user (hard delete, cannot be undone)
router.delete("/forceDelete/:user_Id", requireAdmin, userController.forceDeleteUser);

//UPDATE user by user_Id
router.put("/updateUser/:user_Id", requireAdmin, upload.single("user_ProfilePic"), userController.updateUser);

// Check if MaChip exists
router.get("/check-machip/:uid", requireAdmin, userController.checkMaChip);
// Check if Fingerprint slot exists
router.get("/check-fingerprint/:slot", requireAdmin, userController.checkFingerprint);

// GET employee masterlist with daily rate columns
router.get("/employees/masterlist", requireAdmin, userController.getMasterlist);

// PATCH employee daily rate
router.patch("/employees/:user_Id/daily-rate", requireAdmin, userController.updateDailyRate);

// Bulk Update Maxicare Deductions
router.patch("/bulk-maxicare", requireAdmin, userController.bulkUpdateMaxicare);

module.exports = router;