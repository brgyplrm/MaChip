// payroll.routes.js
const express = require("express");
const router = express.Router();
const {
  generatePayroll,
  getPayrollPreview,
  getPayrollByUser,
  getAllPayrolls,
  releasePayroll,
  getPayrollById,
  updatePayroll,
  getPayrollReport,
} = require("../controllers/payroll.controller");

router.post("/generate", generatePayroll);
router.get("/preview", getPayrollPreview);
router.get("/all", getAllPayrolls);
router.get("/report", getPayrollReport);
router.get("/user/:user_Id", getPayrollByUser);
router.get("/:payrollId", getPayrollById);
router.put("/update/:payrollId", updatePayroll);
router.put("/release/:payrollId", releasePayroll);

module.exports = router;
