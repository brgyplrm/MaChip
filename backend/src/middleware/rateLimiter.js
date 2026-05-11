// backend/src/middleware/rateLimiter.js
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

/**
 * Extracts a unique key per request.
 * - For auth routes (no token yet): use IP
 * - For authenticated routes: use user_Id from JWT (avoids NAT collision)
 */
const keyByUser = (req) => {
  try {
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return `user_${decoded.user_Id}`;
    }
  } catch (_) {
    // Token invalid or missing
  }
  return req.ip;
};

const isESP32 = (req) => {
  return req.headers["x-esp32-key"] !== undefined || req.headers["x-api-key"] !== undefined;
};

// ── Login Limiter ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true },
});

// ── HIGH_FREQ_ROUTES ──────────────────────────────────────────────────────────
const HIGH_FREQ_ROUTES = [
  "/api/notifications/unread-count",
  "/api/system/time",
  "/api/attendance/status",
  "/api/attendance/stats",
  "/api/attendance/occupancy",
  "/api/esp",
  "/api/rfid"
];

// ── Polling Limiter ───────────────────────────────────────────────────────────
const pollingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000,
  keyGenerator: keyByUser,
  skip: (req) => isESP32(req),
  message: { error: "Excessive polling detected. Please slow down.", code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true, keyGeneratorIpFallback: false }, // Fix for IPv6 validation error
});

// ── General Limiter ───────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  keyGenerator: keyByUser,
  skip: (req) =>
    isESP32(req) || 
    HIGH_FREQ_ROUTES.some((route) =>
      req.baseUrl.concat(req.path).startsWith(route)
    ),
  message: { error: "Too many requests. Please slow down.", code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true, keyGeneratorIpFallback: false }, // Fix for IPv6 validation error
});

module.exports = { loginLimiter, generalLimiter, pollingLimiter, HIGH_FREQ_ROUTES };
