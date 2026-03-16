const { sequelize } = require("../config/sequelize");
const { QueryTypes } = require("sequelize");

exports.GetUserNotifications = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "User Id is required" });
  }

  try {
    const notifications = await sequelize.query(
      `SELECT * FROM "Notification" WHERE "user_Id" = :userId ORDER BY "createdAt" DESC`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    );

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
    await sequelize.query(
      `UPDATE "Notification" SET "isRead" = true WHERE "notifId" = :notifId`,
      {
        replacements: { notifId },
        type: QueryTypes.UPDATE,
      }
    );

    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.GetUnreadCount = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "User Id is required" });
  }

  try {
    const result = await sequelize.query(
      `SELECT COUNT(*) as count FROM "Notification" WHERE "user_Id" = :userId AND "isRead" = false`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    );

    res.status(200).json({ count: parseInt(result[0].count) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
