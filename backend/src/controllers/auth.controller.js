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

    if (!user) {
      return res.status(401).json({ error: "Invalid user ID or password." });
    }

    const isMatch = await bcrypt.compare(password, user.user_Password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid user ID or password." });
    }

    // Validate system role (strictly roleId 1 to 4: 1=Admin Manager, 2=Supervisor, 3=Employee, 4=Admin Accountant)
    const roleId = parseInt(user.user_RoleId, 10);
    if (![1, 2, 3, 4].includes(roleId)) {
      console.log("[AUTH] Access denied: User has invalid roleId:", user.user_RoleId);
      return res.status(403).json({ error: "Access denied. Invalid user role." });
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
    // Set HttpOnly Session Cookie (Strict Option A: deleted automatically when browser closes)
    res.cookie("machip_token", token, {
      httpOnly: true,
      secure: false, // Set to false for HTTP (LAN/Local)
      sameSite: "Lax", // Works through the Vite proxy
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

exports.verifySession = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const userId = req.user ? req.user.user_Id : null;
  if (!userId) {
    return res.status(401).json({ error: "Session invalid or expired." });
  }

  try {
    const [user] = await sequelize.query(
      `SELECT u."user_Id", u."user_FirstName", u."user_LastName", u."user_MiddleName", u."user_Email", 
              u."user_RoleId", r."roleName" AS "user_Role", u."position", u."department",
              u."is_time_exempt", u."user_Gender", u."civil_status", u."is_solo_parent", u."hireDate",
              u."user_ProfilePic"
       FROM "User" u
       LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
       WHERE u."user_Id" = :userId AND u."deletedAt" IS NULL`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT
      }
    );

    if (!user) {
      res.clearCookie("machip_token", {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      });
      return res.status(401).json({ error: "User no longer exists or has been deactivated." });
    }

    return res.status(200).json({ valid: true, user });
  } catch (error) {
    console.error("[VERIFY SESSION ERROR]:", error.message);
    return res.status(500).json({ error: "Failed to verify session." });
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

const crypto = require("crypto");
const { sendPasswordResetEmail, sendPasswordUpdateEmail } = require("../utils/emailService");

// ── Self-Service Forgot Password ──────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  const { email } = req.body || {};

  if (!email || typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ error: "Email address is required." });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Look up user by email (case-insensitive & active only)
    const users = await sequelize.query(
      `SELECT "user_Id", "user_FirstName", "user_LastName", "user_Email" 
       FROM "User" 
       WHERE LOWER("user_Email") = :email AND "deletedAt" IS NULL`,
      {
        replacements: { email: cleanEmail },
        type: QueryTypes.SELECT
      }
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ error: "No active user found with that email address." });
    }

    const user = users[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

    // 2. Persist reset token
    await sequelize.query(
      `UPDATE "User"
       SET "resetPasswordToken" = :token,
           "resetPasswordExpires" = :expires
       WHERE "user_Id" = :userId`,
      {
        replacements: { token, expires, userId: user.user_Id },
        type: QueryTypes.UPDATE
      }
    );

    // 3. Resolve frontend host URL
    let clientUrl = "http://localhost:5173";
    if (req.headers.origin) {
      clientUrl = req.headers.origin;
    } else if (req.headers.referer) {
      try {
        clientUrl = new URL(req.headers.referer).origin;
      } catch (_) {}
    } else if (process.env.CLIENT_URL) {
      clientUrl = process.env.CLIENT_URL;
    }

    const resetLink = `${clientUrl}/reset-password?token=${token}`;

    // 4. Send email via Nodemailer
    await sendPasswordResetEmail({
      email: user.user_Email,
      name: `${user.user_FirstName} ${user.user_LastName}`,
      resetLink,
      expiresMinutes: 60
    });

    await logAudit(req, user.user_Id, "Authentication", "REQUEST_PASSWORD_RESET", "User", user.user_Id, null, {
      email: user.user_Email,
      expires
    });

    return res.status(200).json({
      success: true,
      message: `Password reset instructions have been sent to ${user.user_Email}. Please check your inbox.`
    });
  } catch (err) {
    console.error("[FORGOT PASSWORD ERROR]:", err);
    return res.status(500).json({ error: "Failed to process password reset request. Please try again later." });
  }
};

// ── Verify Reset Token Validity ───────────────────────────────────────────────
exports.verifyResetToken = async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ valid: false, error: "Reset token is required." });
  }

  try {
    const users = await sequelize.query(
      `SELECT "user_Id", "user_FirstName", "user_LastName", "user_Email", "resetPasswordExpires"
       FROM "User"
       WHERE "resetPasswordToken" = :token AND "deletedAt" IS NULL`,
      {
        replacements: { token },
        type: QueryTypes.SELECT
      }
    );

    if (!users || users.length === 0) {
      return res.status(400).json({ valid: false, error: "This password reset link is invalid or has already been used." });
    }

    const user = users[0];
    const now = new Date();
    if (new Date(user.resetPasswordExpires) < now) {
      return res.status(400).json({ valid: false, error: "This password reset link has expired. Please request a new one." });
    }

    return res.status(200).json({
      valid: true,
      email: user.user_Email,
      name: `${user.user_FirstName} ${user.user_LastName}`
    });
  } catch (err) {
    console.error("[VERIFY RESET TOKEN ERROR]:", err);
    return res.status(500).json({ valid: false, error: "Error verifying reset token." });
  }
};

// ── Complete Password Reset ───────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body || {};

  if (!token) {
    return res.status(400).json({ error: "Reset token is required." });
  }

  const { validatePassword } = require("../utils/passwordValidator");
  const pwdValidation = validatePassword(newPassword);
  if (!pwdValidation.isValid) {
    return res.status(400).json({ error: pwdValidation.message });
  }

  try {
    const users = await sequelize.query(
      `SELECT "user_Id", "user_FirstName", "user_LastName", "user_Email", "resetPasswordExpires"
       FROM "User"
       WHERE "resetPasswordToken" = :token AND "deletedAt" IS NULL`,
      {
        replacements: { token },
        type: QueryTypes.SELECT
      }
    );

    if (!users || users.length === 0) {
      return res.status(400).json({ error: "This password reset link is invalid or has already been used." });
    }

    const user = users[0];
    const now = new Date();
    if (new Date(user.resetPasswordExpires) < now) {
      return res.status(400).json({ error: "This password reset link has expired. Please request a new one." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await sequelize.query(
      `UPDATE "User"
       SET "user_Password" = :hashedPassword,
           "resetPasswordToken" = NULL,
           "resetPasswordExpires" = NULL,
           "updatedAt" = NOW()
       WHERE "user_Id" = :userId`,
      {
        replacements: { hashedPassword, userId: user.user_Id },
        type: QueryTypes.UPDATE
      }
    );

    await logAudit(req, user.user_Id, "Authentication", "RESET_PASSWORD_SELF", "User", user.user_Id, null, {
      method: "Self-Service Email Reset"
    });

    // Send confirmation security alert email
    try {
      await sendPasswordUpdateEmail({
        email: user.user_Email,
        newPassword: newPassword,
        name: `${user.user_FirstName} ${user.user_LastName}`
      });
    } catch (emailErr) {
      console.error("[CONFIRMATION EMAIL ERROR]:", emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Your password has been successfully reset! You can now log in with your new password."
    });
  } catch (err) {
    console.error("[RESET PASSWORD ERROR]:", err);
    return res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
};

