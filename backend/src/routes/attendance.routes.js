const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller.js');

// URL will be: http://localhost:3000/api/attendance/mark
router.post('/mark', attendanceController.markAttendance);

module.exports = router;