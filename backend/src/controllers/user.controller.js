const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const fs = require('fs');
const path = require('path');
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
      account_Number,
      bank_Company,
      bank_AccountName
    } = req.body || {};

    if (!user_FirstName || !user_LastName || !user_Email || !user_Password) {
      return res.status(400).json({
        error: "Missing required fields (First Name, Last Name, Email, or Password).",
      });
    }

    if (account_Number) {
      if (!/^\d+$/.test(account_Number)) {
        return res.status(400).json({ error: "Account Number must contain numbers only." });
      }
      if (![12, 15].includes(account_Number.length)) {
        return res.status(400).json({ error: "Account Number must be 12 or 15 digits." });
      }
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

    const dailyRate = parseFloat(req.body.dailyRate) || 0;
    const shares = computeMonthlyShares(dailyRate);

    // Insert new user
    await sequelize.query(
      `INSERT INTO "User" (
        "user_Id", "user_FirstName", "user_LastName",
        "user_MiddleName", "user_Email", "user_Password", "user_MachipId", "user_FingerprintId", 
        "user_FingerprintTemplate", "user_RoleId", "user_EmploymentStatusId", "user_ProfilePic", 
        "account_Number", "bank_Company", "bank_AccountName", "department", "position", "hireDate", "taxStatus", 
        "dailyRate", "sss_Share", "philhealth_Share", "hdmf_Share", "createdAt", "updatedAt"
      ) VALUES (
        :user_Id, :user_FirstName, :user_LastName,
        :user_MiddleName, :user_Email, :user_Password, :user_MachipId, :user_FingerprintId, 
        :user_FingerprintTemplate, :user_RoleId, :user_EmploymentStatusId, :user_ProfilePic, 
        :account_Number, :bank_Company, :bank_AccountName, :department, :position, :hireDate, :taxStatus,
        :dailyRate, :sss, :ph, :hd, :now, :now
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
          bank_Company: bank_Company || "UnionBank of the Philippines",
          bank_AccountName: bank_AccountName || null,
          department: req.body.department || null,
          position: req.body.position || null,
          hireDate: req.body.hireDate || null,
          taxStatus: req.body.taxStatus || "S",
          dailyRate,
          sss: parseFloat(req.body.SSS_Ded) || shares.sss_Share,
          ph: parseFloat(req.body.Philhealth_Ded) || shares.philhealth_Share,
          hd: parseFloat(req.body.HDMF_Ded) || shares.hdmf_Share,
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
      `SELECT u.*, r."roleName" AS "user_Role", s."statusName" AS "user_EmploymentStatus"
       FROM "User" u
       LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
       LEFT JOIN "employementStatus" s ON u."user_EmploymentStatusId" = s."statusId"
       WHERE u."deletedAt" IS NULL
       ORDER BY u."user_Id" ASC`,
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
      `SELECT u.*, r."roleName" AS "user_Role", s."statusName" AS "user_EmploymentStatus"
       FROM "User" u
       LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
       LEFT JOIN "employementStatus" s ON u."user_EmploymentStatusId" = s."statusId"
       WHERE u."deletedAt" IS NOT NULL
       ORDER BY u."user_Id" ASC`,
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
      `SELECT u.*, r."roleName" AS "user_Role", s."statusName" AS "user_EmploymentStatus"
       FROM "User" u
       LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
       LEFT JOIN "employementStatus" s ON u."user_EmploymentStatusId" = s."statusId"
       WHERE u."user_Id" = :user_Id AND u."deletedAt" IS NULL`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );    if (user.length > 0) {
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

// ── Bulk Update Maxicare Deductions ──────────────────────────────────────────
exports.bulkUpdateMaxicare = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { updates } = req.body; // Array of { user_Id, healthCard_Amnt }
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: "Updates must be an array." });
    }

    for (const update of updates) {
      await sequelize.query(
        `UPDATE "User" SET "healthCard_Amnt" = :amnt WHERE "user_Id" = :id`,
        { 
          replacements: { amnt: update.healthCard_Amnt, id: update.user_Id }, 
          type: QueryTypes.UPDATE,
          transaction
        }
      );
    }

    await transaction.commit();
    res.status(200).json({ message: "Maxicare deductions updated successfully." });
  } catch (error) {
    await transaction.rollback();
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
    bank_Company,
    bank_AccountName,
    department,
    position,
    hireDate,
    taxStatus,
    dailyRate,
    SSS_Ded,
    Philhealth_Ded,
    HDMF_Ded,
    Tax_Ded,
    healthCard_Amnt,
    SSS_Loan,
    HDMF_Loan,
    calamityLoan_Amnt,
    eastwest_Loan,
    globe_Deduction,
    multiPurposeSavings,
    advances_Amnt
  } = req.body || {};

  if (account_Number) {
    if (!/^\d+$/.test(account_Number)) {
      return res.status(400).json({ error: "Account Number must contain numbers only." });
    }
    if (![12, 15].includes(account_Number.length)) {
      return res.status(400).json({ error: "Account Number must be 12 or 15 digits." });
    }
  }

  try {
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

    const parsedDailyRate = parseFloat(dailyRate) || oldUser.dailyRate || 0;
    const rateChanged = Math.abs(parsedDailyRate - oldUser.dailyRate) > 0.01;

    // Auto-compute Government Deductions
    const shares = computeMonthlyShares(parsedDailyRate);
    
    // Logic: Use provided values if they exist, otherwise auto-compute if rate changed or if they are 0
    let finalSSS = parseFloat(SSS_Ded);
    if (isNaN(finalSSS) || (rateChanged && finalSSS === parseFloat(oldUser.sss_Share))) {
      finalSSS = shares.sss_Share;
    }

    let finalPH = parseFloat(Philhealth_Ded);
    if (isNaN(finalPH) || (rateChanged && finalPH === parseFloat(oldUser.philhealth_Share))) {
      finalPH = shares.philhealth_Share;
    }

    let finalHD = parseFloat(HDMF_Ded);
    if (isNaN(finalHD) || (rateChanged && finalHD === parseFloat(oldUser.hdmf_Share))) {
      finalHD = shares.hdmf_Share;
    }

    // Build replacements object with explicit types
    const replacements = {
      targetId: parseInt(user_Id),
      firstName: user_FirstName || null,
      lastName: user_LastName || null,
      middleName: user_MiddleName || null,
      machipId: user_MachipId || null,
      fingerprintId: user_FingerprintId || null,
      roleId: parseInt(user_RoleId) || 3,
      statusId: parseInt(user_EmploymentStatusId) || 1,
      email: user_Email || null,
      accountNumber: encrypt(account_Number) || null,
      bankCompany: bank_Company || null,
      bankAccountName: bank_AccountName || null,
      department: department || null,
      position: position || null,
      hireDate: hireDate || null,
      taxStatus: taxStatus || "S",
      dailyRate: parsedDailyRate,
      sss: finalSSS,
      ph: finalPH,
      hd: finalHD,
      tax: parseFloat(Tax_Ded) || oldUser.tax_Share || 0,
      hc: parseFloat(healthCard_Amnt) || oldUser.healthCard_Amnt || 0,
      sl: parseFloat(SSS_Loan) || oldUser.SSS_Loan || 0,
      hl: parseFloat(HDMF_Loan) || oldUser.HDMF_Loan || 0,
      cl: parseFloat(calamityLoan_Amnt) || oldUser.calamityLoan_Amnt || 0,
      el: parseFloat(eastwest_Loan) || oldUser.eastwest_Loan || 0,
      gd: parseFloat(globe_Deduction) || oldUser.globe_Deduction || 0,
      ms: parseFloat(multiPurposeSavings) || oldUser.multiPurposeSavings || 0,
      aa: parseFloat(advances_Amnt) || oldUser.advances_Amnt || 0,
      updatedAt: nowStr
    };

    // Handle Daily Rate Update logic (tracking previous rate)
    let rateUpdateSql = "";
    if (Math.abs(replacements.dailyRate - oldUser.dailyRate) > 0.01) {
      replacements.prevRate = oldUser.dailyRate;
      replacements.rateUpdate = nowStr;
      rateUpdateSql = `, "previousDailyRate" = :prevRate, "rateUpdatedAt" = :rateUpdate`;
    }

    let sql = `
      UPDATE "User" SET 
        "user_FirstName" = :firstName,
        "user_LastName"  = :lastName,
        "user_MiddleName"= :middleName,
        "user_MachipId"  = :machipId,
        "user_FingerprintId" = :fingerprintId,
        "user_RoleId"    = :roleId,
        "user_EmploymentStatusId" = :statusId,
        "user_Email"     = :email,
        "account_Number" = :accountNumber,
        "bank_Company"   = :bankCompany,
        "bank_AccountName" = :bankAccountName,
        "department"     = :department,
        "position"       = :position,
        "hireDate"       = :hireDate,
        "taxStatus"      = :taxStatus,
        "dailyRate"      = :dailyRate,
        "sss_Share"      = :sss,
        "philhealth_Share" = :ph,
        "hdmf_Share"     = :hd,
        "tax_Share"      = :tax,
        "healthCard_Amnt" = :hc,
        "SSS_Loan"       = :sl,
        "HDMF_Loan"      = :hl,
        "calamityLoan_Amnt" = :cl,
        "eastwest_Loan"  = :el,
        "globe_Deduction"= :gd,
        "multiPurposeSavings" = :ms,
        "advances_Amnt"  = :aa,
        "updatedAt"      = :updatedAt
        ${rateUpdateSql}
    `;

    // Only update template if provided and not empty
    if (req.body.user_FingerprintTemplate && req.body.user_FingerprintTemplate.trim() !== "") {
      replacements.fingerprintTemplate = req.body.user_FingerprintTemplate;
      sql += `, "user_FingerprintTemplate" = :fingerprintTemplate`;
    }

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

    console.log("[DEBUG] Executing SQL in updateUser:", sql);
    console.log("[DEBUG] Replacements:", { ...replacements, fingerprintTemplate: replacements.fingerprintTemplate ? "REDACTED" : "NONE" });

    const [result, metadata] = await sequelize.query(sql, { replacements, type: QueryTypes.UPDATE });
    console.log("[DEBUG] Affected Rows in updateUser:", metadata);

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
         u."eastwest_Loan",
         u."multiPurposeSavings",
         u."taxStatus",
         u."department",
         u."position",
         u."hireDate",
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
      try {
        if (emp.account_Number) {
          emp.account_Number = decrypt(emp.account_Number);
        }
      } catch (decErr) {
        console.warn(`[MASTERLIST] Decryption failed for user ${emp.user_Id}:`, decErr.message);
      }
      return emp;
    });

    console.log(`[MASTERLIST] Successfully fetched and processed ${decryptedEmployees.length} employees.`);
    res.status(200).json(decryptedEmployees);
  } catch (error) {
    console.error("[GET MASTERLIST ERROR]:", error);
    res.status(500).json({ 
      error: "Internal Server Error in Masterlist.",
      details: error.message 
    });
  }
};

// ── Update Daily Rate ─────────────────────────────────────────────────────────
exports.updateDailyRate = async (req, res) => {
  const { user_Id } = req.params;
  const {
    newDailyRate, sss_Share, philhealth_Share, hdmf_Share,
    healthCard_Amnt, SSS_Loan, HDMF_Loan, calamityLoan_Amnt,
    advances_Amnt, globe_Deduction, eastwest_Loan, multiPurposeSavings
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

    // Ensure manual shares are treated as numbers
    let finalSSS = parseFloat(sss_Share);
    let finalPH  = parseFloat(philhealth_Share);
    let finalHD  = parseFloat(hdmf_Share);
    let finalTax = parseFloat(req.body.tax_Share || req.body.Tax_Ded) || 0;

    // AUTO-UPDATE LOGIC: 
    // If the rate has changed, we should recompute shares unless the user 
    // explicitly provided NEW manual values that are different from both the old ones 
    // and the default calculation. For simplicity, if the rate changed and the 
    // provided shares are NaN, or if they match the OLD shares, we recompute.
    const rateChanged = Math.abs(parsed - currentRate) > 0.01;
    
    if (rateChanged || isNaN(finalSSS) || isNaN(finalPH) || isNaN(finalHD)) {
      const shares = computeMonthlyShares(parsed);
      
      // If SSS was not provided OR it matches the old rate's SSS, update it to the new one
      if (isNaN(finalSSS) || (rateChanged && finalSSS === parseFloat(existing[0].sss_Share))) {
        finalSSS = shares.sss_Share;
      }
      if (isNaN(finalPH) || (rateChanged && finalPH === parseFloat(existing[0].philhealth_Share))) {
        finalPH = shares.philhealth_Share;
      }
      if (isNaN(finalHD) || (rateChanged && finalHD === parseFloat(existing[0].hdmf_Share))) {
        finalHD = shares.hdmf_Share;
      }
    }

    // Process other deductions
    const fHC = parseFloat(healthCard_Amnt) || 0;
    const fSL = parseFloat(SSS_Loan) || 0;
    const fHL = parseFloat(HDMF_Loan) || 0;
    const fCL = parseFloat(calamityLoan_Amnt) || 0;
    const fAA = parseFloat(advances_Amnt) || 0;
    const fGD = parseFloat(globe_Deduction) || 0;
    const fEL = parseFloat(eastwest_Loan) || 0;
    const fMS = parseFloat(multiPurposeSavings) || 0;

    console.log(`[UPDATE_RATE] Final Shares: SSS=${finalSSS}, PH=${finalPH}, HD=${finalHD}, Tax=${finalTax}`);
    console.log(`[UPDATE_RATE] Other Deds: HC=${fHC}, SL=${fSL}, HL=${fHL}, CL=${fCL}, AA=${fAA}, GD=${fGD}, EL=${fEL}, MS=${fMS}`);

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
           "eastwest_Loan"       = :el,
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
            el: fEL,
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

exports.checkMaChip = async (req, res) => {
  const { uid } = req.params;
  try {
    const results = await sequelize.query(
      `SELECT "user_Id" FROM "User" WHERE "user_MachipId" = :uid AND "deletedAt" IS NULL LIMIT 1`,
      { replacements: { uid }, type: QueryTypes.SELECT }
    );
    if (results.length > 0) {
      return res.status(200).json({ exists: true, user_Id: results[0].user_Id });
    }
    res.status(200).json({ exists: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.checkFingerprint = async (req, res) => {
  const { slot } = req.params;
  try {
    const results = await sequelize.query(
      `SELECT "user_Id" FROM "User" WHERE "user_FingerprintId" = :slot AND "deletedAt" IS NULL LIMIT 1`,
      { replacements: { slot: parseInt(slot) }, type: QueryTypes.SELECT }
    );
    if (results.length > 0) {
      return res.status(200).json({ exists: true, user_Id: results[0].user_Id });
    }
    res.status(200).json({ exists: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Batch Register Users (CSV) ────────────────────────────────────────────────
exports.batchRegisterUsers = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No CSV file uploaded." });
  }

  const filePath = req.file.path;

  try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const content = rawContent.replace(/^\uFEFF/, '');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 2) {
      return res.status(400).json({ error: "CSV file is empty or missing data." });
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const usersData = [];

    // Map headers to indices
    const headerMap = {};
    headers.forEach((h, i) => headerMap[h] = i);

    const requiredFields = ['user_FirstName', 'user_LastName', 'user_Email', 'user_Password'];
    for (const field of requiredFields) {
      if (headerMap[field] === undefined) {
        return res.status(400).json({ error: `Missing required column: ${field}` });
      }
    }

    // Role and Status Maps
    const roleMap = { "Admin Manager": 1, "Supervisor": 2, "Employee": 3, "Admin Accountant": 4 };
    const statusMap = { "Regular": 1, "Part-time": 2, "Intern / OJT": 3 };

    // Bank Normalization Map
    const bankMap = {
      "unionbank": "UnionBank of the Philippines",
      "bdo": "BDO Unibank (BDO)",
      "bpi": "Bank of the Philippine Islands (BPI)",
      "metrobank": "Metropolitan Bank and Trust (Metrobank)",
      "landbank": "Land Bank of the Philippines (LANDBANK)",
      "pnb": "Philippine National Bank (PNB)",
      "chinabank": "China Banking Corporation (Chinabank)",
      "rcbc": "Rizal Commercial Banking Corporation (RCBC)",
      "eastwest": "EastWest Bank",
      "gcash": "GCash",
      "maya": "Maya Bank"
    };

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < headers.length) continue;

      const userData = {};
      headers.forEach((h, idx) => {
        userData[h] = cols[idx];
      });

      try {
        // Validation
        if (!userData.user_FirstName || !userData.user_LastName || !userData.user_Email || !userData.user_Password) {
          throw new Error("Missing required data in row " + (i + 1));
        }

        // Check if email exists
        const [existing] = await sequelize.query(
          `SELECT "user_Id" FROM "User" WHERE "user_Email" = :email`,
          { replacements: { email: userData.user_Email }, type: QueryTypes.SELECT }
        );

        if (existing) {
          throw new Error(`Email ${userData.user_Email} already exists.`);
        }

        // Get next ID
        const [maxIdResult] = await sequelize.query(
          `SELECT MAX("user_Id") AS "maxId" FROM "User"`,
          { type: QueryTypes.SELECT }
        );
        const nextId = (maxIdResult.maxId ? parseInt(maxIdResult.maxId) : 0) + 1;

        const roleId = roleMap[userData.user_Role] || 3;
        const statusId = statusMap[userData.user_EmploymentStatus] || 1;

        // Bank Normalization
        let normalizedBank = userData.bank_Company || "UnionBank of the Philippines";
        const bankKey = normalizedBank.toLowerCase().replace(/\s+/g, '');
        for (const [key, fullName] of Object.entries(bankMap)) {
          if (bankKey.includes(key)) {
            normalizedBank = fullName;
            break;
          }
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.user_Password, salt);

        // Encrypt Account Number if present
        let encAccount = null;
        if (userData.account_Number) {
          encAccount = encrypt(userData.account_Number);
        }

        await sequelize.query(
          `INSERT INTO "User" (
            "user_Id", "user_FirstName", "user_LastName", "user_MiddleName",
            "user_Email", "user_Password", "user_RoleId", "user_EmploymentStatusId",
            "bank_Company", "bank_AccountName", "account_Number",
            "department", "position", "hireDate", "taxStatus",
            "createdAt", "updatedAt"
          ) VALUES (
            :user_Id, :user_FirstName, :user_LastName, :user_MiddleName,
            :user_Email, :user_Password, :roleId, :statusId,
            :bank_Company, :bank_AccountName, :account_Number,
            :department, :position, :hireDate, :taxStatus,
            :now, :now
          )`,
          {
            replacements: {
              user_Id: nextId,
              user_FirstName: userData.user_FirstName,
              user_LastName: userData.user_LastName,
              user_MiddleName: userData.user_MiddleName || null,
              user_Email: userData.user_Email,
              user_Password: hashedPassword,
              roleId,
              statusId,
              bank_Company: normalizedBank,
              bank_AccountName: userData.bank_AccountName || null,
              account_Number: encAccount,
              department: userData.department || null,
              position: userData.position || null,
              hireDate: userData.hireDate || null,
              taxStatus: userData.taxStatus || "S",
              now: nowStr
            },
            type: QueryTypes.INSERT
          }
        );

        results.success++;

        // Send welcome email after successful registration (Non-blocking)
        const displayId = `MACJ-${String(nextId).padStart(3, "0")}`;
        sendWelcomeEmail({
          email: userData.user_Email,
          password: userData.user_Password, // Use raw password from CSV
          name: `${userData.user_FirstName} ${userData.user_LastName}`,
          displayId: displayId
        }).catch(emailError => {
          console.error(`[BATCH WELCOME EMAIL ERROR for ${userData.user_Email}]:`, emailError.message);
        });
      } catch (err) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.status(200).json({
      message: `Processed ${lines.length - 1} rows. ${results.success} succeeded, ${results.failed} failed.`,
      results
    });

  } catch (error) {
    console.error("[BATCH REGISTER ERROR]:", error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: error.message });
  }
};
