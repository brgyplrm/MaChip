const { sequelize } = require("../config/sequelize");
const { QueryTypes } = require("sequelize");
const { getIO } = require("../config/socket");

exports.GetUserNotifications = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { viewMode } = req.query; // management or employee

  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid User Id" });
  }

  try {
    let query = `SELECT * FROM "Notification" WHERE "user_Id" = :userId`;
    let replacements = { userId };

    const managementTitles = [
      'New Request for Review', 
      'Final Approval Required', 
      'Unauthorized RFID Scan', 
      'Suspicious Activity Detected',
      'Password Reset Request',
      'Unauthorized scan',
      'Unrecognized card or scan',
      'Irregular logs'
    ];

    if (viewMode === "management") {
      // Management view: Show ONLY administrative/review notifications
      query += ` AND "title" IN (:managementTitles)`;
      replacements.managementTitles = managementTitles;
    } else {
      // Employee view: Show ONLY personal request status notifications
      // We exclude management titles to keep employee view personal
      query += ` AND "title" NOT IN (:managementTitles)`;
      replacements.managementTitles = managementTitles;
    }

    query += ` ORDER BY "createdAt" DESC`;

    const notifications = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    });

    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.MarkAllAsRead = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User Id is required" });
  }

  try {
    await sequelize.query(
      `UPDATE "Notification" SET "isRead" = true WHERE "user_Id" = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.UPDATE,
      }
    );

    // [SOCKET] Trigger real-time unread count update
    getIO().to(`user_${userId}`).emit("NOTIFICATION_UPDATE");

    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.MarkAsRead = async (req, res) => {
  const { notifId } = req.params;

  if (!notifId) {
    return res.status(400).json({ error: "Notification Id is required" });
  }

  try {
    const notif = await sequelize.query(`SELECT "user_Id" FROM "Notification" WHERE "notifId" = :notifId`, { replacements: { notifId }, type: QueryTypes.SELECT });
    
    await sequelize.query(
      `UPDATE "Notification" SET "isRead" = true WHERE "notifId" = :notifId`,
      {
        replacements: { notifId },
        type: QueryTypes.UPDATE,
      }
    );

    if (notif[0]) {
      getIO().to(`user_${notif[0].user_Id}`).emit("NOTIFICATION_UPDATE");
    }

    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.GetUnreadCount = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { viewMode } = req.query;

  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid User Id" });
  }

  try {
    let query = `SELECT COUNT(*) as count FROM "Notification" WHERE "user_Id" = :userId AND "isRead" = false`;
    let replacements = { userId };

    const managementTitles = [
      'New Request for Review', 
      'Final Approval Required', 
      'Unauthorized RFID Scan', 
      'Suspicious Activity Detected',
      'Password Reset Request',
      'Unauthorized scan',
      'Unrecognized card or scan',
      'Irregular logs'
    ];

    if (viewMode === "management") {
      query += ` AND "title" IN (:managementTitles)`;
      replacements.managementTitles = managementTitles;
    } else {
      query += ` AND "title" NOT IN (:managementTitles)`;
      replacements.managementTitles = managementTitles;
    }

    const result = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    });

    res.status(200).json({ count: parseInt(result[0].count) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
