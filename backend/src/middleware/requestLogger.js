const { logAudit, getClientIp, formatUserNumber } = require("../utils/logger");

/**
 * requestLogger — Automatically logs every API request to the Audit_Log.
 * Prints detailed VSCode debug log trace with IP, User Number, Timestamp, and Action.
 */
const requestLogger = async (req, res, next) => {
  if (req.user && req.method !== "GET") {
    const module = req.baseUrl.split("/").pop() || "System";
    const action = `${req.method} ${req.path}`;
    const userNum = formatUserNumber(req.user.user_Id);
    const ip = getClientIp(req);
    const timeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });

    console.log(`[AUDIT REQUEST] [${timeStr}] User: ${userNum} (ID: ${req.user.user_Id}) | IP: ${ip} | Action: ${action} | Module: ${module.toUpperCase()}`);

    logAudit(
      req,
      req.user.user_Id,
      module.toUpperCase(),
      action,
      req.baseUrl ? req.baseUrl.replace("/api/", "") : "API",
      req.params?.id || req.body?.id || req.body?.user_Id || null,
      null,
      req.body
    );
  }
  
  next();
};

module.exports = requestLogger;
