const express = require("express");
const router = express.Router();
const hardwareController = require("../controllers/hardware.controller.js");
const { requireAdmin, requireRole, requireStaff } = require("../middleware/roleCheck.js");

const requireManager = requireRole(1, "Admin Manager");

// RFID Routes
router.get("/rfid/all", requireStaff, hardwareController.getAllRfidCards);
router.post("/rfid/assign", requireAdmin, hardwareController.assignRfidCard);
router.put("/rfid/revoke/:userId", requireManager, hardwareController.revokeRfidCard);

// Biometric Routes
router.get("/biometric/all", requireStaff, hardwareController.getAllFingerprints);
router.post("/biometric/assign", requireAdmin, hardwareController.assignFingerprint);
router.delete("/biometric/clear/:userId", requireManager, hardwareController.clearFingerprint);

module.exports = router;

