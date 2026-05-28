const express = require("express");
const router = express.Router();
const hardwareController = require("../controllers/hardware.controller.js");
const { requireAdmin, requireStaff } = require("../middleware/roleCheck.js");

// RFID Routes
router.get("/rfid/all", requireStaff, hardwareController.getAllRfidCards);
router.post("/rfid/assign", requireStaff, hardwareController.assignRfidCard);
router.put("/rfid/revoke/:userId", requireStaff, hardwareController.revokeRfidCard);

// Biometric Routes
router.get("/biometric/all", requireStaff, hardwareController.getAllFingerprints);
router.post("/biometric/assign", requireStaff, hardwareController.assignFingerprint);
router.delete("/biometric/clear/:userId", requireStaff, hardwareController.clearFingerprint);

module.exports = router;
