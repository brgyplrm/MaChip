const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { logAudit } = require("../utils/logger");

exports.loginUser = async (req, res) => {
  const { user_Id, password } = req.body || {};

  if (!user_Id || !password) {
    return res
      .status(400)
      .json({ error: "User ID and password are required." });
  }

  try {
    const result = await sequelize.query(
      `SELECT u.*, r."roleName" as "user_Role"
       FROM "User" u
       LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
       WHERE u."user_Id" = :user_Id
       AND u."deletedAt" IS NULL`,
      {
        replacements: { user_Id },
        type: QueryTypes.SELECT,
      },
    );

    const user = result[0];

    console.log(
      "[AUTH] User found:",
      user ? `yes (role: ${user.user_RoleId} - ${user.user_Role})` : "no",
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid user ID or password." });
    }

    const isMatch = await bcrypt.compare(password, user.user_Password);
    console.log("[AUTH] Password match:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid user ID or password." });
    }

    const allowedRoles = ["Admin", "Employee"];
    if (!allowedRoles.includes(user.user_Role)) {
      console.log("[AUTH] Role denied:", user.user_Role);
      return res.status(403).json({ error: "Access denied." });
    }

    // Generate JWT
    const token = jwt.sign(
      { 
        user_Id: user.user_Id, 
        user_RoleId: user.user_RoleId,
        user_Role: user.user_Role 
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Strip password before sending back to client
    const { user_Password, ...userData } = user;

    // Log login for ALL users (Admin and Employee)
    await logAudit(req, user.user_Id, "Authentication", "LOGIN", null, null, null, {
      name: `${user.user_FirstName} ${user.user_LastName}`,
      role: user.user_Role
    });

    return res
      .status(200)
      .json({ message: "Login successful.", token, data: userData });
  } catch (error) {
    console.error("[AUTH] Error:", error.message);
    return res
      .status(500)
      .json({ error: "An internal server error occurred." });
  }
};

exports.logoutUser = async (req, res) => {
  const { user_Id } = req.body || {};

  try {
    if (user_Id) {
      // Get user details for the audit log
      const result = await sequelize.query(
        `SELECT u.*, r."roleName" as "user_Role"
         FROM "User" u
         LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
         WHERE u."user_Id" = :user_Id`,
        {
          replacements: { user_Id },
          type: QueryTypes.SELECT,
        },
      );

      if (result.length > 0) {
        const user = result[0];
        await logAudit(req, user.user_Id, "Authentication", "LOGOUT", null, null, null, {
          name: `${user.user_FirstName} ${user.user_LastName}`,
          role: user.user_Role
        });
      }
    }

    return res.status(200).json({ message: "Logout successful." });
  } catch (error) {
    console.error("[LOGOUT ERROR]:", error.message);
    return res.status(500).json({ error: "Failed to log logout event." });
  }
};
