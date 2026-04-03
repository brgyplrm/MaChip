const express = require("express");
const router = express.Router();
const systemController = require("../controllers/system.controller.js");

router.get("/settings", systemController.getSystemSettings);
router.post("/settings", systemController.updateSystemSettings);
router.get("/time", systemController.getSystemTime);
router.get("/holidays", systemController.getHolidays);
router.post("/holidays", systemController.createHoliday);
router.delete("/holidays/:holidayId", systemController.deleteHoliday);
router.post("/sync-holidays", systemController.syncHolidays);

router.get("/payroll-periods", systemController.getPayrollPeriods);
router.post("/payroll-periods", systemController.createPayrollPeriod);

router.get("/audit-logs", systemController.getAuditLogs);
router.get("/transaction-logs", systemController.getTransactionLogs);

module.exports = router;
