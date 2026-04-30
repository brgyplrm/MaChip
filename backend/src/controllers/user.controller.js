const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { getSystemTime, formatForSQL } = require("../utils/systemTime");
const { validateEmailActive, sendWelcomeEmail, sendPasswordUpdateEmail } = require("../utils/emailService");
const { logAudit } = require("../utils/logger");
const { encrypt, decrypt } = require("../utils/encryption");
const { computeMonthlyShares } = require("../utils/govtDeductions");

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
    const { 
      user_FirstName, 
      user_LastName, 
      user_MachipId, 
      user_Email, 
      user_Password,
      account_Number
    } = req.body || {};

    if (!user_FirstName || !user_LastName || !user_Email || !user_Password) {
      return res.status(400).json({
        error: "Missing required fields (First Name, Last Name, Email, or Password).",
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

    // Check if MaChip ID already exists in ACTIVE users (only if provided)
    if (user_MachipId) {
      const existingMachip = await sequelize.query(
        `SELECT "user_Id" FROM "User" WHERE "user_MachipId" = :user_MachipId AND "deletedAt" IS NULL`,
        { replacements: { user_MachipId }, type: QueryTypes.SELECT },
      );

      if (existingMachip.length > 0) {
        return res.status(400).json({ error: "MaChip ID is already assigned to another active user." });
      }
    }

    // Get next ID if not provided by frontend (though frontend sends it)
    let user_Id = req.body.user_Id;
    
    if (user_Id) {
      // Check if manually entered ID already exists
      const existingId = await sequelize.query(
        `SELECT "user_Id" FROM "User" WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id }, type: QueryTypes.SELECT },
      );
      if (existingId.length > 0) {
        return res.status(400).json({ error: "User ID already exists. Please choose another or use the auto-generated one." });
      }
    } else {
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
        "user_MiddleName", "user_Email", "user_Password", "user_MachipId", "user_FingerprintId", "user_FingerprintTemplate", "user_RoleId", "user_EmploymentStatusId", "user_ProfilePic", "account_Number", "createdAt", "updatedAt"
      ) VALUES (
        :user_Id, :user_FirstName, :user_LastName,
        :user_MiddleName, :user_Email, :user_Password, :user_MachipId, :user_FingerprintId, :user_FingerprintTemplate, :user_RoleId, :user_EmploymentStatusId, :user_ProfilePic, :account_Number, :now, :now
      )`,
      {
        replacements: {
          user_Id,
          user_FirstName: req.body.user_FirstName,
          user_LastName: req.body.user_LastName,
          user_MiddleName: req.body.user_MiddleName || null,
          user_Email: req.body.user_Email || null,
          user_Password: hashedPassword,
          user_MachipId: req.body.user_MachipId || null,
          user_FingerprintId: req.body.user_FingerprintId || null,
          user_FingerprintTemplate: req.body.user_FingerprintTemplate || null,
          user_RoleId: req.body.user_RoleId || 2,
          user_EmploymentStatusId: req.body.user_EmploymentStatusId || 1,
          user_ProfilePic: req.file ? req.file.filename : null,
          account_Number: encrypt(account_Number),
          now: nowStr,
        },
        type: QueryTypes.INSERT,
      },
    );

    // Fetch the created user to return
    const newUserResult = await sequelize.query(
      `SELECT * FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );
    const newUser = newUserResult[0];
    if (newUser.account_Number) {
      newUser.account_Number = decrypt(newUser.account_Number);
    }

    await logAudit(req, req.user?.user_Id || 1, "User Management", "CREATE_USER", "User", user_Id, null, newUser);

    // Send welcome email after successful registration (Non-blocking)
    sendWelcomeEmail({
      email: user_Email,
      password: req.body.user_Password, // Use raw password
      name: `${req.body.user_FirstName} ${req.body.user_LastName}`,
      displayId: displayId
    }).catch(emailError => {
      console.error("[WELCOME EMAIL ERROR]:", emailError.message);
    });

    res.status(201).json({ message: "User Registered!", data: newUser });
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

    const decryptedUsers = users.map(user => {
      if (user.account_Number) {
        user.account_Number = decrypt(user.account_Number);
      }
      return user;
    });

    res.status(200).json(decryptedUsers);
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

    const decryptedUsers = users.map(user => {
      if (user.account_Number) {
        user.account_Number = decrypt(user.account_Number);
      }
      return user;
    });

    res.status(200).json(decryptedUsers);
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
      const userData = user[0];
      if (userData.account_Number) {
        userData.account_Number = decrypt(userData.account_Number);
      }
      res.status(200).json(userData);
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

    // 1. Get current user info to handle MachipId prefixing
    const userResult = await sequelize.query(
      `SELECT "user_MachipId" FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    
    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const currentMachipId = userResult[0].user_MachipId;
    // Append unique suffix to MachipId to free it up for others
    const archivedMachipId = currentMachipId ? `${currentMachipId}-ARCHIVED-${user_Id}` : null;

    const result = await sequelize.query(
      `UPDATE "User" SET "deletedAt" = :now, "user_MachipId" = :archivedMachipId
       WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
      { replacements: { user_Id, now: nowStr, archivedMachipId }, type: QueryTypes.UPDATE },
    );

    if (result) {
      const user = await sequelize.query(`SELECT * FROM "User" WHERE "user_Id" = :user_Id`, { replacements: { user_Id }, type: QueryTypes.SELECT });
      await logAudit(req, currentAdminId || 1, "User Management", "SOFT_DELETE_USER", "User", user_Id, user[0], null);
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

    const currentMachipId = user[0].user_MachipId;
    let targetMachipId = null;

    if (currentMachipId) {
      // If it has our new suffix, strip it. If not, try the ID as-is.
      targetMachipId = currentMachipId.includes("-ARCHIVED-") 
        ? currentMachipId.split("-ARCHIVED-")[0] 
        : currentMachipId;
      
      // Check if this ID is already assigned to an ACTIVE user
      const taken = await sequelize.query(
        `SELECT "user_Id" FROM "User" WHERE "user_MachipId" = :targetMachipId AND "deletedAt" IS NULL AND "user_Id" != :user_Id`,
        { replacements: { targetMachipId, user_Id }, type: QueryTypes.SELECT }
      );

      if (taken.length > 0) {
        // ID is taken by someone else, restore user without a card
        targetMachipId = null;
      }
    }

    await sequelize.query(
      `UPDATE "User" SET "deletedAt" = NULL, "user_MachipId" = :targetMachipId WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id, targetMachipId }, type: QueryTypes.UPDATE },
    );

    const restored = await sequelize.query(
      `SELECT * FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "User Management", "RESTORE_USER", "User", user_Id, user[0], restored[0]);

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

    await logAudit(req, currentAdminId || 1, "User Management", "PERMANENT_DELETE_USER", "User", user_Id, user[0], null);

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
    user_FingerprintId,
    user_RoleId,
    user_EmploymentStatusId,
    user_Email,
    user_Password,
    adminConfirmPassword,
    account_Number,
  } = req.body || {};

  try {
    // ...
    
    // Check if new Fingerprint ID is already assigned to another active user
    if (user_FingerprintId) {
      const existingFP = await sequelize.query(
        `SELECT "user_Id" FROM "User" WHERE "user_FingerprintId" = :user_FingerprintId AND "deletedAt" IS NULL AND "user_Id" != :targetId`,
        { replacements: { user_FingerprintId, targetId: parseInt(user_Id) }, type: QueryTypes.SELECT }
      );

      if (existingFP.length > 0) {
        return res.status(400).json({ error: "Fingerprint ID is already assigned to another active user." });
      }
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
      firstName: user_FirstName || null,
      lastName: user_LastName || null,
      middleName: user_MiddleName || null,
      machipId: user_MachipId || null,
      fingerprintId: user_FingerprintId || null,
      fingerprintTemplate: req.body.user_FingerprintTemplate || null,
      roleId: parseInt(user_RoleId) || 3,
      statusId: parseInt(user_EmploymentStatusId) || 1,
      email: user_Email || null,
      accountNumber: encrypt(account_Number) || null,
      updatedAt: nowStr
    };

    let sql = `
      UPDATE "User" SET 
        "user_FirstName" = :firstName,
        "user_LastName"  = :lastName,
        "user_MiddleName"= :middleName,
        "user_MachipId"  = :machipId,
        "user_FingerprintId" = :fingerprintId,
        "user_FingerprintTemplate" = :fingerprintTemplate,
        "user_RoleId"    = :roleId,
        "user_EmploymentStatusId" = :statusId,
        "user_Email"     = :email,
        "account_Number" = :accountNumber,
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
    if (updatedUser.account_Number) {
      updatedUser.account_Number = decrypt(updatedUser.account_Number);
    }

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "User Management", "UPDATE_USER", "User", user_Id, oldUser, updatedUser);

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
         u."account_Number",
         u."dailyRate",
         u."previousDailyRate",
         u."rateUpdatedAt",
         u."sss_Share",
         u."philhealth_Share",
         u."hdmf_Share",
         u."tax_Share",
         u."healthCard_Amnt",
         u."SSS_Loan",
         u."HDMF_Loan",
         u."calamityLoan_Amnt",
         u."advances_Amnt",
         u."globe_Deduction",
         u."multiPurposeSavings",
         u."taxStatus",         u."department",
         u."position",
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

    const decryptedEmployees = employees.map(emp => {
      if (emp.account_Number) {
        emp.account_Number = decrypt(emp.account_Number);
      }
      return emp;
    });

    res.status(200).json(decryptedEmployees);
  } catch (error) {
    console.error("[GET MASTERLIST ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

// ── Update Daily Rate ─────────────────────────────────────────────────────────
exports.updateDailyRate = async (req, res) => {
  const { user_Id } = req.params;
  const { 
    newDailyRate, sss_Share, philhealth_Share, hdmf_Share,
    healthCard_Amnt, SSS_Loan, HDMF_Loan, calamityLoan_Amnt,
    advances_Amnt, globe_Deduction, multiPurposeSavings
  } = req.body;

  if (newDailyRate === undefined || newDailyRate === null) {
    return res.status(400).json({ error: "newDailyRate is required." });
  }
  const parsed = parseFloat(newDailyRate);
  if (isNaN(parsed) || parsed < 0) {
    return res.status(400).json({ error: "newDailyRate must be a positive number." });
  }

  try {
    let existing;
    try {
      existing = await sequelize.query(
        `SELECT * FROM "User" WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
        { replacements: { user_Id }, type: QueryTypes.SELECT },
      );
    } catch (err) {
      console.warn("[SELECT FALLBACK]:", err.message);
      existing = await sequelize.query(
        `SELECT "user_Id", "dailyRate" FROM "User" WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
        { replacements: { user_Id }, type: QueryTypes.SELECT }
      );
    }

    if (existing.length === 0) {
      return res.status(404).json({ error: "Employee not found." });
    }

    const currentRate = parseFloat(existing[0].dailyRate) || 0;
    const oldRateData = { ...existing[0] };

    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    // Ensure manual shares are treated as numbers and never as empty strings
    let finalSSS = parseFloat(sss_Share);
    let finalPH  = parseFloat(philhealth_Share);
    let finalHD  = parseFloat(hdmf_Share);
    let finalTax = parseFloat(req.body.tax_Share || req.body.Tax_Ded) || 0;

    // If manual shares are not valid numbers, auto-compute based on the new rate.
    if (isNaN(finalSSS) || isNaN(finalPH) || isNaN(finalHD)) {
      const shares = computeMonthlyShares(parsed);
      if (isNaN(finalSSS)) finalSSS = shares.sss_Share;
      if (isNaN(finalPH))  finalPH  = shares.philhealth_Share;
      if (isNaN(finalHD))  finalHD  = shares.hdmf_Share;
    }

    // Process other deductions
    const fHC = parseFloat(healthCard_Amnt) || 0;
    const fSL = parseFloat(SSS_Loan) || 0;
    const fHL = parseFloat(HDMF_Loan) || 0;
    const fCL = parseFloat(calamityLoan_Amnt) || 0;
    const fAA = parseFloat(advances_Amnt) || 0;
    const fGD = parseFloat(globe_Deduction) || 0;
    const fMS = parseFloat(multiPurposeSavings) || 0;

    console.log(`[UPDATE_RATE] Final Shares: SSS=${finalSSS}, PH=${finalPH}, HD=${finalHD}, Tax=${finalTax}`);
    console.log(`[UPDATE_RATE] Other Deds: HC=${fHC}, SL=${fSL}, HL=${fHL}, CL=${fCL}, AA=${fAA}, GD=${fGD}, MS=${fMS}`);

    try {
      const [result, metadata] = await sequelize.query(
        `UPDATE "User"
         SET
           "previousDailyRate"   = "dailyRate",
           "dailyRate"           = :newDailyRate,
           "sss_Share"           = :sss,
           "philhealth_Share"    = :ph,
           "hdmf_Share"          = :hd,
           "tax_Share"           = :tax,
           "healthCard_Amnt"     = :hc,
           "SSS_Loan"            = :sl,
           "HDMF_Loan"           = :hl,
           "calamityLoan_Amnt"   = :cl,
           "advances_Amnt"       = :aa,
           "globe_Deduction"     = :gd,
           "multiPurposeSavings" = :ms,
           "rateUpdatedAt"       = :now,
           "updatedAt"           = :now
         WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
        {
          replacements: { 
            newDailyRate: parsed, 
            sss: finalSSS,
            ph: finalPH,
            hd: finalHD,
            tax: finalTax,
            hc: fHC,
            sl: fSL,
            hl: fHL,
            cl: fCL,
            aa: fAA,
            gd: fGD,
            ms: fMS,
            now: nowStr, 
            user_Id 
          },
          type: QueryTypes.UPDATE,
        },
      );
      console.log(`[UPDATE_RATE] SQL Executed. Affected Rows:`, metadata);
    } catch (sqlErr) {
      console.error("[SQL UPDATE ERROR]:", sqlErr.message);
      // Fallback
      await sequelize.query(
        `UPDATE "User" SET "dailyRate" = :newDailyRate, "previousDailyRate" = "dailyRate", "rateUpdatedAt" = :now WHERE "user_Id" = :user_Id`,
        { replacements: { newDailyRate: parsed, now: nowStr, user_Id }, type: QueryTypes.UPDATE }
      );
    }

    const updatedResult = await sequelize.query(
      `SELECT
         "user_Id", "user_FirstName", "user_LastName",
         "dailyRate", "previousDailyRate", "rateUpdatedAt",
         "sss_Share", "philhealth_Share", "hdmf_Share", "tax_Share",
         "healthCard_Amnt", "SSS_Loan", "HDMF_Loan", "calamityLoan_Amnt",
         "advances_Amnt", "globe_Deduction", "multiPurposeSavings"
       FROM "User"
       WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    const updated = updatedResult[0];
    const newRateData = { dailyRate: updated.dailyRate, previousDailyRate: updated.previousDailyRate };
    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "User Management", "UPDATE_DAILY_RATE", "User", user_Id, oldRateData, newRateData);

    res.status(200).json({
      message: "Daily rate and gov't shares updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("[UPDATE DAILY RATE ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};
