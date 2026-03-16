// payroll.routes.js
const express = require("express");
const router = express.Router();
const {
  generatePayroll,
  getPayrollByUser,
  getAllPayrolls,
  releasePayroll,
} = require("../controllers/payroll.controller");

router.post("/generate", generatePayroll);
router.get("/all", getAllPayrolls);
router.get("/user/:user_Id", getPayrollByUser);
router.put("/release/:payrollId", releasePayroll);

module.exports = router;
