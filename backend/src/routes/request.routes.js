const express = require("express");
const router = express.Router();
const {
  UserCreateRequest,
  GetUserRequests,
  GetAllRequests,
  UpdateStatusRequest,
  GetLeaveBalance,
  GetPendingCount,
  getPendingPreview,
  GetRequestDetails,
  getCalendarReport,
  DeleteRequest,
  getLeaveSummary,
  UpdateUserRequest,
  notifySupervisor,
  pingApprover,
} = require("../controllers/userRequest.controlller");
const { requireOps, requireStaff, requireRole, requireSelfOrStaff } = require("../middleware/roleCheck.js");
const authMiddleware = require("../middleware/auth.js");
const multer = require("multer");
const upload = require("../middleware/upload");

const uploadFields = (req, res, next) => {
  upload.fields([
    { name: "proofFile", maxCount: 5 },
    { name: "damageProofFile", maxCount: 5 }
  ])(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            error: "Too many files uploaded. Maximum 5 attachments allowed per field."
          });
        }
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: "File size exceeds the 10MB limit."
          });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

router.post("/", uploadFields, UserCreateRequest);
router.post(
  "/UserCreateRequest",
  uploadFields,
  UserCreateRequest,
);
router.get("/all", requireStaff, GetAllRequests);
router.get("/calendar-report", authMiddleware, getCalendarReport);
router.get("/report/calendar", authMiddleware, getCalendarReport);
router.get("/pending-count", requireStaff, GetPendingCount);
router.get("/pending-preview", requireStaff, getPendingPreview);
router.get("/summary/:year", requireStaff, getLeaveSummary);
router.get("/balance/:userId", (req, res, next) => {
  if (req.user.user_Id == req.params.userId) {
    return next();
  }
  requireStaff(req, res, next);
}, GetLeaveBalance);
router.get("/details/:requestId", authMiddleware, GetRequestDetails);
router.get("/:userId", requireSelfOrStaff("userId"), GetUserRequests);
router.put("/update-status", requireOps, UpdateStatusRequest);
router.put("/update/:requestId", authMiddleware, UpdateUserRequest);
router.post("/notify-supervisor/:requestId", authMiddleware, notifySupervisor);
router.post("/ping-approver/:requestId", requireStaff, pingApprover);
router.post("/:requestId/ping-approver", requireStaff, pingApprover);
router.delete("/delete/:requestId", authMiddleware, DeleteRequest);

module.exports = router;
