/**
 * roleCheck.js — RBAC (Role-Based Access Control) Guards
 * 
 * These functions assume that req.user was populated by auth.js middleware
 * with a payload containing user_Role (e.g. "Admin", "Supervisor", "Employee").
 */

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!allowedRoles.includes(req.user.user_Role)) {
      return res.status(403).json({ error: `Forbidden: Access denied for role ${req.user.user_Role}` });
    }

    next();
  };
};

// Convenience helpers
const requireAdmin = requireRole("Admin");
const requireSupervisor = requireRole("Supervisor"); // For potential future use
const requireStaff = requireRole("Staff");
const requireAdminOrSupervisor = requireRole("Admin", "Supervisor");
const requireAdminOrStaff = requireRole("Admin", "Staff");

module.exports = {
  requireRole,
  requireAdmin,
  requireSupervisor,
  requireStaff,
  requireAdminOrSupervisor,
  requireAdminOrStaff
};
