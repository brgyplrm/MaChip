const { sequelize } = require("../config/sequelize");
const { QueryTypes } = require("sequelize");

/**
 * Extracts and sanitizes the client IP address.
 */
const getClientIp = (req) => {
  if (!req) return null;
  let ip = req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || req.ip;
  if (ip && ip.includes(",")) {
    ip = ip.split(",")[0];
  }
  if (ip === "::1" || ip === "::ffff:127.0.0.1") {
    return "127.0.0.1";
  }
  return ip;
};

/**
 * Logs an administrative action (Audit Trail).
 */
const logAudit = async (req, userId, module, action, table, id, oldVal, newVal) => {
  try {
    const ip = getClientIp(req);
    await sequelize.query(
      `INSERT INTO "Audit_Log" ("user_Id", "module", "action", "target_Table", "target_Id", "old_Value", "new_Value", "ip_Address", "createdAt", "updatedAt")
       VALUES (:userId, :module, :action, :table, :id, :oldVal::jsonb, :newVal::jsonb, :ip, NOW(), NOW())`,
      {
        replacements: {
          userId,
          module,
          action,
          table: table || null,
          id: id || null,
          ip: ip,
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
const logTransaction = async (userId, adminId, type, desc, meta = null, req = null) => {
  try {
    const ip = getClientIp(req);
    await sequelize.query(
      `INSERT INTO "Transaction_Log" ("user_Id", "initiated_By", "event_Type", "description", "metadata", "ip_Address", "createdAt", "updatedAt")
       VALUES (:userId, :adminId, :type, :desc, :meta::jsonb, :ip, NOW(), NOW())`,
      {
        replacements: {
          userId: userId || null,
          adminId: adminId || null,
          type,
          desc,
          meta: meta ? JSON.stringify(meta) : null,
          ip: ip
        },
        type: QueryTypes.INSERT
      }
    );
  } catch (err) {
    console.error("[LOGGER] logTransaction failed:", err.message);
  }
};

module.exports = { logAudit, logTransaction };
