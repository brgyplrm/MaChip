const jwt = require("jsonwebtoken");

// Server boot timestamp generated once when the backend process starts.
// Any token issued before this timestamp will be invalidated immediately.
const SERVER_BOOT_TIME = Date.now();

const authMiddleware = (req, res, next) => {
  // Try to get token from HttpOnly cookie first, then fallback to header
  const token = req.cookies.machip_token || (req.header("Authorization") && req.header("Authorization").split(" ")[1]);

  // Check if no token
  if (!token) {
    return res.status(401).json({ error: "No token, authorization denied." });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Invalidate sessions issued before the current server boot/restart
    // decoded.iat is in seconds, so multiply by 1000
    if (decoded.iat && (decoded.iat * 1000) < SERVER_BOOT_TIME) {
      res.clearCookie("machip_token", {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      });
      return res.status(401).json({ error: "Server restarted. Session expired, please log in again." });
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
