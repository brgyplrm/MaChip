const express = require("express");
const router = express.Router();
const systemController = require("../controllers/system.controller.js");
const { requireAdmin } = require("../middleware/roleCheck.js");

router.get("/settings", requireAdmin, systemController.getSystemSettings);
router.post("/settings", requireAdmin, systemController.updateSystemSettings);
router.get("/time", systemController.getSystemTime);
router.get("/holidays", systemController.getHolidays);
router.post("/holidays", requireAdmin, systemController.createHoliday);
router.delete("/holidays/:holidayId", requireAdmin, systemController.deleteHoliday);
router.post("/sync-holidays", requireAdmin, systemController.syncHolidays);

router.get("/payroll-periods", requireAdmin, systemController.getPayrollPeriods);
router.post("/payroll-periods", requireAdmin, systemController.createPayrollPeriod);

router.get("/audit-logs", requireAdmin, systemController.getAuditLogs);
router.get("/transaction-logs", requireAdmin, systemController.getTransactionLogs);

module.exports = router;
