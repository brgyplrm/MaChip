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
    // Token invalid or missing — fall back to IP
  }
  return req.ip;
};

// ── Login Limiter ─────────────────────────────────────────────────────────────
// Keyed by IP because user has no token yet at login time.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
  message: { error: "Too many login attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true },
});

// ── HIGH_FREQ_ROUTES ──────────────────────────────────────────────────────────
// These fire every ~30s per user. Skip them from general limiter entirely.
const HIGH_FREQ_ROUTES = [
  "/api/notifications/unread-count",
  "/api/system/time",
  "/api/attendance/status",
  "/api/attendance/stats",
  "/api/attendance/occupancy",
];

// ── Polling Limiter ───────────────────────────────────────────────────────────
// Per-user keyed. 300 per user per 15 min is plenty (covers multiple tabs).
const pollingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: keyByUser,
  message: { error: "Excessive polling detected. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true },
});

// ── General Limiter ───────────────────────────────────────────────────────────
// Per-user keyed. 500 req/15min per user is generous for normal usage.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  keyGenerator: keyByUser,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true },
  skip: (req) =>
    HIGH_FREQ_ROUTES.some((route) =>
      req.baseUrl.concat(req.path).startsWith(route)
    ),
});

module.exports = { loginLimiter, generalLimiter, pollingLimiter, HIGH_FREQ_ROUTES };
