const { sequelize } = require("../config/sequelize");
const { QueryTypes } = require("sequelize");

/**
 * Extracts and sanitizes the client IP address.
 */
const getClientIp = (req) => {
  if (!req) return "127.0.0.1";
  let ip =
    req.headers?.["x-forwarded-for"] ||
    req.headers?.["x-real-ip"] ||
    req.ip ||
    req.socket?.remoteAddress;

  if (typeof ip === "string" && ip.includes(",")) {
    ip = ip.split(",")[0].trim();
  }
  if (!ip) return "127.0.0.1";
  ip = String(ip).replace(/^::ffff:/, "");
  if (ip === "::1") return "127.0.0.1";
  return ip;
};

/**
 * Formats user ID to MAChip User Number (MACJ-001).
 */
const formatUserNumber = (userId) => {
  if (!userId) return "SYS-000";
  const num = parseInt(userId, 10);
  if (isNaN(num)) return String(userId);
  return `MACJ-${String(num).padStart(3, "0")}`;
};

/**
 * Logs an administrative action (Audit Trail).
 */
const logAudit = async (req, userId, module, action, table, id, oldVal, newVal) => {
  try {
    const ip = getClientIp(req);
    const resolvedUserId = userId || req?.user?.user_Id || null;
    const userNum = formatUserNumber(resolvedUserId);
    const timeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    
    console.log(`[AUDIT LOG] [${timeStr}] User: ${userNum} (ID: ${resolvedUserId || 'SYS'}) | IP: ${ip} | Action: ${action} | Target: ${table || 'N/A'} #${id || 'N/A'}`);

    await sequelize.query(
      `INSERT INTO "Audit_Log" ("user_Id", "module", "action", "target_Table", "target_Id", "old_Value", "new_Value", "ip_Address", "createdAt", "updatedAt")
       VALUES (:userId, :module, :action, :table, :id, :oldVal::jsonb, :newVal::jsonb, :ip, NOW(), NOW())`,
      {
        replacements: {
          userId: resolvedUserId,
          module,
          action,
          table: table || null,
          id: id ? String(id) : null,
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
    const resolvedUserId = userId || null;
    const resolvedAdminId = adminId || req?.user?.user_Id || null;
    const adminNum = formatUserNumber(resolvedAdminId);
    const targetNum = resolvedUserId ? formatUserNumber(resolvedUserId) : null;
    const timeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });

    console.log(`[TRANSACTION LOG] [${timeStr}] Initiator: ${adminNum} | Target User: ${targetNum || 'N/A'} | IP: ${ip} | Event: ${type} | Desc: "${desc}"`);

    await sequelize.query(
      `INSERT INTO "Transaction_Log" ("user_Id", "initiated_By", "event_Type", "description", "metadata", "ip_Address", "createdAt", "updatedAt")
       VALUES (:userId, :adminId, :type, :desc, :meta::jsonb, :ip, NOW(), NOW())`,
      {
        replacements: {
          userId: resolvedUserId,
          adminId: resolvedAdminId,
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

module.exports = { logAudit, logTransaction, getClientIp, formatUserNumber };
