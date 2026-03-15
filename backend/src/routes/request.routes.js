const express = require("express");
const router = express.Router();
const { UserCreateRequest, GetUserRequests, GetAllRequests, UpdateStatusRequest } = require("../controllers/userRequest.controlller");

router.post("/", UserCreateRequest);
router.post("/UserCreateRequest", UserCreateRequest);
router.get("/all", GetAllRequests);
router.get("/:userId", GetUserRequests);
router.put("/update-status", UpdateStatusRequest);

module.exports = router;
