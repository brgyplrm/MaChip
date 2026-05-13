const express = require("express");
const router = express.Router();
const systemController = require("../controllers/system.controller.js");
const { requireAdmin, requireMaster, requireRole } = require("../middleware/roleCheck.js");
const authMiddleware = require("../middleware/auth.js");

router.get("/settings", requireAdmin, systemController.getSystemSettings);
router.post("/settings", requireRole(1, 4, "Admin Manager", "Admin Accountant"), systemController.updateSystemSettings);
router.get("/time", systemController.getSystemTime);
router.get("/holidays", authMiddleware, systemController.getHolidays);
router.post("/holidays", requireRole(1, 4, "Admin Manager", "Admin Accountant"), systemController.createHoliday);
router.put("/holidays/:holidayId", requireRole(1, 4, "Admin Manager", "Admin Accountant"), systemController.updateHoliday);
router.delete("/holidays/:holidayId", requireRole(1, 4, "Admin Manager", "Admin Accountant"), systemController.deleteHoliday);
router.post("/sync-holidays", requireRole(1, 4, "Admin Manager", "Admin Accountant"), systemController.syncHolidays);

router.get("/payroll-periods", systemController.getPayrollPeriods);
router.post("/payroll-periods", requireAdmin, systemController.createPayrollPeriod);

router.get("/audit-logs", requireMaster, systemController.getAuditLogs);
router.get("/transaction-logs", requireMaster, systemController.getTransactionLogs);

router.post("/reg-session", requireAdmin, systemController.setRegistrationSession);
router.delete("/reg-session", requireAdmin, systemController.clearRegistrationSession);

module.exports = router;
