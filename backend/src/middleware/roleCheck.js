/**
 * roleCheck.js — RBAC (Role-Based Access Control) Guards
 * 
 * These functions assume that req.user was populated by auth.js middleware
 * with a payload containing user_Role (e.g. "Admin", "Supervisor", "Employee").
 */

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.warn(`[ROLE CHECK] Failed: No user in request for ${req.originalUrl}`);
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!allowedRoles.includes(req.user.user_Role)) {
      console.warn(`[ROLE CHECK] Forbidden: User ${req.user.user_Id} (${req.user.user_Role}) tried to access ${req.originalUrl}. Allowed: ${allowedRoles.join(", ")}`);
      return res.status(403).json({ error: `Forbidden: Access denied for role ${req.user.user_Role}` });
    }

    next();
  };
};

// Convenience helpers
const requireAdmin = requireRole("Admin");
const requireSupervisor = requireRole("Supervisor"); 
const requireAdminOrSupervisor = requireRole("Admin", "Supervisor");

module.exports = {
  requireRole,
  requireAdmin,
  requireSupervisor,
  requireAdminOrSupervisor
};
