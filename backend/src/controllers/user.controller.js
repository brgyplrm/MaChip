const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { getSystemTime, formatForSQL } = require("../utils/systemTime");
const { validateEmailActive, sendWelcomeEmail, sendPasswordUpdateEmail } = require("../utils/emailService");
const { logAudit } = require("../utils/logger");

// ── Get Next User ID ──────────────────────────────────────────────────────────
exports.getNextUserId = async (req, res) => {
  try {
    const result = await sequelize.query(
      `SELECT MAX("user_Id") AS "maxId" FROM "User"`,
      { type: QueryTypes.SELECT },
    );
    const nextId = (result[0].maxId ? parseInt(result[0].maxId) : 0) + 1;
    res.status(200).json({
      nextId,
      displayId: `MACJ-${String(nextId).padStart(3, "0")}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Register User ─────────────────────────────────────────────────────────────
exports.registerUser = async (req, res) => {
  try {
    const { user_FirstName, user_LastName, user_MachipId, user_Email, user_Password } = req.body || {};

    if (!user_FirstName || !user_LastName || !user_MachipId || !user_Email || !user_Password) {
      return res.status(400).json({
        error: "Missing required fields (First Name, Last Name, Email, Password, or MaChip ID).",
      });
    }

    if (req.body.user_MiddleName && /\d/.test(req.body.user_MiddleName)) {
      return res
        .status(400)
        .json({ error: "Middle Name must not contain numbers." });
    }

    // Validate email format and "active" status (MX records) before saving
    try {
      await validateEmailActive(user_Email);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // Check if email already exists (including soft-deleted users)
    const existingEmail = await sequelize.query(
      `SELECT "user_Id" FROM "User" WHERE "user_Email" = :user_Email`,
      { replacements: { user_Email }, type: QueryTypes.SELECT },
    );

    if (existingEmail.length > 0) {
      return res.status(400).json({ error: "Email already exists." });
    }

    // Check if MaChip ID already exists
    const existingMachip = await sequelize.query(
      `SELECT "user_Id" FROM "User" WHERE "user_MachipId" = :user_MachipId`,
      { replacements: { user_MachipId }, type: QueryTypes.SELECT },
    );

    if (existingMachip.length > 0) {
      return res.status(400).json({ error: "MaChip ID is already assigned to another user." });
    }

    // Get next ID if not provided by frontend (though frontend sends it)
    let user_Id = req.body.user_Id;
    if (!user_Id) {
      const result = await sequelize.query(
        `SELECT MAX("user_Id") AS "maxId" FROM "User"`,
        { type: QueryTypes.SELECT },
      );
      user_Id = (result[0].maxId ? parseInt(result[0].maxId) : 0) + 1;
    }

    // Prepare display ID for email
    const displayId = `MACJ-${String(user_Id).padStart(3, "0")}`;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.user_Password, salt);

    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    // Insert new user
    await sequelize.query(
      `INSERT INTO "User" (
        "user_Id", "user_FirstName", "user_LastName",
        "user_MiddleName", "user_Email", "user_Password", "user_MachipId", "user_RoleId", "user_EmploymentStatusId", "user_ProfilePic", "createdAt", "updatedAt"
      ) VALUES (
        :user_Id, :user_FirstName, :user_LastName,
        :user_MiddleName, :user_Email, :user_Password, :user_MachipId, :user_RoleId, :user_EmploymentStatusId, :user_ProfilePic, :now, :now
      )`,
      {
        replacements: {
          user_Id,
          user_FirstName: req.body.user_FirstName,
          user_LastName: req.body.user_LastName,
          user_MiddleName: req.body.user_MiddleName || null,
          user_Email: req.body.user_Email || null,
          user_Password: hashedPassword,
          user_MachipId: req.body.user_MachipId,
          user_RoleId: req.body.user_RoleId || 2,
          user_EmploymentStatusId: req.body.user_EmploymentStatusId || 1,
          user_ProfilePic: req.file ? req.file.filename : null,
          now: nowStr,
        },
        type: QueryTypes.INSERT,
      },
    );

    // Send welcome email after successful registration
    try {
      await sendWelcomeEmail({
        email: user_Email,
        password: user_Password, // Send the plain password
        name: `${req.body.user_FirstName} ${req.body.user_LastName}`,
        displayId: displayId
      });
    } catch (emailError) {
      console.error("[WELCOME EMAIL ERROR]:", emailError.message);
      // We don't fail the registration if only the email fails, but we could return a warning
      return res.status(201).json({ 
        message: "User Registered, but welcome email failed to send.",
        warning: emailError.message 
      });
    }

    // Fetch the created user to return
    const newUser = await sequelize.query(
      `SELECT * FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    await logAudit(req, req.user?.user_Id || 1, "CREATE_USER", "User", user_Id, null, newUser[0]);

    res.status(201).json({ message: "User Registered!", data: newUser[0] });
  } catch (error) {
    console.error("[REGISTER USER ERROR]:", error);
    res.status(500).json({ 
      error: error.message,
      details: error.name === 'SequelizeValidationError' ? error.errors.map(e => e.message) : undefined
    });
  }
};

// ── View All Users ────────────────────────────────────────────────────────────
exports.viewAllUsers = async (req, res) => {
  try {
    const users = await sequelize.query(
      `SELECT u.*, r."roleName" AS "user_Role" 
       FROM "User" u
       LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
       WHERE u."deletedAt" IS NULL`,
      { type: QueryTypes.SELECT },
    );
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── View Archived Users (Soft-Deleted) ────────────────────────────────────────
exports.viewArchivedUsers = async (req, res) => {
  try {
    const users = await sequelize.query(
      `SELECT u.*, r."roleName" AS "user_Role" 
       FROM "User" u
       LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
       WHERE u."deletedAt" IS NOT NULL`,
      { type: QueryTypes.SELECT },
    );
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── View User By ID ───────────────────────────────────────────────────────────
exports.viewUserById = async (req, res) => {
  const { user_Id } = req.params;
  try {
    const user = await sequelize.query(
      `SELECT u.*, r."roleName" AS "user_Role"
       FROM "User" u
       LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
       WHERE u."user_Id" = :user_Id AND u."deletedAt" IS NULL`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );
    if (user.length > 0) {
      res.status(200).json(user[0]);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Soft Delete User ──────────────────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  const { user_Id } = req.params;
  const currentAdminId = req.user
    ? req.user.user_Id
    : req.headers["x-admin-id"];

  try {
    if (currentAdminId && parseInt(currentAdminId) === parseInt(user_Id)) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    const result = await sequelize.query(
      `UPDATE "User" SET "deletedAt" = :now
       WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
      { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE },
    );

    if (result) {
      const user = await sequelize.query(`SELECT * FROM "User" WHERE "user_Id" = :user_Id`, { replacements: { user_Id }, type: QueryTypes.SELECT });
      await logAudit(req, currentAdminId || 1, "SOFT_DELETE_USER", "User", user_Id, user[0], null);
      res.status(200).json({ message: "User soft-deleted successfully." });
    } else {
      res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Restore Soft-Deleted User ─────────────────────────────────────────────────
exports.restoreUser = async (req, res) => {
  const { user_Id } = req.params;

  try {
    // Check if user exists (including soft-deleted)
    const user = await sequelize.query(
      `SELECT * FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    if (!user[0].deletedAt) {
      return res.status(400).json({ message: "User is not deleted." });
    }

    await sequelize.query(
      `UPDATE "User" SET "deletedAt" = NULL WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.UPDATE },
    );

    const restored = await sequelize.query(
      `SELECT * FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    res
      .status(200)
      .json({ message: "User restored successfully.", data: restored[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Force Delete User (Hard Delete) ──────────────────────────────────────────
exports.forceDeleteUser = async (req, res) => {
  const { user_Id } = req.params;
  const currentAdminId = req.user
    ? req.user.user_Id
    : req.headers["x-admin-id"];

  try {
    if (currentAdminId && parseInt(currentAdminId) === parseInt(user_Id)) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    // 1. Check if user exists
    const user = await sequelize.query(
      `SELECT "user_Id" FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    // 2. Perform hard delete
    await sequelize.query(
      `DELETE FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.DELETE },
    );

    await logAudit(req, currentAdminId || 1, "PERMANENT_DELETE_USER", "User", user_Id, user[0], null);

    res.status(200).json({ message: "User permanently deleted." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Update User ───────────────────────────────────────────────────────────────
exports.updateUser = async (req, res) => {
  const { user_Id } = req.params;
  console.log("[DEBUG] Received body in updateUser:", req.body);
  const {
    user_FirstName,
    user_LastName,
    user_MiddleName,
    user_MachipId,
    user_RoleId,
    user_EmploymentStatusId,
    user_Email,
    user_Password,
    adminConfirmPassword,
  } = req.body || {};

  try {
    // 1. Admin Promotion Security Check
    if (user_RoleId && parseInt(user_RoleId) === 1) {
      console.log(`[DEBUG] Promotion to Admin request for user ${user_Id}`);
      
      const existing = await sequelize.query(
        `SELECT "user_RoleId" FROM "User" WHERE "user_Id" = :targetId`,
        { replacements: { targetId: parseInt(user_Id) }, type: QueryTypes.SELECT }
      );

      if (existing.length > 0 && existing[0].user_RoleId !== 1) {
        const operatorIdStr = req.headers["x-admin-id"];
        const operatorId = parseInt(operatorIdStr);

        if (isNaN(operatorId)) {
          return res.status(403).json({ error: "Authorized Admin ID required." });
        }

        if (!adminConfirmPassword) {
          return res.status(403).json({ error: "Password confirmation required to promote to Admin." });
        }

        const operator = await sequelize.query(
          `SELECT "user_Password" FROM "User" WHERE "user_Id" = :opId`,
          { replacements: { opId: operatorId }, type: QueryTypes.SELECT }
        );

        if (operator.length === 0) {
          return res.status(403).json({ error: "Authorized admin not found." });
        }

        const isMatch = await bcrypt.compare(adminConfirmPassword, operator[0].user_Password);
        if (!isMatch) {
          return res.status(403).json({ error: "Invalid admin password. Promotion denied." });
        }
      }
    }

    if (user_MiddleName && /\d/.test(user_MiddleName)) {
      return res.status(400).json({ error: "Middle Name must not contain numbers." });
    }

    const oldUserResult = await sequelize.query(
      `SELECT * FROM "User" WHERE "user_Id" = :targetId`,
      { replacements: { targetId: parseInt(user_Id) }, type: QueryTypes.SELECT }
    );
    const oldUser = oldUserResult[0];

    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    // Build replacements object with explicit types
    const replacements = {
      targetId: parseInt(user_Id),
      firstName: user_FirstName,
      lastName: user_LastName,
      middleName: user_MiddleName || null,
      machipId: user_MachipId,
      roleId: parseInt(user_RoleId),
      statusId: parseInt(user_EmploymentStatusId),
      email: user_Email,
      updatedAt: nowStr
    };

    let sql = `
      UPDATE "User" SET 
        "user_FirstName" = :firstName,
        "user_LastName"  = :lastName,
        "user_MiddleName"= :middleName,
        "user_MachipId"  = :machipId,
        "user_RoleId"    = :roleId,
        "user_EmploymentStatusId" = :statusId,
        "user_Email"     = :email,
        "updatedAt"      = :updatedAt
    `;

    if (user_Password && user_Password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      replacements.hashedPass = await bcrypt.hash(user_Password, salt);
      sql += `, "user_Password" = :hashedPass`;
    }

    if (req.file) {
      replacements.profilePic = req.file.filename;
      sql += `, "user_ProfilePic" = :profilePic`;
    }

    sql += ` WHERE "user_Id" = :targetId AND "deletedAt" IS NULL`;

    await sequelize.query(sql, { replacements, type: QueryTypes.UPDATE });

    const updatedUserResult = await sequelize.query(
      `SELECT * FROM "User" WHERE "user_Id" = :targetId`,
      { replacements: { targetId: parseInt(user_Id) }, type: QueryTypes.SELECT }
    );

    const updatedUser = updatedUserResult[0];

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "UPDATE_USER", "User", user_Id, oldUser, updatedUser);

    // 2. Send email if password was updated
    if (user_Password && user_Password.trim() !== "" && updatedUser) {
      try {
        await sendPasswordUpdateEmail({
          email: updatedUser.user_Email,
          newPassword: user_Password, // Send the plain password
          name: `${updatedUser.user_FirstName} ${updatedUser.user_LastName}`
        });
      } catch (emailErr) {
        console.error("[EMAIL ERROR] Failed to send password update email:", emailErr.message);
      }
    }

    res.status(200).json({ message: "User updated successfully", data: updatedUser });

  } catch (error) {
    console.error("[UPDATE USER ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

// ── Request Password Reset ───────────────────────────────────────────────────
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    // 1. Find user by email
    const user = await sequelize.query(
      `SELECT "user_Id", "user_FirstName", "user_LastName" FROM "User" WHERE "user_Email" = :email AND "deletedAt" IS NULL`,
      { replacements: { email }, type: QueryTypes.SELECT }
    );

    if (user.length === 0) {
      return res.status(404).json({ error: "No active user found with that email address." });
    }

    const targetUser = user[0];
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    // 2. Find all Admins (RoleId = 1)
    const admins = await sequelize.query(
      `SELECT "user_Id" FROM "User" WHERE "user_RoleId" = 1 AND "deletedAt" IS NULL`,
      { type: QueryTypes.SELECT }
    );

    // 3. Create notifications for all admins
    for (const admin of admins) {
      await sequelize.query(
        `INSERT INTO "Notification" ("user_Id", "title", "message", "isRead", "targetId", "createdAt", "updatedAt")
         VALUES (:adminId, :title, :message, false, :targetId, :now, :now)`,
        {
          replacements: {
            adminId: admin.user_Id,
            title: "Password Reset Request",
            message: `User ${targetUser.user_FirstName} ${targetUser.user_LastName} (ID: ${targetUser.user_Id}) has requested a password reset.`,
            targetId: targetUser.user_Id,
            now: nowStr
          },
          type: QueryTypes.INSERT
        }
      );
    }

    res.status(200).json({ message: "Reset request sent to administrators." });
  } catch (error) {
    console.error("[RESET REQUEST ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

// ── Get Employee Masterlist (with Daily Rate) ─────────────────────────────────

exports.getMasterlist = async (req, res) => {
  try {
    const employees = await sequelize.query(
      `SELECT
         u."user_Id",
         u."user_FirstName",
         u."user_LastName",
         u."user_MiddleName",
         u."user_Email",
         u."user_MachipId",
         u."user_RoleId",
         u."user_EmploymentStatusId",
         u."user_ProfilePic",
         u."dailyRate",
         u."previousDailyRate",
         u."rateUpdatedAt",
         u."createdAt",
         u."updatedAt",
         r."roleName"          AS "user_Role",
         es."statusName"       AS "employmentStatus"
       FROM "User" u
       LEFT JOIN "user_Role"        r  ON u."user_RoleId"             = r."roleId"
       LEFT JOIN "employementStatus" es ON u."user_EmploymentStatusId" = es."statusId"
       WHERE u."deletedAt" IS NULL
       ORDER BY u."user_Id" ASC`,
      { type: QueryTypes.SELECT },
    );
    res.status(200).json(employees);
  } catch (error) {
    console.error("[GET MASTERLIST ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

// ── Update Daily Rate ─────────────────────────────────────────────────────────
exports.updateDailyRate = async (req, res) => {
  const { user_Id } = req.params;
  const { newDailyRate } = req.body;

  if (newDailyRate === undefined || newDailyRate === null) {
    return res.status(400).json({ error: "newDailyRate is required." });
  }
  const parsed = parseFloat(newDailyRate);
  if (isNaN(parsed) || parsed < 0) {
    return res.status(400).json({ error: "newDailyRate must be a positive number." });
  }

  try {
    const existing = await sequelize.query(
      `SELECT "user_Id", "dailyRate" FROM "User"
       WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Employee not found." });
    }

    const currentRate = parseFloat(existing[0].dailyRate) || 0;

    if (currentRate === parsed) {
      return res.status(200).json({
        message: "Rate unchanged.",
        dailyRate: currentRate,
        previousDailyRate: currentRate,
      });
    }

    const oldRateData = { dailyRate: currentRate, previousDailyRate: existing[0].previousDailyRate };

    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    await sequelize.query(
      `UPDATE "User"
       SET
         "previousDailyRate" = "dailyRate",
         "dailyRate"         = :newDailyRate,
         "rateUpdatedAt"     = :now,
         "updatedAt"         = :now
       WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
      {
        replacements: { newDailyRate: parsed, now: nowStr, user_Id },
        type: QueryTypes.UPDATE,
      },
    );

    const updated = await sequelize.query(
      `SELECT
         "user_Id", "user_FirstName", "user_LastName",
         "dailyRate", "previousDailyRate", "rateUpdatedAt"
       FROM "User"
       WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    const newRateData = { dailyRate: updated[0].dailyRate, previousDailyRate: updated[0].previousDailyRate };
    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "UPDATE_DAILY_RATE", "User", user_Id, oldRateData, newRateData);

    res.status(200).json({
      message: "Daily rate updated successfully.",
      data: updated[0],
    });
  } catch (error) {
    console.error("[UPDATE DAILY RATE ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};
