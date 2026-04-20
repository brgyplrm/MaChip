const jwt = require("jsonwebtoken");

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
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Token is not valid." });
  }
};

module.exports = authMiddleware;
