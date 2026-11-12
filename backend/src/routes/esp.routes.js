const express = require("express");
const router = express.Router();
const rfidController = require("../controllers/rfid.controller.js");
const espValidator = require("../middleware/espValidator.js");
const authMiddleware = require("../middleware/auth.js");
const { requireRole } = require("../middleware/roleCheck.js");

// Polled by ESP32 to check if enrollment is active
router.get("/fingerprint/session", espValidator, rfidController.getFingerprintSession);

// Check biometric slot status for dynamic orphan auto-pruning
router.get("/fingerprint/slot-status", espValidator, rfidController.getSlotStatus);

// Called by frontend to initialize session
router.post("/fingerprint/session", authMiddleware, rfidController.getFingerprintSession);

// Clear the current enrollment session (Frontend/ESP32 clear)
router.post("/fingerprint/session/clear", authMiddleware, rfidController.clearFingerprintSession);
router.get("/fingerprint/session/clear", espValidator, rfidController.clearFingerprintSession); // To support ESP32's GET request

// Get current enrollment session status
router.get("/fingerprint/session/status", authMiddleware, rfidController.getSessionStatus);

// Called by UI or ESP32 to check hardware connection status
router.get("/status", (req, res, next) => {
  const espKey = req.headers["x-esp32-key"];
  const expectedKey = process.env.ESP32_API_KEY;
  if (expectedKey && espKey && espKey === expectedKey) {
    return next();
  }
  return authMiddleware(req, res, next);
}, rfidController.getHardwareStatus);

// Factory Reset Hardware: Strictly restricted to Admin Manager (Role 1)
router.post("/factory-reset", authMiddleware, requireRole(1, "Admin Manager"), rfidController.factoryResetHardware);

// Called by ESP32 to confirm enrollment success/fail and upload template
router.post("/fingerprint/confirm", espValidator, rfidController.confirmFingerprintEnroll);
router.post("/fingerprint/enroll-confirm", espValidator, rfidController.confirmFingerprintEnroll);

// Called by ESP32 to download a template for 2FA verification
router.get("/fingerprint/download/:uid", espValidator, rfidController.getFingerprintTemplate);

// Visitor Access Routes (Restricted to Management: Role 1 and 4)
router.post("/visitor-access", authMiddleware, requireRole(1, 4, "Admin Manager", "Admin Accountant"), rfidController.triggerVisitorAccess);
router.post("/visitor-access/confirm", espValidator, rfidController.confirmVisitorAccess);

// Telemetry Endpoint: Accepts ESP32 hardware with HMAC or authenticated Admin for simulation
router.post("/telemetry", (req, res, next) => {
  if (req.headers["x-esp32-key"]) {
    return espValidator(req, res, next);
  }
  return authMiddleware(req, res, (err) => {
    if (err) return next(err);
    requireRole(1, 4, "Admin Manager", "Admin Accountant")(req, res, next);
  });
}, rfidController.receiveTelemetry);

module.exports = router;

