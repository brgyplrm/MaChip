const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");

router.get("/:userId", notificationController.GetUserNotifications);
router.get("/unread-count/:userId", notificationController.GetUnreadCount);
router.put("/mark-all-read", notificationController.MarkAllAsRead);
router.put("/mark-read/:notifId", notificationController.MarkAsRead);

module.exports = router;
