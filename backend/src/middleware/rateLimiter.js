const rateLimit = require("express-rate-limit");

/**
 * loginLimiter — Brute force protection for login attempts
 * Max 10 attempts per 15 minutes per IP (Increased slightly from 5 for UX)
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per window
  message: {
    error: "Too many login attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true, 
  legacyHeaders: false,
  validate: { trustProxy: false }, // Silence the trust proxy warning
});

/**
 * generalLimiter — Protection against DDoS and API scraping
 * Max 300 requests per 15 minutes per IP (Balanced for React polling)
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Balanced limit
  message: {
    error: "Too many requests from this IP. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }, // Silence the trust proxy warning
});

module.exports = {
  loginLimiter,
  generalLimiter,
};
