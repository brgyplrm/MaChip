// backend/src/middleware/networkBoundary.js
const { getClientIp } = require("../utils/logger");

/**
 * Checks whether an IP address belongs to private/internal networks:
 * - Loopback (127.0.0.1, ::1)
 * - 10.0.0.0/8
 * - 172.16.0.0/12
 * - 192.168.0.0/16
 */
function isPrivateIp(ip) {
  if (!ip) return false;
  const cleanIp = ip.replace(/^::ffff:/, "").trim();

  if (cleanIp === "127.0.0.1" || cleanIp === "::1" || cleanIp === "localhost") {
    return true;
  }

  // IPv4 Class A: 10.0.0.0 - 10.255.255.255
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true;

  // IPv4 Class B: 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true;

  // IPv4 Class C: 192.168.0.0 - 192.168.255.255
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true;

  return false;
}

/**
 * Restricts sensitive administrative and financial operations to internal LAN/loopback connections.
 * Protects against port-forwarding exposure of payroll, system configuration, and hardware management.
 */
const requireInternalNetwork = (req, res, next) => {
  if (process.env.ENFORCE_NETWORK_BOUNDARY === "false") {
    return next();
  }

  const clientIp = getClientIp(req);
  if (isPrivateIp(clientIp)) {
    return next();
  }

  return res.status(403).json({
    error: "Access denied: This operation is restricted to the local office network.",
    code: 403
  });
};

module.exports = { isPrivateIp, requireInternalNetwork };
