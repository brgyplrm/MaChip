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
exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await sequelize.query(
      `SELECT a.*, u."user_FirstName", u."user_LastName", u."user_Email", u."user_RoleId" 
       FROM "Audit_Log" a
       LEFT JOIN "User" u ON a."user_Id" = u."user_Id"
       ORDER BY a."createdAt" DESC LIMIT 500`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTransactionLogs = async (req, res) => {
  try {
    const logs = await sequelize.query(
      `SELECT t.*, u."user_FirstName" AS "emp_FirstName", u."user_LastName" AS "emp_LastName",
              a."user_FirstName" AS "admin_FirstName", a."user_LastName" AS "admin_LastName" 
       FROM "Transaction_Log" t
       LEFT JOIN "User" u ON t."user_Id" = u."user_Id"
       LEFT JOIN "User" a ON t."initiated_By" = a."user_Id"
       ORDER BY t."createdAt" DESC LIMIT 500`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getEmployeeSummary = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await sequelize.query(
      `SELECT "user_Id", "user_FirstName", "user_LastName", "hireDate", "position", "department"
       FROM "User" WHERE "user_Id" = :userId`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    if (user.length === 0) return res.status(404).json({ error: "User not found." });

    const now = await getSystemTime();
    const hireDate = new Date(user[0].hireDate);
    const tenureDays = Math.floor((now - hireDate) / (1000 * 60 * 60 * 24));
    const tenureYears = (tenureDays / 365.25).toFixed(1);

    // Payroll History (Last 12 months)
    const payrollHistory = await sequelize.query(
      `SELECT p."period_End", p."netPay", p."totalEarnings", pe."OT_Amnt", pe."nightDiff_Amnt"
       FROM "Payroll" p
       LEFT JOIN "Payroll_Earnings" pe ON p."payrollId" = pe."payrollId"
       WHERE p."user_Id" = :userId AND p."status" = 3
       ORDER BY p."period_End" DESC LIMIT 24`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    // Yearly Aggregates
    const yearlyStats = await sequelize.query(
      `SELECT EXTRACT(YEAR FROM "period_End") as "year", 
              SUM("netPay") as "totalNet", 
              SUM("totalEarnings") as "totalGross",
              SUM(pe."OT_Hrs") as "totalOT"
       FROM "Payroll" p
       LEFT JOIN "Payroll_Earnings" pe ON p."payrollId" = pe."payrollId"
       WHERE p."user_Id" = :userId AND p."status" = 3
       GROUP BY "year" ORDER BY "year" DESC`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    res.status(200).json({
      profile: user[0],
      tenure: { days: tenureDays, years: parseFloat(tenureYears) },
      history: payrollHistory,
      yearly: yearlyStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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
        let msg = "Account Number must be 12 or 15 digits.";
        if (account_Number.length < 12) {
          const missing = 12 - account_Number.length;
          msg = `Account Number must be 12 or 15 digits (${missing} more digit${missing > 1 ? "s" : ""} required).`;
        } else if (account_Number.length > 12 && account_Number.length < 15) {
          const missing = 15 - account_Number.length;
          msg = `Account Number must be 12 or 15 digits (${missing} more digit${missing > 1 ? "s" : ""} required for 15 digits).`;
        } else if (account_Number.length > 15) {
          const extra = account_Number.length - 15;
          msg = `Account Number must be 12 or 15 digits (${extra} digit${extra > 1 ? "s" : ""} over limit).`;
        }
        return res.status(400).json({ error: msg });
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
        `SELECT h."user_Id" 
         FROM "User_Hardware" h
         JOIN "User" u ON h."user_Id" = u."user_Id"
         WHERE h."user_MachipId" = :user_MachipId AND u."deletedAt" IS NULL`,
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
    const shares = await computeMonthlyShares(dailyRate);

    // Use a transaction for atomic insertion across normalized tables
    const transaction = await sequelize.transaction();
    try {
      // 1. Insert Core User
      await sequelize.query(
        `INSERT INTO "User" (
          "user_Id", "user_FirstName", "user_LastName",
          "user_MiddleName", "user_Email", "user_Password", 
          "user_RoleId", "user_EmploymentStatusId", "user_ProfilePic", 
          "department", "position", "position_id", "hireDate", "taxStatus", 
          "user_Phone", "user_Address", "user_DOB", "user_Gender", "user_ShiftId",
          "dailyRate", "civil_status", "is_solo_parent", "createdAt", "updatedAt"
        ) VALUES (
          :user_Id, :user_FirstName, :user_LastName,
          :user_MiddleName, :user_Email, :user_Password, 
          :user_RoleId, :user_EmploymentStatusId, :user_ProfilePic, 
          :department, :position, :position_id, :hireDate, :taxStatus,
          :user_Phone, :user_Address, :user_DOB, :user_Gender, :user_ShiftId,
          :dailyRate, :civil_status, :is_solo_parent, :now, :now
        )`,
        {
          replacements: {
            user_Id,
            user_FirstName: req.body.user_FirstName,
            user_LastName: req.body.user_LastName,
            user_MiddleName: req.body.user_MiddleName || null,
            user_Email: req.body.user_Email || null,
            user_Password: hashedPassword,
            user_RoleId: req.body.user_RoleId || 2,
            user_EmploymentStatusId: req.body.user_EmploymentStatusId || 1,
            user_ProfilePic: req.file ? `ProfilePictures/${req.file.filename}` : null,
            department: req.body.department || null,
            position: req.body.position || null,
            position_id: req.body.position_id || null,
            hireDate: req.body.hireDate || null,
            taxStatus: req.body.taxStatus || "S",
            user_Phone: req.body.user_Phone || null,
            user_Address: req.body.user_Address || null,
            user_DOB: req.body.user_DOB || null,
            user_Gender: req.body.user_Gender || null,
            user_ShiftId: parseInt(req.body.user_ShiftId) || 1,
            dailyRate,
            civil_status: req.body.civil_status || "Single",
            is_solo_parent: req.body.is_solo_parent === "true" || req.body.is_solo_parent === true,
            now: nowStr,
          },
          type: QueryTypes.INSERT,
          transaction
        },
      );

      // 2. Insert Banking Info
      await sequelize.query(
        `INSERT INTO "User_Banking" (
          "user_Id", "account_Number", "bank_Company", "bank_AccountName", "createdAt", "updatedAt"
        ) VALUES (:user_Id, :account_Number, :bank_Company, :bank_AccountName, :now, :now)`,
        {
          replacements: {
            user_Id,
            account_Number: encrypt(account_Number),
            bank_Company: bank_Company || "UnionBank of the Philippines",
            bank_AccountName: bank_AccountName || null,
            now: nowStr
          },
          type: QueryTypes.INSERT,
          transaction
        }
      );

      // 3. Insert Deduction Profile
      await sequelize.query(
        `INSERT INTO "User_Deduction_Profile" (
          "user_Id", "sss_Share", "philhealth_Share", "hdmf_Share", "createdAt", "updatedAt"
        ) VALUES (:user_Id, :sss, :ph, :hd, :now, :now)`,
        {
          replacements: {
            user_Id,
            sss: parseFloat(req.body.SSS_Ded) || shares.sss_Share,
            ph: parseFloat(req.body.Philhealth_Ded) || shares.philhealth_Share,
            hd: parseFloat(req.body.HDMF_Ded) || shares.hdmf_Share,
            now: nowStr
          },
          type: QueryTypes.INSERT,
          transaction
        }
      );

      // 4. Insert Hardware Info
      let encryptedTemplate = req.body.user_FingerprintTemplate || null;
      if (encryptedTemplate) {
        encryptedTemplate = encrypt(encryptedTemplate);
      }

      await sequelize.query(
        `INSERT INTO "User_Hardware" (
          "user_Id", "user_MachipId", "user_FingerprintId", "user_FingerprintTemplate", "createdAt", "updatedAt"
        ) VALUES (:user_Id, :user_MachipId, :user_FingerprintId, :user_FingerprintTemplate, :now, :now)`,
        {
          replacements: {
            user_Id,
            user_MachipId: req.body.user_MachipId || null,
            user_FingerprintId: req.body.user_FingerprintId || null,
            user_FingerprintTemplate: encryptedTemplate,
            now: nowStr
          },
          type: QueryTypes.INSERT,
          transaction
        }
      );

      await transaction.commit();
      console.log(`[DATABASE SUCCESS] User ${req.body.user_FirstName} ${req.body.user_LastName} (ID: ${user_Id}) has been successfully saved to the database.`);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    // Fetch the created user to return (including associations)
    const newUserResult = await sequelize.query(
      `SELECT u.*, 
              b."account_Number", b."bank_Company", b."bank_AccountName",
              d."sss_Share", d."philhealth_Share", d."hdmf_Share",
              h."user_MachipId", h."user_FingerprintId"
       FROM "User" u
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
       WHERE u."user_Id" = :user_Id`,
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
      `SELECT u.*, 
              r."roleName" AS "user_Role", 
              s."statusName" AS "user_EmploymentStatus",
              p."title" AS "positionTitle", p."department" AS "positionDepartment",
              b."account_Number", b."bank_Company", b."bank_AccountName",
              d."sss_Share", d."philhealth_Share", d."hdmf_Share", d."tax_Share",
              d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", d."calamityLoan_Amnt",
              d."advances_Amnt", d."globe_Deduction", d."eastwest_Loan", d."multiPurposeSavings",
              h."user_MachipId", h."user_FingerprintId",
              u."user_ShiftId",
              (SELECT COUNT(*) > 0 FROM "Payroll_maxicare" m 
               WHERE m."user_Id" = u."user_Id" 
               AND EXTRACT(MONTH FROM m."max_Month") = EXTRACT(MONTH FROM CURRENT_DATE)
               AND EXTRACT(YEAR FROM m."max_Month") = EXTRACT(YEAR FROM CURRENT_DATE)) AS "isMaxicareSubscribed"
       FROM "User" u
       LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
       LEFT JOIN "employementStatus" s ON u."user_EmploymentStatusId" = s."statusId"
       LEFT JOIN "Position" p ON u."position_id" = p."positionId"
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
       WHERE u."deletedAt" IS NULL
       AND u."user_Id" != 999
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
      `SELECT u.*, 
              r."roleName" AS "user_Role", 
              s."statusName" AS "user_EmploymentStatus",
              p."title" AS "positionTitle", p."department" AS "positionDepartment",
              b."account_Number", b."bank_Company", b."bank_AccountName",
              d."sss_Share", d."philhealth_Share", d."hdmf_Share", d."tax_Share",
              d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", d."calamityLoan_Amnt",
              d."advances_Amnt", d."globe_Deduction", d."eastwest_Loan", d."multiPurposeSavings",
              h."user_MachipId", h."user_FingerprintId",
              u."user_ShiftId",
              (SELECT COUNT(*) > 0 FROM "Payroll_maxicare" m 
               WHERE m."user_Id" = u."user_Id" 
               AND EXTRACT(MONTH FROM m."max_Month") = EXTRACT(MONTH FROM CURRENT_DATE)
               AND EXTRACT(YEAR FROM m."max_Month") = EXTRACT(YEAR FROM CURRENT_DATE)) AS "isMaxicareSubscribed"
       FROM "User" u
       LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
       LEFT JOIN "employementStatus" s ON u."user_EmploymentStatusId" = s."statusId"
       LEFT JOIN "Position" p ON u."position_id" = p."positionId"
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
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
      `SELECT u.*, 
              r."roleName" AS "user_Role", 
              s."statusName" AS "user_EmploymentStatus",
              p."title" AS "positionTitle", p."department" AS "positionDepartment",
              b."account_Number", b."bank_Company", b."bank_AccountName",
              d."sss_Share", d."philhealth_Share", d."hdmf_Share", d."tax_Share",
              d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", d."calamityLoan_Amnt",
              d."advances_Amnt", d."globe_Deduction", d."eastwest_Loan", d."multiPurposeSavings",
              h."user_MachipId", h."user_FingerprintId",
              u."user_ShiftId",
              (SELECT COUNT(*) > 0 FROM "Payroll_maxicare" m 
               WHERE m."user_Id" = u."user_Id" 
               AND EXTRACT(MONTH FROM m."max_Month") = EXTRACT(MONTH FROM CURRENT_DATE)
               AND EXTRACT(YEAR FROM m."max_Month") = EXTRACT(YEAR FROM CURRENT_DATE)) AS "isMaxicareSubscribed"
       FROM "User" u
       LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
       LEFT JOIN "employementStatus" s ON u."user_EmploymentStatusId" = s."statusId"
       LEFT JOIN "Position" p ON u."position_id" = p."positionId"
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
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

    // 1. Get current hardware info to handle MachipId prefixing
    const hardwareResult = await sequelize.query(
      `SELECT "user_MachipId" FROM "User_Hardware" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    
    const currentMachipId = hardwareResult.length > 0 ? hardwareResult[0].user_MachipId : null;
    // Append unique suffix to MachipId to free it up for others
    const archivedMachipId = currentMachipId ? `${currentMachipId}-ARCHIVED-${user_Id}` : null;

    const result = await sequelize.query(
      `UPDATE "User" SET "deletedAt" = :now
       WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
      { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE },
    );

    if (result) {
      // Also soft-delete hardware info and archive the MachipId
      await sequelize.query(
        `UPDATE "User_Hardware" SET "deletedAt" = :now, "user_MachipId" = :archivedMachipId
         WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id, now: nowStr, archivedMachipId }, type: QueryTypes.UPDATE },
      );

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

    // 1. Get current hardware info
    const hardwareResult = await sequelize.query(
      `SELECT "user_MachipId" FROM "User_Hardware" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );

    const currentMachipId = hardwareResult.length > 0 ? hardwareResult[0].user_MachipId : null;
    let targetMachipId = null;

    if (currentMachipId) {
      // If it has our new suffix, strip it. If not, try the ID as-is.
      targetMachipId = currentMachipId.includes("-ARCHIVED-") 
        ? currentMachipId.split("-ARCHIVED-")[0] 
        : currentMachipId;
      
      // Check if this ID is already assigned to an ACTIVE user
      const taken = await sequelize.query(
        `SELECT h."user_Id" 
         FROM "User_Hardware" h
         JOIN "User" u ON h."user_Id" = u."user_Id"
         WHERE h."user_MachipId" = :targetMachipId AND u."deletedAt" IS NULL AND u."user_Id" != :user_Id`,
        { replacements: { targetMachipId, user_Id }, type: QueryTypes.SELECT }
      );

      if (taken.length > 0) {
        // ID is taken by someone else, restore user without a card
        targetMachipId = null;
      }
    }

    await sequelize.query(
      `UPDATE "User" SET "deletedAt" = NULL WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.UPDATE },
    );

    // Also restore hardware info
    await sequelize.query(
      `UPDATE "User_Hardware" SET "deletedAt" = NULL, "user_MachipId" = :targetMachipId WHERE "user_Id" = :user_Id`,
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
        `UPDATE "User_Deduction_Profile" SET "healthCard_Amnt" = :amnt WHERE "user_Id" = :id`,
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
  const operator = req.user;
  const isAdmin = operator && parseInt(operator.user_RoleId) === 1;

  // ── 1. AUTHORIZATION CHECK ──
  // If not admin, you can ONLY update your own ID
  if (!isAdmin && parseInt(operator?.user_Id) !== parseInt(user_Id)) {
    return res.status(403).json({ error: "Access denied. You can only update your own profile." });
  }

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
    position_id,
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

  // ... (rest of validation)

  if (account_Number) {
    if (!/^\d+$/.test(account_Number)) {
      return res.status(400).json({ error: "Account Number must contain numbers only." });
    }
    if (![12, 15].includes(account_Number.length)) {
      let msg = "Account Number must be 12 or 15 digits.";
      if (account_Number.length < 12) {
        const missing = 12 - account_Number.length;
        msg = `Account Number must be 12 or 15 digits (${missing} more digit${missing > 1 ? "s" : ""} required).`;
      } else if (account_Number.length > 12 && account_Number.length < 15) {
        const missing = 15 - account_Number.length;
        msg = `Account Number must be 12 or 15 digits (${missing} more digit${missing > 1 ? "s" : ""} required for 15 digits).`;
      } else if (account_Number.length > 15) {
        const extra = account_Number.length - 15;
        msg = `Account Number must be 12 or 15 digits (${extra} digit${extra > 1 ? "s" : ""} over limit).`;
      }
      return res.status(400).json({ error: msg });
    }
  }

  try {
    // Check if new Fingerprint ID is already assigned to another active user
    if (user_FingerprintId) {
      const existingFP = await sequelize.query(
        `SELECT h."user_Id" 
         FROM "User_Hardware" h
         JOIN "User" u ON h."user_Id" = u."user_Id"
         WHERE h."user_FingerprintId" = :user_FingerprintId AND u."deletedAt" IS NULL AND u."user_Id" != :targetId`,
        { replacements: { user_FingerprintId, targetId: parseInt(user_Id) }, type: QueryTypes.SELECT }
      );

      if (existingFP.length > 0) {
        return res.status(400).json({ error: "Fingerprint ID is already assigned to another active user." });
      }
    }

    // Check if new MaChip ID is already assigned to another active user
    if (user_MachipId) {
      const existingMachip = await sequelize.query(
        `SELECT h."user_Id" 
         FROM "User_Hardware" h
         JOIN "User" u ON h."user_Id" = u."user_Id"
         WHERE h."user_MachipId" = :user_MachipId AND u."deletedAt" IS NULL AND u."user_Id" != :targetId`,
        { replacements: { user_MachipId, targetId: parseInt(user_Id) }, type: QueryTypes.SELECT }
      );

      if (existingMachip.length > 0) {
        return res.status(400).json({ error: "MaChip ID is already assigned to another active user." });
      }
    }

    const oldUserResult = await sequelize.query(
      `SELECT u.*, 
              b."account_Number", b."bank_Company", b."bank_AccountName",
              d."sss_Share", d."sss_is_manual", d."philhealth_Share", d."ph_is_manual", d."hdmf_Share", d."hdmf_is_manual", d."tax_Share",
              d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", d."calamityLoan_Amnt",
              d."advances_Amnt", d."globe_Deduction", d."eastwest_Loan", d."multiPurposeSavings",
              h."user_MachipId", h."user_FingerprintId"
       FROM "User" u
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
       WHERE u."user_Id" = :targetId`,
      { replacements: { targetId: parseInt(user_Id) }, type: QueryTypes.SELECT }
    );
    const oldUser = oldUserResult[0];

    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    const transaction = await sequelize.transaction();
    try {
      const parsedDailyRate = parseFloat(dailyRate) || oldUser.dailyRate || 0;
      const rateChanged = Math.abs(parsedDailyRate - oldUser.dailyRate) > 0.01;

      // Auto-compute Government Deductions
      const shares = await computeMonthlyShares(parsedDailyRate);
      
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
      // SECURITY: If not admin, FORCE sensitive fields to stay at their OLD values
      const replacements = {
        targetId: parseInt(user_Id),
        firstName: user_FirstName || null,
        lastName: user_LastName || null,
        middleName: user_MiddleName || null,
        machipId: isAdmin ? (user_MachipId || null) : oldUser.user_MachipId,
        fingerprintId: isAdmin ? (user_FingerprintId || null) : oldUser.user_FingerprintId,
        roleId: isAdmin ? (parseInt(user_RoleId) || 3) : oldUser.user_RoleId,
        statusId: isAdmin ? (parseInt(user_EmploymentStatusId) || 1) : oldUser.user_EmploymentStatusId,
        email: user_Email || null,
        phone: req.body.user_Phone || null,
        address: req.body.user_Address || null,
        dob: req.body.user_DOB || null,
        gender: req.body.user_Gender || null,
        shiftId: isAdmin ? (parseInt(req.body.user_ShiftId) || 1) : oldUser.user_ShiftId,
        accountNumber: encrypt(account_Number) || null,
        bankCompany: bank_Company || null,
        bankAccountName: bank_AccountName || null,
        department: isAdmin ? (department || null) : oldUser.department,
        position: isAdmin ? (position || null) : oldUser.position,
        position_id: isAdmin ? (position_id || null) : oldUser.position_id,
        hireDate: isAdmin ? (hireDate || null) : oldUser.hireDate,
        taxStatus: isAdmin ? (taxStatus || "S") : oldUser.taxStatus,
        civil_status: req.body.civil_status || oldUser.civil_status || "Single",
        is_solo_parent: req.body.is_solo_parent === "true" || req.body.is_solo_parent === true,
        dailyRate: isAdmin ? parsedDailyRate : (oldUser.dailyRate || 0),
        sss: isAdmin ? finalSSS : (oldUser.sss_Share || 0),
        sss_is_manual: isAdmin ? (req.body.sss_is_manual === true || req.body.sss_is_manual === "true") : (oldUser.sss_is_manual || false),
        ph: isAdmin ? finalPH : (oldUser.philhealth_Share || 0),
        ph_is_manual: isAdmin ? (req.body.ph_is_manual === true || req.body.ph_is_manual === "true") : (oldUser.ph_is_manual || false),
        hd: isAdmin ? finalHD : (oldUser.hdmf_Share || 0),
        hdmf_is_manual: isAdmin ? (req.body.hdmf_is_manual === true || req.body.hdmf_is_manual === "true") : (oldUser.hdmf_is_manual || false),
        tax: isAdmin ? (parseFloat(Tax_Ded) || 0) : (oldUser.tax_Share || 0),
        hc: isAdmin ? (parseFloat(healthCard_Amnt) || 0) : (oldUser.healthCard_Amnt || 0),
        sl: isAdmin ? (parseFloat(SSS_Loan) || 0) : (oldUser.SSS_Loan || 0),
        hl: isAdmin ? (parseFloat(HDMF_Loan) || 0) : (oldUser.HDMF_Loan || 0),
        cl: isAdmin ? (parseFloat(calamityLoan_Amnt) || 0) : (oldUser.calamityLoan_Amnt || 0),
        el: isAdmin ? (parseFloat(eastwest_Loan) || 0) : (oldUser.eastwest_Loan || 0),
        gd: isAdmin ? (parseFloat(globe_Deduction) || 0) : (oldUser.globe_Deduction || 0),
        ms: isAdmin ? (parseFloat(multiPurposeSavings) || 0) : (oldUser.multiPurposeSavings || 0),
        aa: isAdmin ? (parseFloat(advances_Amnt) || 0) : (oldUser.advances_Amnt || 0),
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
          "user_RoleId"    = :roleId,
          "user_EmploymentStatusId" = :statusId,
          "user_Email"     = :email,
          "user_Phone"     = :phone,
          "user_Address"   = :address,
          "user_DOB"       = :dob,
          "user_Gender"    = :gender,
          "user_ShiftId"   = :shiftId,
          "department"     = :department,
          "position"       = :position,
          "position_id"    = :position_id,
          "hireDate"       = :hireDate,
          "taxStatus"      = :taxStatus,
          "civil_status"   = :civil_status,
          "is_solo_parent" = :is_solo_parent,
          "dailyRate"      = :dailyRate,
          "updatedAt"      = :updatedAt
          ${rateUpdateSql}
      `;

      // Only update template if provided and not empty
      if (req.body.user_FingerprintTemplate && req.body.user_FingerprintTemplate.trim() !== "") {
        const { encrypt } = require("../utils/encryption.js");
        replacements.fingerprintTemplate = encrypt(req.body.user_FingerprintTemplate);
      }

      if (user_Password && user_Password.trim() !== "") {
        const salt = await bcrypt.genSalt(10);
        replacements.hashedPass = await bcrypt.hash(user_Password, salt);
        sql += `, "user_Password" = :hashedPass`;
      }

      if (req.file) {
        replacements.profilePic = `ProfilePictures/${req.file.filename}`;
        sql += `, "user_ProfilePic" = :profilePic`;
      }

      sql += ` WHERE "user_Id" = :targetId AND "deletedAt" IS NULL`;

      const [resUpdate, metadata] = await sequelize.query(sql, { replacements, type: QueryTypes.UPDATE, transaction });

      // 2. Update/Insert Banking
      await sequelize.query(
        `INSERT INTO "User_Banking" ("user_Id", "account_Number", "bank_Company", "bank_AccountName", "createdAt", "updatedAt")
         VALUES (:targetId, :accountNumber, :bankCompany, :bankAccountName, :updatedAt, :updatedAt)
         ON CONFLICT ("user_Id") DO UPDATE SET
          "account_Number" = EXCLUDED."account_Number",
          "bank_Company" = EXCLUDED."bank_Company",
          "bank_AccountName" = EXCLUDED."bank_AccountName",
          "updatedAt" = EXCLUDED."updatedAt"`,
        { replacements, type: QueryTypes.INSERT, transaction }
      );

      // 3. Update/Insert Deductions
      await sequelize.query(
        `INSERT INTO "User_Deduction_Profile" (
          "user_Id", "sss_Share", "sss_is_manual", "philhealth_Share", "ph_is_manual", "hdmf_Share", "hdmf_is_manual", "tax_Share", "healthCard_Amnt",
          "SSS_Loan", "HDMF_Loan", "calamityLoan_Amnt", "eastwest_Loan", "globe_Deduction",
          "multiPurposeSavings", "advances_Amnt", "createdAt", "updatedAt"
        ) VALUES (
          :targetId, :sss, :sss_is_manual, :ph, :ph_is_manual, :hd, :hdmf_is_manual, :tax, :hc, :sl, :hl, :cl, :el, :gd, :ms, :aa, :updatedAt, :updatedAt
        ) ON CONFLICT ("user_Id") DO UPDATE SET
          "sss_Share" = EXCLUDED."sss_Share",
          "sss_is_manual" = EXCLUDED."sss_is_manual",
          "philhealth_Share" = EXCLUDED."philhealth_Share",
          "ph_is_manual" = EXCLUDED."ph_is_manual",
          "hdmf_Share" = EXCLUDED."hdmf_Share",
          "hdmf_is_manual" = EXCLUDED."hdmf_is_manual",
          "tax_Share" = EXCLUDED."tax_Share",
          "healthCard_Amnt" = EXCLUDED."healthCard_Amnt",
          "SSS_Loan" = EXCLUDED."SSS_Loan",
          "HDMF_Loan" = EXCLUDED."HDMF_Loan",
          "calamityLoan_Amnt" = EXCLUDED."calamityLoan_Amnt",
          "eastwest_Loan" = EXCLUDED."eastwest_Loan",
          "globe_Deduction" = EXCLUDED."globe_Deduction",
          "multiPurposeSavings" = EXCLUDED."multiPurposeSavings",
          "advances_Amnt" = EXCLUDED."advances_Amnt",
          "updatedAt" = EXCLUDED."updatedAt"`,
        { replacements, type: QueryTypes.INSERT, transaction }
      );

      // 4. Update/Insert Hardware
      let hardwareSql = `
        INSERT INTO "User_Hardware" ("user_Id", "user_MachipId", "user_FingerprintId", "createdAt", "updatedAt")
        VALUES (:targetId, :machipId, :fingerprintId, :updatedAt, :updatedAt)
        ON CONFLICT ("user_Id") DO UPDATE SET
          "user_MachipId" = EXCLUDED."user_MachipId",
          "user_FingerprintId" = EXCLUDED."user_FingerprintId",
          "updatedAt" = EXCLUDED."updatedAt"
      `;
      
      if (replacements.fingerprintTemplate) {
        hardwareSql = `
          INSERT INTO "User_Hardware" ("user_Id", "user_MachipId", "user_FingerprintId", "user_FingerprintTemplate", "createdAt", "updatedAt")
          VALUES (:targetId, :machipId, :fingerprintId, :fingerprintTemplate, :updatedAt, :updatedAt)
          ON CONFLICT ("user_Id") DO UPDATE SET
            "user_MachipId" = EXCLUDED."user_MachipId",
            "user_FingerprintId" = EXCLUDED."user_FingerprintId",
            "user_FingerprintTemplate" = EXCLUDED."user_FingerprintTemplate",
            "updatedAt" = EXCLUDED."updatedAt"
        `;
      }
      
      await sequelize.query(hardwareSql, { replacements, type: QueryTypes.INSERT, transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    const updatedUserResult = await sequelize.query(
      `SELECT u.*, 
              b."account_Number", b."bank_Company", b."bank_AccountName",
              d."sss_Share", d."philhealth_Share", d."hdmf_Share", d."tax_Share",
              d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", d."calamityLoan_Amnt",
              d."advances_Amnt", d."globe_Deduction", d."eastwest_Loan", d."multiPurposeSavings",
              h."user_MachipId", h."user_FingerprintId"
       FROM "User" u
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
       WHERE u."user_Id" = :targetId`,
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
         u."user_RoleId",
         u."user_EmploymentStatusId",
         u."user_ProfilePic",
         u."dailyRate",
         u."previousDailyRate",
         u."rateUpdatedAt",
         u."taxStatus",
         u."department",
         u."position",
         u."hireDate",
         u."createdAt",
         u."updatedAt",
         p."title"             AS "positionTitle",
         p."department"        AS "positionDepartment",
         b."account_Number", b."bank_Company", b."bank_AccountName",
         d."sss_Share", d."philhealth_Share", d."hdmf_Share", d."tax_Share",
         d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", d."calamityLoan_Amnt",
         d."advances_Amnt", d."globe_Deduction", d."eastwest_Loan", d."multiPurposeSavings",
         h."user_MachipId", h."user_FingerprintId",
         r."roleName"          AS "user_Role",
         es."statusName"       AS "employmentStatus"
       FROM "User" u
       LEFT JOIN "user_Role"        r  ON u."user_RoleId"             = r."roleId"
       LEFT JOIN "employementStatus" es ON u."user_EmploymentStatusId" = es."statusId"
       LEFT JOIN "Position"         p  ON u."position_id"             = p."positionId"
       LEFT JOIN "User_Banking"     b  ON u."user_Id"                 = b."user_Id"
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id"            = d."user_Id"
       LEFT JOIN "User_Hardware"    h  ON u."user_Id"                 = h."user_Id"
       WHERE u."deletedAt" IS NULL
       AND u."user_Id" != 999
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
        `SELECT u.*, d."sss_Share", d."philhealth_Share", d."hdmf_Share"
         FROM "User" u
         LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
         WHERE u."user_Id" = :user_Id AND u."deletedAt" IS NULL`,
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
      const shares = await computeMonthlyShares(parsed);
      
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

    const transaction = await sequelize.transaction();
    try {
      // 1. Update User Table (Daily Rate)
      // Only shift to previousDailyRate if there's an actual change in the value
      if (rateChanged) {
        await sequelize.query(
          `UPDATE "User"
           SET
             "previousDailyRate"   = "dailyRate",
             "dailyRate"           = :newDailyRate,
             "rateUpdatedAt"       = :now,
             "updatedAt"           = :now
           WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
          {
            replacements: { 
              newDailyRate: parsed, 
              now: nowStr, 
              user_Id 
            },
            type: QueryTypes.UPDATE,
            transaction
          },
        );
      } else {
        // Just update updatedAt if no rate change
        await sequelize.query(
          `UPDATE "User"
           SET "updatedAt" = :now
           WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
          {
            replacements: { now: nowStr, user_Id },
            type: QueryTypes.UPDATE,
            transaction
          }
        );
      }

      // 2. Update/Insert Deductions Table
      await sequelize.query(
        `INSERT INTO "User_Deduction_Profile" (
          "user_Id", "sss_Share", "philhealth_Share", "hdmf_Share", "tax_Share",
          "healthCard_Amnt", "SSS_Loan", "HDMF_Loan", "calamityLoan_Amnt",
          "advances_Amnt", "globe_Deduction", "eastwest_Loan", "multiPurposeSavings",
          "createdAt", "updatedAt"
        ) VALUES (
          :user_Id, :sss, :ph, :hd, :tax, :hc, :sl, :hl, :cl, :aa, :gd, :el, :ms, :now, :now
        ) ON CONFLICT ("user_Id") DO UPDATE SET
          "sss_Share" = EXCLUDED."sss_Share",
          "philhealth_Share" = EXCLUDED."philhealth_Share",
          "hdmf_Share" = EXCLUDED."hdmf_Share",
          "tax_Share" = EXCLUDED."tax_Share",
          "healthCard_Amnt" = EXCLUDED."healthCard_Amnt",
          "SSS_Loan" = EXCLUDED."SSS_Loan",
          "HDMF_Loan" = EXCLUDED."HDMF_Loan",
          "calamityLoan_Amnt" = EXCLUDED."calamityLoan_Amnt",
          "advances_Amnt" = EXCLUDED."advances_Amnt",
          "globe_Deduction" = EXCLUDED."globe_Deduction",
          "eastwest_Loan" = EXCLUDED."eastwest_Loan",
          "multiPurposeSavings" = EXCLUDED."multiPurposeSavings",
          "updatedAt" = EXCLUDED."updatedAt"`,
        {
          replacements: {
            user_Id,
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
            now: nowStr
          },
          type: QueryTypes.INSERT,
          transaction
        }
      );

      await transaction.commit();
      console.log(`[UPDATE_RATE] Normalized tables updated successfully.`);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    const updatedResult = await sequelize.query(
      `SELECT
         u."user_Id", u."user_FirstName", u."user_LastName",
         u."dailyRate", u."previousDailyRate", u."rateUpdatedAt",
         d."sss_Share", d."philhealth_Share", d."hdmf_Share", d."tax_Share",
         d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", d."calamityLoan_Amnt",
         d."advances_Amnt", d."globe_Deduction", d."multiPurposeSavings"
       FROM "User" u
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       WHERE u."user_Id" = :user_Id`,
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
      `SELECT "user_Id" FROM "User_Hardware" WHERE "user_MachipId" = :uid LIMIT 1`,
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
      `SELECT "user_Id" FROM "User_Hardware" WHERE "user_FingerprintId" = :slot LIMIT 1`,
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
    const statusMap = { "Regular": 1, "Probationary": 2 };

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

        const trans = await sequelize.transaction();
        try {
          // 1. Core User
          await sequelize.query(
            `INSERT INTO "User" (
              "user_Id", "user_FirstName", "user_LastName", "user_MiddleName",
              "user_Email", "user_Password", "user_RoleId", "user_EmploymentStatusId",
              "department", "position", "hireDate", "taxStatus", "user_Gender",
              "civil_status", "is_solo_parent",
              "createdAt", "updatedAt"
            ) VALUES (
              :user_Id, :user_FirstName, :user_LastName, :user_MiddleName,
              :user_Email, :user_Password, :roleId, :statusId,
              :department, :position, :hireDate, :taxStatus, :user_Gender,
              :civil_status, :is_solo_parent,
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
                department: userData.department || null,
                position: userData.position || null,
                hireDate: userData.hireDate || null,
                taxStatus: userData.taxStatus || "S",
                user_Gender: userData.user_Gender || null,
                civil_status: userData.civil_status || "Single",
                is_solo_parent: userData.is_solo_parent === "true" || userData.is_solo_parent === true,
                now: nowStr
              },
              type: QueryTypes.INSERT,
              transaction: trans
            }
          );

          // 2. Banking
          await sequelize.query(
            `INSERT INTO "User_Banking" ("user_Id", "bank_Company", "bank_AccountName", "account_Number", "createdAt", "updatedAt")
             VALUES (:user_Id, :bank_Company, :bank_AccountName, :account_Number, :now, :now)`,
            {
              replacements: {
                user_Id: nextId,
                bank_Company: normalizedBank,
                bank_AccountName: userData.bank_AccountName || null,
                account_Number: encAccount,
                now: nowStr
              },
              type: QueryTypes.INSERT,
              transaction: trans
            }
          );

          // 3. Hardware (Placeholder)
          await sequelize.query(
            `INSERT INTO "User_Hardware" ("user_Id", "createdAt", "updatedAt")
             VALUES (:user_Id, :now, :now)`,
            { replacements: { user_Id: nextId, now: nowStr }, type: QueryTypes.INSERT, transaction: trans }
          );

          // 4. Deduction Profile (Initialize with 0s or defaults)
          await sequelize.query(
            `INSERT INTO "User_Deduction_Profile" ("user_Id", "createdAt", "updatedAt")
             VALUES (:user_Id, :now, :now)`,
            { replacements: { user_Id: nextId, now: nowStr }, type: QueryTypes.INSERT, transaction: trans }
          );

          await trans.commit();
          console.log(`[DATABASE SUCCESS] Batch Row ${i + 1}: User ${userData.user_FirstName} ${userData.user_LastName} (ID: ${nextId}) has been successfully saved to the database.`);
          results.success++;
        } catch (innerErr) {
          await trans.rollback();
          throw innerErr;
        }

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
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

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

exports.getUnassignedHardwareUsers = async (req, res) => {
  const { type } = req.query; // 'rfid' or 'fingerprint'
  console.log(`[USER-CONTROLLER] Fetching unassigned hardware users. Type: ${type || 'ALL'}`);

  try {
    let sql = `
      SELECT u."user_Id", u."user_FirstName", u."user_LastName"
      FROM "User" u
      WHERE u."deletedAt" IS NULL
      AND u."user_Id" != 999
    `;

    if (type === 'rfid') {
      sql += ` AND u."user_Id" NOT IN (
        SELECT "user_Id" FROM "User_Hardware" 
        WHERE "user_MachipId" IS NOT NULL AND "user_MachipId" != ''
      )`;
    } else if (type === 'fingerprint') {
      sql += ` AND u."user_Id" NOT IN (
        SELECT "user_Id" FROM "User_Hardware" 
        WHERE "user_FingerprintId" IS NOT NULL
      )`;
    }

    sql += ` ORDER BY u."user_LastName" ASC`;

    const users = await sequelize.query(sql, { type: QueryTypes.SELECT });
    console.log(`[USER-CONTROLLER] Found ${users.length} unassigned users.`);
    res.status(200).json(users);
  } catch (error) {
    console.error("[USER-CONTROLLER] Error fetching unassigned hardware users:", error);
    res.status(500).json({ error: "Failed to fetch unassigned employees." });
  }
};
