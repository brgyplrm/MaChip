const { logAudit, getClientIp, formatUserNumber } = require("../utils/logger");

/**
 * requestLogger — Automatically logs every API request to the Audit_Log.
 * Prints detailed VSCode debug log trace with IP, User Number, Timestamp, and Action.
 */
const EXPLICIT_AUDITED_PATTERNS = [
  /^\/updateUser/i,
  /^\/registerUser/i,
  /^\/deleteUser/i,
  /^\/restoreUser/i,
  /^\/forceDelete/i,
  /^\/batch-register/i,
  /^\/bulk-maxicare/i,
  /^\/daily-rate/i,
  /^\/login/i,
  /^\/logout/i,
  /^\/forgot-password/i,
  /^\/reset-password/i,
  /^\/verify-password/i,
  /^\/updateLogs/i,
  /^\/status\/\d+/i
];

const requestLogger = async (req, res, next) => {
  if (req.user && req.method !== "GET") {
    const isExplicitlyAudited = EXPLICIT_AUDITED_PATTERNS.some(p => p.test(req.path));

    if (!isExplicitlyAudited) {
      const module = req.baseUrl.split("/").pop() || "System";
      const action = `${req.method} ${req.path}`;
      const userNum = formatUserNumber(req.user.user_Id);
      const ip = getClientIp(req);
      const timeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });

      logAudit(
        req,
        req.user.user_Id,
        module.toUpperCase(),
        action,
        req.baseUrl ? req.baseUrl.replace("/api/", "") : "API",
        req.params?.id || req.params?.user_Id || req.body?.id || req.body?.user_Id || null,
        null,
        req.body
      );
    }
  }
  
  next();
};

module.exports = requestLogger;
