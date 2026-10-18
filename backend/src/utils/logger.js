const { sequelize } = require("../config/sequelize");
const { QueryTypes } = require("sequelize");
const { computeAuditEntryHash, GENESIS_AUDIT_HASH } = require("./encryption");

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
 * Logs an administrative action (Audit Trail) with cryptographic tamper-evident hash chaining.
 */
const logAudit = async (req, userId, module, action, table, id, oldVal, newVal) => {
  try {
    const ip = getClientIp(req);
    const resolvedUserId = userId || req?.user?.user_Id || null;
    const userNum = formatUserNumber(resolvedUserId);
    const timeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    
    console.log(`[AUDIT LOG] [${timeStr}] User: ${userNum} (ID: ${resolvedUserId || 'SYS'}) | IP: ${ip} | Action: ${action} | Target: ${table || 'N/A'} #${id || 'N/A'}`);

    // Sequential audit hash chaining inside transaction with advisory lock
    await sequelize.transaction(async (t) => {
      // 1. Serialize concurrent audit entries using transaction-scoped advisory lock
      await sequelize.query(`SELECT pg_advisory_xact_lock(987654321);`, { transaction: t });

      // 2. Fetch the predecessor entry_hash
      const [latest] = await sequelize.query(
        `SELECT "entry_hash" FROM "Audit_Log" ORDER BY "auditId" DESC LIMIT 1`,
        { type: QueryTypes.SELECT, transaction: t }
      );
      const previousHash = latest?.entry_hash || GENESIS_AUDIT_HASH;
      const nowIso = new Date().toISOString();

      // 3. Compute cryptographically tamper-evident entry_hash
      const entryHash = computeAuditEntryHash(previousHash, {
        user_Id: resolvedUserId,
        module,
        action,
        target_Table: table || null,
        target_Id: id ? String(id) : null,
        old_Value: oldVal,
        new_Value: newVal,
        ip_Address: ip,
        createdAt: nowIso
      });

      // 4. Insert row with cryptographic chain link
      await sequelize.query(
        `INSERT INTO "Audit_Log" ("user_Id", "module", "action", "target_Table", "target_Id", "old_Value", "new_Value", "ip_Address", "previous_hash", "entry_hash", "createdAt", "updatedAt")
         VALUES (:userId, :module, :action, :table, :id, :oldVal::jsonb, :newVal::jsonb, :ip, :previousHash, :entryHash, :createdAt, :createdAt)`,
        {
          replacements: {
            userId: resolvedUserId,
            module,
            action,
            table: table || null,
            id: id ? String(id) : null,
            ip: ip,
            oldVal: oldVal ? JSON.stringify(oldVal) : null,
            newVal: newVal ? JSON.stringify(newVal) : null,
            previousHash,
            entryHash,
            createdAt: nowIso
          },
          type: QueryTypes.INSERT,
          transaction: t
        }
      );
    });
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
