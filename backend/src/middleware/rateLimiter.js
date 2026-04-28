// backend/src/middleware/rateLimiter.js
const rateLimit = require("express-rate-limit");

/**
 * loginLimiter — Brute force protection for login
 * 10 attempts per 15 minutes per IP
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

/**
 * HIGH_FREQ_ROUTES — Polling endpoints that fire every few seconds.
 * These are read-only, authenticated, and carry no brute-force risk.
 */
const HIGH_FREQ_ROUTES = [
  "/api/notifications/unread-count",
  "/api/system/time",
  "/api/attendance/status",
  "/api/attendance/stats",
  "/api/attendance/occupancy",
];

/**
 * pollingLimiter — Higher threshold for polling endpoints to prevent abuse
 * 2000 req per 15 min per IP (~133 req/min)
 */
const pollingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { error: "Excessive polling detected. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

/**
 * generalLimiter — DDoS / scraping protection for standard routes
 * 600 req per 15 min per IP (~40 req/min), skips polling routes
 * (Polling routes are handled by pollingLimiter separately)
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { error: "Too many requests from this IP. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  skip: (req) =>
    HIGH_FREQ_ROUTES.some((route) => req.path.startsWith(route.replace("/api", ""))),
});

module.exports = { loginLimiter, generalLimiter, pollingLimiter, HIGH_FREQ_ROUTES };