const express = require("express");
const router = express.Router();
const { UserCreateRequest } = require("../controllers/userRequest.controlller");

router.post("/", UserCreateRequest);
router.post("/UserCreateRequest", UserCreateRequest);

module.exports = router;
