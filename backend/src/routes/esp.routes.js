const express = require("express");
const router = express.Router();
const rfidController = require("../controllers/rfid.controller.js");
const espValidator = require("../middleware/espValidator.js");

// Polled by ESP32 to check if enrollment is active
router.get("/fingerprint/session", espValidator, rfidController.getFingerprintSession);

// Called by ESP32 to confirm enrollment success/fail and upload template
router.post("/fingerprint/confirm", espValidator, rfidController.confirmFingerprintEnroll);

// Called by ESP32 to download a template for 2FA verification
router.get("/fingerprint/download/:uid", espValidator, rfidController.getFingerprintTemplate);

module.exports = router;
