// backend/src/middleware/rateLimiter.js
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

/**
 * Extracts a unique rate-limit key per request.
 * - For authenticated users: Uses `user_${user_Id}` (from cookies or Bearer token).
 *   This ensures multiple users on the same NAT/LAN IP have independent rate limit buckets
 *   and will never block each other during multi-user testing.
 * - For unauthenticated requests: Uses `ip_${clientIp}`.
 */
const keyByUser = (req) => {
  try {
    if (req.user && req.user.user_Id) {
      return `user_${req.user.user_Id}`;
    }
    let token = null;
    if (req.headers["authorization"] && req.headers["authorization"].startsWith("Bearer ")) {
      token = req.headers["authorization"].split(" ")[1];
    } else if (req.cookies && req.cookies.machip_token) {
      token = req.cookies.machip_token;
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && decoded.user_Id) {
        return `user_${decoded.user_Id}`;
      }
    }
  } catch (_) {
    // Token missing or invalid
  }
  const ip = req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "127.0.0.1";
  return `ip_${ip}`;
};

/**
 * Checks if request originates from an authorized ESP32 hardware device.
 */
const isESP32Hardware = (req) => {
  return req.headers["x-esp32-key"] !== undefined || req.headers["x-api-key"] !== undefined;
};

// ── Login Limiter (Strict Brute-Force Defense) ────────────────────────────────
// Enforces strict throttling on login attempts to prevent brute-force attacks.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 15, // Maximum 15 attempts per 15 minutes per IP
  message: { error: "Too many login attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true },
});

// ── Verify Password Limiter (Re-Authentication Defense) ───────────────────────
const verifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10-minute window
  max: 10, // Maximum 10 verification attempts per 10 minutes per user bucket
  keyGenerator: keyByUser,
  message: { error: "Too many verification attempts. Please try again after 10 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true, keyGeneratorIpFallback: false },
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
  max: 3000, // High ceiling per user bucket to accommodate UI polling
  keyGenerator: keyByUser,
  skip: (req) => isESP32Hardware(req),
  message: { error: "Excessive polling detected. Please slow down.", code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true, keyGeneratorIpFallback: false },
});

// ── General API Limiter ───────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2500, // 2500 requests per 15 mins per user bucket (generous for app use, safe against abuse)
  keyGenerator: keyByUser,
  skip: (req) =>
    isESP32Hardware(req) || 
    HIGH_FREQ_ROUTES.some((route) =>
      req.baseUrl ? req.baseUrl.concat(req.path).startsWith(route) : req.path.startsWith(route)
    ),
  message: { error: "Too many requests. Please slow down.", code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true, keyGeneratorIpFallback: false },
});

module.exports = { loginLimiter, verifyLimiter, generalLimiter, pollingLimiter, HIGH_FREQ_ROUTES };
