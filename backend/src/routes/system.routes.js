const express = require("express");
const router = express.Router();
const systemController = require("../controllers/system.controller.js");

router.get("/settings", systemController.getSystemSettings);
router.post("/settings", systemController.updateSystemSettings);
router.get("/time", systemController.getSystemTime);
router.get("/holidays", systemController.getHolidays);
router.post("/sync-holidays", systemController.syncHolidays);

module.exports = router;
