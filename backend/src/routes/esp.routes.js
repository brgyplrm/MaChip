const express = require("express");
const router = express.Router();
const rfidController = require("../controllers/rfid.controller.js");
const espValidator = require("../middleware/espValidator.js");
const authMiddleware = require("../middleware/auth.js");

// Polled by ESP32 to check if enrollment is active
router.get("/fingerprint/session", espValidator, rfidController.getFingerprintSession);

// Called by frontend to initialize session
router.post("/fingerprint/session", authMiddleware, rfidController.getFingerprintSession);

// Clear the current enrollment session (Frontend/ESP32 clear)
router.post("/fingerprint/session/clear", authMiddleware, rfidController.clearFingerprintSession);
router.get("/fingerprint/session/clear", espValidator, rfidController.clearFingerprintSession); // To support ESP32's GET request

// Get current enrollment session status
router.get("/fingerprint/session/status", authMiddleware, rfidController.getSessionStatus);

// Called by UI to check hardware connection status
router.get("/status", authMiddleware, rfidController.getHardwareStatus);

// Factory Reset Hardware (Clear all fingerprints)
router.post("/factory-reset", authMiddleware, rfidController.factoryResetHardware);

// Called by ESP32 to confirm enrollment success/fail and upload template
router.post("/fingerprint/confirm", espValidator, rfidController.confirmFingerprintEnroll);
router.post("/fingerprint/enroll-confirm", espValidator, rfidController.confirmFingerprintEnroll);

// Called by ESP32 to download a template for 2FA verification
router.get("/fingerprint/download/:uid", espValidator, rfidController.getFingerprintTemplate);

// Visitor Access Routes
router.post("/visitor-access", authMiddleware, rfidController.triggerVisitorAccess);
router.post("/visitor-access/confirm", espValidator, rfidController.confirmVisitorAccess);

module.exports = router;
