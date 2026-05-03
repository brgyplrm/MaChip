const express = require("express");
const router = express.Router();
const rfidController = require("../controllers/rfid.controller.js");
const espValidator = require("../middleware/espValidator.js");

// POST /api/rfid/scan
router.post("/scan", espValidator, rfidController.scanRFID);

module.exports = router;

