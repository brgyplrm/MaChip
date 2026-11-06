const jwt = require("jsonwebtoken");
const { sequelize } = require("../config/sequelize");
const { QueryTypes } = require("sequelize");

// Server boot timestamp generated once when the backend process starts.
// Any token issued before this timestamp will be invalidated immediately.
const SERVER_BOOT_TIME = Date.now();

const authMiddleware = async (req, res, next) => {
  // Try to get token from HttpOnly cookie first, then fallback to header
  const token = req.cookies?.machip_token || (req.header("Authorization") && req.header("Authorization").split(" ")[1]);

  // Check if no token
  if (!token) {
    return res.status(401).json({ error: "No token, authorization denied." });
  }

  // Verify token with explicit algorithm pinning (VULN-12)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

    // Invalidate sessions issued before the current server boot/restart
    if (decoded.iat && (decoded.iat * 1000) < SERVER_BOOT_TIME) {
      res.clearCookie("machip_token", {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      });
      return res.status(401).json({ error: "Server restarted. Session expired, please log in again." });
    }

    // Zero-Trust Active Account Verification (VULN-11):
    // Check that user is not terminated, deactivated, or soft-deleted
    if (decoded.user_Id) {
      const users = await sequelize.query(
        `SELECT "user_Id", "user_RoleId", "deletedAt" FROM "User" WHERE "user_Id" = :userId`,
        { replacements: { userId: decoded.user_Id }, type: QueryTypes.SELECT }
      );

      if (!users || users.length === 0 || users[0].deletedAt) {
        res.clearCookie("machip_token", {
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        });
        return res.status(401).json({ error: "Account deactivated or terminated." });
      }

      // Synchronize live role from database to prevent privilege persistence after role demotion
      decoded.user_RoleId = users[0].user_RoleId;
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie("machip_token", {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    });
    res.status(401).json({ error: "Token is not valid." });
  }
};

module.exports = authMiddleware;
