const { sequelize } = require("../config/sequelize");
const { QueryTypes } = require("sequelize");

/**
 * Logs an administrative action (Audit Trail).
 */
const logAudit = async (req, userId, action, table, id, oldVal, newVal) => {
  try {
    await sequelize.query(
      `INSERT INTO "Audit_Log" ("user_Id", "action", "target_Table", "target_Id", "old_Value", "new_Value", "ip_Address", "createdAt", "updatedAt")
       VALUES (:userId, :action, :table, :id, :oldVal::jsonb, :newVal::jsonb, :ip, NOW(), NOW())`,
      {
        replacements: {
          userId,
          action,
          table: table || null,
          id: id || null,
          ip: req ? req.ip : null,
          oldVal: oldVal ? JSON.stringify(oldVal) : null,
          newVal: newVal ? JSON.stringify(newVal) : null
        },
        type: QueryTypes.INSERT
      }
    );
  } catch (err) {
    console.error("[LOGGER] logAudit failed:", err.message);
  }
};

/**
 * Logs a system or monetary transaction.
 */
const logTransaction = async (userId, adminId, type, desc, meta = null) => {
  try {
    await sequelize.query(
      `INSERT INTO "Transaction_Log" ("user_Id", "initiated_By", "event_Type", "description", "metadata", "createdAt", "updatedAt")
       VALUES (:userId, :adminId, :type, :desc, :meta::jsonb, NOW(), NOW())`,
      {
        replacements: {
          userId: userId || null,
          adminId: adminId || null,
          type,
          desc,
          meta: meta ? JSON.stringify(meta) : null
        },
        type: QueryTypes.INSERT
      }
    );
  } catch (err) {
    console.error("[LOGGER] logTransaction failed:", err.message);
  }
};

module.exports = { logAudit, logTransaction };
