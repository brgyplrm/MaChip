/**
 * roleCheck.js — Granular RBAC (Role-Based Access Control) Guards
 */

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    // allowedRoles can be roleNames or roleIds
    const userRoleName = req.user.user_Role;
    const userRoleId = parseInt(req.user.user_RoleId);

    const isAllowed = allowedRoles.some(role => {
      if (typeof role === 'number') return role === userRoleId;
      return role === userRoleName;
    });

    if (!isAllowed) {
      console.warn(`[ROLE CHECK] Forbidden: User ${req.user.user_Id} (${userRoleName}) tried to access ${req.originalUrl}.`);
      return res.status(403).json({ error: `Forbidden: Access denied for role ${userRoleName}` });
    }

    next();
  };
};

/**
 * SuperAdmin / Manager Level (Full Access)
 * Allows: Role 1 (Admin Manager) & Role 4 (Admin Accountant)
 */
const requireMaster = requireRole(1, 4, "Admin Manager", "Admin Accountant");

/**
 * Financial / User Management Level
 * Allows: Role 1 (Manager) & Role 4 (Accountant)
 */
const requireAdmin = requireRole(1, 4, "Admin Manager", "Admin Accountant", "Admin");

/**
 * Operations / Requests Level
 * Allows: Role 1 (Manager) & Role 2 (Supervisor)
 */
const requireOps = requireRole(1, 2, "Admin Manager", "Supervisor");

/**
 * Log Monitoring / View Only Access
 * Allows: Role 1, 2, and 4
 */
const requireStaff = requireRole(1, 2, 4, "Admin Manager", "Supervisor", "Admin Accountant", "Admin");

/**
 * Self or Staff Level
 * Allows: The user themselves (matching req.params[paramKey]) OR Staff (Roles 1, 2, 4)
 */
const requireSelfOrStaff = (paramKey = "user_Id") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const currentUserId = parseInt(req.user.user_Id, 10);
    const targetUserId = parseInt(req.params[paramKey], 10);
    const userRoleName = req.user.user_Role;
    const userRoleId = parseInt(req.user.user_RoleId, 10);

    const isStaff = [1, 2, 4].includes(userRoleId) ||
      ["Admin Manager", "Supervisor", "Admin Accountant", "Admin"].includes(userRoleName);
    const isSelf = !isNaN(targetUserId) && currentUserId === targetUserId;

    if (!isSelf && !isStaff) {
      console.warn(`[ROLE CHECK] Forbidden: User ${req.user.user_Id} tried to access profile of User ${targetUserId}.`);
      return res.status(403).json({ error: "Forbidden: You are only authorized to access your own profile." });
    }

    next();
  };
};

module.exports = {
  requireRole,
  requireMaster,
  requireAdmin,
  requireOps,
  requireStaff,
  requireSelfOrStaff
};

