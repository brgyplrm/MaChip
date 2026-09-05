const express = require("express");
const router = express.Router();
const positionController = require("../controllers/position.controller");
const auth = require("../middleware/auth");
const { requireRole, requireAdmin } = require("../middleware/roleCheck");

router.get("/", auth, requireAdmin, positionController.getPositions);
router.get("/:id", auth, requireAdmin, positionController.getPositionById);
router.post("/", auth, requireRole(1, 4, "Admin Manager", "Admin Accountant"), positionController.createPosition);
router.put("/:id", auth, requireRole(1, 4, "Admin Manager", "Admin Accountant"), positionController.updatePosition);
router.delete("/:id", auth, requireRole(1, 4, "Admin Manager", "Admin Accountant"), positionController.deletePosition);

module.exports = router;
