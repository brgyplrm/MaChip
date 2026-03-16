const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendance.controller.js");

// URL will be: http://localhost:3000/api/attendance/mark
router.post("/mark", attendanceController.markAttendance);

router.get("/occupancy", attendanceController.getOfficeOccupancy);

router.get("/logs/:user_Id", attendanceController.viewUserLogs);

router.get("/all", attendanceController.viewAllAttendance);

router.get("/status/:user_Id", attendanceController.StatusLogic);

router.get("/monthly-stats", attendanceController.getMonthlyAttendanceStats);

router.delete("/all", attendanceController.deleteAllLogs);

router.get("/stats", attendanceController.getDashboardStats);

module.exports = router;
