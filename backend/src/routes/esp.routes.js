const express = require("express");
const router = express.Router();
const rfidController = require("../controllers/rfid.controller.js");

// Polled by ESP32 to check if enrollment is active
router.get("/fingerprint/session", rfidController.getFingerprintSession);

// Called by ESP32 to confirm enrollment success/fail and upload template
router.post("/fingerprint/confirm", rfidController.confirmFingerprintEnroll);

// Called by ESP32 to download a template for 2FA verification
router.get("/fingerprint/download/:uid", rfidController.getFingerprintTemplate);

module.exports = router;
