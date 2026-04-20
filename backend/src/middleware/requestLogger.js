const { logAudit } = require("../utils/logger");

/**
 * requestLogger — Automatically logs every API request to the Audit_Log.
 * This ensures CTPAT compliance by providing a full history of user actions.
 */
const requestLogger = async (req, res, next) => {
  // Only log if the user is authenticated (req.user exists)
  // and exclude GET requests to keep the logs clean (or include them for full audit)
  if (req.user && req.method !== "GET") {
    const module = req.baseUrl.split("/").pop() || "System";
    const action = `${req.method} ${req.path}`;
    
    // Perform logging asynchronously so it doesn't slow down the request
    logAudit(
      req,
      req.user.user_Id,
      module.toUpperCase(),
      action,
      null, // table
      null, // id
      null, // oldVal
      req.body // newVal (the data they sent)
    );
  }
  
  next();
};

module.exports = requestLogger;
