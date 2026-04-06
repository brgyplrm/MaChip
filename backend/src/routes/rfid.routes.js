const express = require("express");
const router = express.Router();
const rfidController = require("../controllers/rfid.controller.js");

// POST /api/rfid/scan
router.post("/scan", rfidController.scanRFID);

module.exports = router;
