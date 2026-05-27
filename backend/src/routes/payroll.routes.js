// payroll.routes.js
const express = require("express");
const router = express.Router();
const payrollController = require("../controllers/payroll.controller");
const { requireAdmin, requireStaff } = require("../middleware/roleCheck.js");

// Management & Generation
router.post("/generate", requireAdmin, payrollController.generatePayroll);
router.post("/batch-generate", requireAdmin, payrollController.generateBatchPayroll);
router.get("/eligible-count", requireAdmin, payrollController.getEligibleEmployeesCount);
router.get("/preview", requireAdmin, payrollController.getPayrollPreview);
router.get("/govt-deductions-preview", requireAdmin, payrollController.getGovtDeductionsPreview);
router.get("/summary-pdf", requireAdmin, payrollController.downloadPayrollSummaryPDF);
router.get("/batch-zip", requireAdmin, payrollController.downloadBatchZip);
router.get("/summary-preview", requireAdmin, payrollController.getPayrollSummaryPreview);

// Specific Ledgers & History
router.get("/maxicare/history", requireAdmin, payrollController.getMaxicareHistory);
router.post("/maxicare/sync", requireAdmin, payrollController.syncMaxicareHistory);
router.get("/loans/history", requireAdmin, payrollController.getLoanHistory);
router.post("/loans/sync", requireAdmin, payrollController.syncLoanHistory);
router.get("/loans/active", requireAdmin, payrollController.getActiveLoans);
router.get("/loans/details/:id", requireAdmin, payrollController.getLoanById);

// 13th Month
router.get("/thirteenth-month/preview", requireAdmin, payrollController.getThirteenthMonthPreview);
router.post("/thirteenth-month/generate", requireAdmin, payrollController.generateThirteenthMonth);
router.post("/thirteenth-month/release", requireAdmin, payrollController.releaseThirteenthMonth);
router.get("/thirteenth-month/history", requireAdmin, payrollController.getThirteenthMonthHistory);

// Separation Pay
router.get("/separation/preview", requireAdmin, payrollController.getSeparationPayPreview);
router.get("/separation/causes", requireAdmin, payrollController.getSeparationCauses);
router.post("/separation/generate", requireAdmin, payrollController.generateSeparationPay);
router.put("/separation/release/:separationId", requireAdmin, payrollController.releaseSeparationPay);
router.delete("/separation/cancel/:separationId", requireAdmin, payrollController.cancelSeparationPay);
router.get("/separation/history", requireAdmin, payrollController.getSeparationPayHistory);

// Retirement Pay
router.get("/retirement/preview", requireAdmin, payrollController.getRetirementPayPreview);
router.post("/retirement/generate", requireAdmin, payrollController.generateRetirementPay);
router.put("/retirement/release/:retirementId", requireAdmin, payrollController.releaseRetirementPay);
router.put("/retirement/update-date/:retirementId", requireAdmin, payrollController.updateRetirementDate);
router.get("/retirement/history", requireAdmin, payrollController.getRetirementPayHistory);

// User Records & Updates
router.get("/all", requireStaff, payrollController.getAllPayrolls);
router.get("/report", requireAdmin, payrollController.getPayrollReport);
router.get("/user/:user_Id", requireStaff, payrollController.getPayrollByUser);
router.get("/:payrollId", requireStaff, payrollController.getPayrollById);
router.put("/update/:payrollId", requireAdmin, payrollController.updatePayroll);
router.put("/update-full/:payrollId", requireAdmin, payrollController.updatePayrollFull);
router.put("/release/:payrollId", requireAdmin, payrollController.releasePayroll);
router.post("/resend-email/:payrollId", requireAdmin, payrollController.resendPayrollEmail);

module.exports = router;
