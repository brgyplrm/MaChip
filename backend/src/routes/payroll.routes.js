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
  downloadBatchZip,
  getPayrollSummaryPreview,
  updatePayrollFull,
  getMaxicareHistory,
  syncMaxicareHistory,
  getLoanHistory,
  syncLoanHistory,
  resendPayrollEmail,
  getThirteenthMonthPreview,
  generateThirteenthMonth,
  releaseThirteenthMonth,
  getThirteenthMonthHistory,
  getSeparationPayPreview,
  getSeparationCauses,
  generateSeparationPay,
  releaseSeparationPay,
  cancelSeparationPay,
  getSeparationPayHistory,
  getRetirementPayPreview,
  generateRetirementPay,
  releaseRetirementPay,
  updateRetirementDate,
  getRetirementPayHistory
} = require("../controllers/payroll.controller");
const { requireAdmin, requireStaff } = require("../middleware/roleCheck.js");

router.post("/generate", requireAdmin, generatePayroll);
router.post("/batch-generate", requireAdmin, generateBatchPayroll);
router.get("/eligible-count", requireAdmin, getEligibleEmployeesCount);
router.get("/preview", requireAdmin, getPayrollPreview);
router.get("/govt-deductions-preview", requireAdmin, getGovtDeductionsPreview);
router.get("/summary-pdf", requireAdmin, downloadPayrollSummaryPDF);
router.get("/batch-zip", requireAdmin, downloadBatchZip);
router.get("/summary-preview", requireAdmin, getPayrollSummaryPreview);
router.get("/maxicare/history", requireAdmin, getMaxicareHistory);
router.post("/maxicare/sync", requireAdmin, syncMaxicareHistory);
router.get("/loans/history", requireAdmin, getLoanHistory);
router.post("/loans/sync", requireAdmin, syncLoanHistory);
router.get("/thirteenth-month/preview", requireAdmin, getThirteenthMonthPreview);
router.post("/thirteenth-month/generate", requireAdmin, generateThirteenthMonth);
router.post("/thirteenth-month/release", requireAdmin, releaseThirteenthMonth);
router.get("/thirteenth-month/history", requireAdmin, getThirteenthMonthHistory);
router.get("/separation/preview", requireAdmin, getSeparationPayPreview);
router.get("/separation/causes", requireAdmin, getSeparationCauses);
router.post("/separation/generate", requireAdmin, generateSeparationPay);
router.put("/separation/release/:separationId", requireAdmin, releaseSeparationPay);
router.delete("/separation/cancel/:separationId", requireAdmin, cancelSeparationPay);
router.get("/separation/history", requireAdmin, getSeparationPayHistory);
router.get("/retirement/preview", requireAdmin, getRetirementPayPreview);
router.post("/retirement/generate", requireAdmin, generateRetirementPay);
router.put("/retirement/release/:retirementId", requireAdmin, releaseRetirementPay);
router.put("/retirement/update-date/:retirementId", requireAdmin, updateRetirementDate);
router.get("/retirement/history", requireAdmin, getRetirementPayHistory);
router.get("/all", requireStaff, getAllPayrolls);
router.get("/report", requireAdmin, getPayrollReport);
router.get("/user/:user_Id", requireStaff, getPayrollByUser);
router.get("/:payrollId", requireStaff, getPayrollById);
router.put("/update/:payrollId", requireAdmin, updatePayroll);
router.put("/update-full/:payrollId", requireAdmin, updatePayrollFull);
router.put("/release/:payrollId", requireAdmin, releasePayroll);
router.post("/resend-email/:payrollId", requireAdmin, resendPayrollEmail);

module.exports = router;
