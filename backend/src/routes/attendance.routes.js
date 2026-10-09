const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendance.controller.js");
const espValidator = require("../middleware/espValidator.js");
const { requireAdmin, requireOps, requireSelfOrStaff } = require("../middleware/roleCheck.js");

// URL will be: http://localhost:3000/api/attendance/mark
// Allow both hardware (espValidator) and authenticated web users
router.post("/mark", (req, res, next) => {
    // If it's a hardware request (has x-esp32-key), use espValidator
    if (req.headers['x-esp32-key']) {
        return espValidator(req, res, next);
    }
    // Otherwise, it must be an authenticated user (already handled by app.use("/api", authMiddleware))
    next();
}, attendanceController.markAttendance);

router.get("/report", attendanceController.getAttendanceReport);
router.get("/report/summary", attendanceController.getSummaryReport);

router.get("/occupancy", attendanceController.getOfficeOccupancy);

router.get("/logs/:user_Id", requireSelfOrStaff("user_Id"), attendanceController.viewUserLogs);

router.get("/all", attendanceController.viewAllAttendance);

router.get("/status/:user_Id", attendanceController.StatusLogic);

router.get("/monthly-stats", attendanceController.getMonthlyAttendanceStats);
router.get("/monthly-stats/:user_Id", requireSelfOrStaff("user_Id"), attendanceController.getMonthlyAttendanceStatsByUser);
router.get("/employee-dashboard/:user_Id", requireSelfOrStaff("user_Id"), attendanceController.getEmployeeDashboardStats);

router.delete("/all", requireAdmin, attendanceController.deleteAllLogs);

router.get("/stats", attendanceController.getDashboardStats);

router.get("/overall-stats", attendanceController.getOverallAttendanceStats);

router.put("/update/:user_Id/:date", requireOps, attendanceController.updateAttendanceRecord);
router.get("/record/:user_Id/:date", requireOps, attendanceController.getSingleAttendanceRecord);

module.exports = router;
