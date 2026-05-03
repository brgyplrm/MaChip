const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendance.controller.js");
const espValidator = require("../middleware/espValidator.js");

// URL will be: http://localhost:3000/api/attendance/mark
router.post("/mark", espValidator, attendanceController.markAttendance);

router.get("/report", attendanceController.getAttendanceReport);

router.get("/occupancy", attendanceController.getOfficeOccupancy);

router.get("/logs/:user_Id", attendanceController.viewUserLogs);

router.get("/all", attendanceController.viewAllAttendance);

router.get("/status/:user_Id", attendanceController.StatusLogic);

router.get("/monthly-stats", attendanceController.getMonthlyAttendanceStats);
router.get("/monthly-stats/:user_Id", attendanceController.getMonthlyAttendanceStatsByUser);
router.get("/employee-dashboard/:user_Id", attendanceController.getEmployeeDashboardStats);

router.delete("/all", attendanceController.deleteAllLogs);

router.get("/stats", attendanceController.getDashboardStats);

router.put("/update/:user_Id/:date", attendanceController.updateAttendanceRecord);
router.get("/record/:user_Id/:date", attendanceController.getSingleAttendanceRecord);

module.exports = router;
