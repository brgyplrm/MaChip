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
} = require("../controllers/userRequest.controlller");
const upload = require("../middleware/upload");

router.post("/", upload.single("proofFile"), UserCreateRequest);
router.post(
  "/UserCreateRequest",
  upload.single("proofFile"),
  UserCreateRequest,
);
router.get("/all", GetAllRequests);
router.get("/calendar-report", getCalendarReport);
router.get("/pending-count", GetPendingCount);
router.get("/balance/:userId", GetLeaveBalance);
router.get("/details/:requestId", GetRequestDetails);
router.get("/:userId", GetUserRequests);
router.put("/update-status", UpdateStatusRequest);
router.delete("/delete/:requestId", DeleteRequest);

module.exports = router;
