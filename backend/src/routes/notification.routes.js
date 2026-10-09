const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const authMiddleware = require("../middleware/auth.js");
const { requireSelfOrStaff } = require("../middleware/roleCheck.js");

router.get("/unread-count/:userId", authMiddleware, requireSelfOrStaff("userId"), notificationController.GetUnreadCount);
router.get("/:userId", authMiddleware, requireSelfOrStaff("userId"), notificationController.GetUserNotifications);
router.put("/mark-all-read", authMiddleware, notificationController.MarkAllAsRead);
router.put("/mark-read/:notifId", authMiddleware, notificationController.MarkAsRead);

module.exports = router;
