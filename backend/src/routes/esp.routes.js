const express = require("express");
const router = express.Router();
const rfidController = require("../controllers/rfid.controller.js");

// Polled by ESP32 to check if enrollment is active
router.get("/fingerprint/session", rfidController.getFingerprintSession);

// Called by ESP32 to confirm enrollment success/fail
router.post("/fingerprint/confirm", rfidController.confirmFingerprintEnroll);

module.exports = router;
