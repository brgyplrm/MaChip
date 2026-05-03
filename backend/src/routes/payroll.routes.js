// payroll.routes.js
const express = require("express");
const router = express.Router();
const {
  generatePayroll,
  generateBatchPayroll,
  getEligibleEmployeesCount,
  getPayrollPreview,
  getPayrollByUser,
  getAllPayrolls,
  releasePayroll,
  getPayrollById,
  updatePayroll,
  getPayrollReport,
  getGovtDeductionsPreview,
  downloadPayrollSummaryPDF,
  getPayrollSummaryPreview,
  updatePayrollFull,
  getMaxicareHistory,
  syncMaxicareHistory,
  getLoanHistory,
  syncLoanHistory,
} = require("../controllers/payroll.controller");
const { requireAdmin } = require("../middleware/roleCheck.js");

router.post("/generate", requireAdmin, generatePayroll);
router.post("/batch-generate", requireAdmin, generateBatchPayroll);
router.get("/eligible-count", requireAdmin, getEligibleEmployeesCount);
router.get("/preview", requireAdmin, getPayrollPreview);
router.get("/govt-deductions-preview", requireAdmin, getGovtDeductionsPreview);
router.get("/summary-pdf", requireAdmin, downloadPayrollSummaryPDF);
router.get("/summary-preview", requireAdmin, getPayrollSummaryPreview);
router.get("/maxicare/history", requireAdmin, getMaxicareHistory);
router.post("/maxicare/sync", requireAdmin, syncMaxicareHistory);
router.get("/loans/history", requireAdmin, getLoanHistory);
router.post("/loans/sync", requireAdmin, syncLoanHistory);
router.get("/all", requireAdmin, getAllPayrolls);
router.get("/report", requireAdmin, getPayrollReport);
router.get("/user/:user_Id", requireAdmin, getPayrollByUser);
router.get("/:payrollId", requireAdmin, getPayrollById);
router.put("/update/:payrollId", requireAdmin, updatePayroll);
router.put("/update-full/:payrollId", requireAdmin, updatePayrollFull);
router.put("/release/:payrollId", requireAdmin, releasePayroll);

module.exports = router;
