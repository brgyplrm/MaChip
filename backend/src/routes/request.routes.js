const express = require("express");
const router = express.Router();
const {
  UserCreateRequest,
  GetUserRequests,
  GetAllRequests,
  UpdateStatusRequest,
  GetLeaveBalance,
  GetPendingCount,
  GetRequestDetails,
  getCalendarReport,
  DeleteRequest,
  getLeaveSummary,
  UpdateUserRequest,
  notifySupervisor,
  pingApprover,
} = require("../controllers/userRequest.controlller");
const { requireOps, requireStaff, requireRole } = require("../middleware/roleCheck.js");
const authMiddleware = require("../middleware/auth.js");
const upload = require("../middleware/upload");

const uploadFields = upload.fields([
  { name: "proofFile", maxCount: 1 },
  { name: "damageProofFile", maxCount: 1 }
]);

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
router.get("/summary/:year", requireStaff, getLeaveSummary);
router.get("/balance/:userId", (req, res, next) => {
  if (req.user.user_Id == req.params.userId) {
    return next();
  }
  requireStaff(req, res, next);
}, GetLeaveBalance);
router.get("/details/:requestId", authMiddleware, GetRequestDetails);
router.get("/:userId", GetUserRequests);
router.put("/update-status", requireOps, UpdateStatusRequest);
router.put("/update/:requestId", authMiddleware, UpdateUserRequest);
router.post("/notify-supervisor/:requestId", authMiddleware, notifySupervisor);
router.post("/ping-approver/:requestId", requireStaff, pingApprover);
router.post("/:requestId/ping-approver", requireStaff, pingApprover);
router.delete("/delete/:requestId", DeleteRequest);

module.exports = router;
