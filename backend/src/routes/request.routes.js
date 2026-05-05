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
} = require("../controllers/userRequest.controlller");
const { requireOps, requireStaff } = require("../middleware/roleCheck.js");
const upload = require("../middleware/upload");

router.post("/", upload.single("proofFile"), UserCreateRequest);
router.post(
  "/UserCreateRequest",
  upload.single("proofFile"),
  UserCreateRequest,
);
router.get("/all", requireStaff, GetAllRequests);
router.get("/calendar-report", requireStaff, getCalendarReport);
router.get("/pending-count", requireStaff, GetPendingCount);
router.get("/summary/:year", requireStaff, getLeaveSummary);
router.get("/balance/:userId", requireStaff, GetLeaveBalance);
router.get("/details/:requestId", requireStaff, GetRequestDetails);
router.get("/:userId", GetUserRequests);
router.put("/update-status", requireOps, UpdateStatusRequest);
router.delete("/delete/:requestId", DeleteRequest);

module.exports = router;
