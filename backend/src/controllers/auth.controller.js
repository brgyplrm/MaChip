const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { logAudit } = require("../utils/logger");

exports.loginUser = async (req, res) => {
  let { user_Id, password } = req.body || {};

  if (!user_Id || !password) {
    return res
      .status(400)
      .json({ error: "User ID and password are required." });
  }

  // Enforce MACJ-XXX format strictly
  if (typeof user_Id === "string" && /^MACJ-\d+$/.test(user_Id)) {
    user_Id = parseInt(user_Id.replace("MACJ-", ""), 10);
  } else {
    return res
      .status(400)
      .json({ error: "Invalid ID format. Please use MACJ-XXX (e.g., MACJ-020)." });
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
    console.log("[AUTH] Comparing password:", `"${password}"`, "length:", password.length);
    console.log("[AUTH] Against hash:", user.user_Password.substring(0, 10) + "...", "length:", user.user_Password.length);
    console.log("[AUTH] Password match result:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid user ID or password." });
    }

    const allowedRoles = ["Admin Manager", "Admin Accountant", "Supervisor", "Employee", "Admin"];
    if (!allowedRoles.includes(user.user_Role)) {
      console.log("[AUTH] Role denied:", user.user_Role);
      return res.status(403).json({ error: "Access denied." });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        user_Id: user.user_Id,
        user_RoleId: user.user_RoleId,
        user_Role: user.user_Role,
        position: user.position
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );
    // Set HttpOnly Cookie
    res.cookie("machip_token", token, {
      httpOnly: true,
      secure: false, // Set to false for HTTP (LAN/Local)
      sameSite: "Lax", // Works through the Vite proxy
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    // Strip password before sending back to client
    const { user_Password, ...userData } = user;

    // Log login for ALL users (Admin and Employee)
    await logAudit(req, user.user_Id, "Authentication", "LOGIN", null, null, null, {
      name: `${user.user_FirstName} ${user.user_LastName}`,
      role: user.user_Role
    });

    return res
      .status(200)
      .json({ message: "Login successful.", data: userData });
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

    // Clear HttpOnly Cookie
    res.clearCookie("machip_token", {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    });

    return res.status(200).json({ message: "Logout successful." });
  } catch (error) {
    console.error("[LOGOUT ERROR]:", error.message);
    return res.status(500).json({ error: "Failed to log logout event." });
  }
};

exports.verifyPassword = async (req, res) => {
  const { password } = req.body || {};
  const userId = req.user ? req.user.user_Id : null;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized session." });
  }
  if (!password) {
    return res.status(400).json({ error: "Password is required." });
  }

  try {
    const result = await sequelize.query(
      `SELECT "user_Password" FROM "User" WHERE "user_Id" = :userId AND "deletedAt" IS NULL`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT
      }
    );

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const isMatch = await bcrypt.compare(password, result[0].user_Password);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password. Verification failed." });
    }

    return res.status(200).json({ success: true, message: "Password verified successfully." });
  } catch (err) {
    console.error("[VERIFY PASSWORD ERROR]:", err);
    return res.status(500).json({ error: "Server error verifying password." });
  }
};
