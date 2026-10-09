const { sequelize, SystemSettings } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const fs = require('fs');
const path = require('path');
const bcrypt = require("bcryptjs");
const { getSystemTime, formatForSQL } = require("../utils/systemTime");
const { validateEmailActive, sendWelcomeEmail, sendPasswordUpdateEmail } = require("../utils/emailService");
const { logAudit } = require("../utils/logger");
const { encrypt, decrypt } = require("../utils/encryption");
const { computeMonthlyShares } = require("../utils/govtDeductions");
const { queueSlotDeletion } = require("./rfid.controller");

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

    const { validatePassword } = require("../utils/passwordValidator");
    const pwdValidation = validatePassword(user_Password);
    if (!pwdValidation.isValid) {
      return res.status(400).json({ error: pwdValidation.message });
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

    const targetRoleId = parseInt(req.body.user_RoleId, 10) || 3;

    // Verify Admin Password if assigning elevated roles (Admin Manager 1, Supervisor 2, Accountant 4)
    if (targetRoleId !== 3) {
      const { adminConfirmPassword } = req.body;
      if (!adminConfirmPassword) {
        return res.status(400).json({ error: "Admin confirmation password is required to assign elevated roles." });
      }
      const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
      const [adminRecord] = await sequelize.query(
        `SELECT "user_Password" FROM "User" WHERE "user_Id" = :adminId`,
        { replacements: { adminId: currentAdminId }, type: QueryTypes.SELECT }
      );
      if (!adminRecord || !(await bcrypt.compare(adminConfirmPassword, adminRecord.user_Password))) {
        return res.status(401).json({ error: "Invalid admin confirmation password." });
      }
    }

    const settings = await SystemSettings.findOne();
    let assignedShiftId = parseInt(req.body.user_ShiftId) || 1;
    if (!settings?.enableNightShift && assignedShiftId === 2) {
      assignedShiftId = 1;
    }

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
            user_RoleId: targetRoleId,
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
            user_ShiftId: assignedShiftId,
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

      // 5. Initialize Leave_Balance for the current year
      const currentYear = now.getFullYear();
      const isSoloParentBool = req.body.is_solo_parent === "true" || req.body.is_solo_parent === true;
      const soloParentCredit = isSoloParentBool ? 7 : 0;
      await sequelize.query(
        `INSERT INTO "Leave_Balance" 
         ("user_Id", "year", "VL_balance", "SL_balance", "SoloParent_balance", "VL_used", "SL_used", "SoloParent_used", "createdAt", "updatedAt")
         VALUES (:user_Id, :currentYear, 7, 7, :soloParentCredit, 0, 0, 0, :now, :now)
         ON CONFLICT ("user_Id", "year") DO NOTHING`,
        {
          replacements: { user_Id, currentYear, soloParentCredit, now: nowStr },
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

    // SECURITY FIX: Never persist or disclose password hash/tokens in response or audit log
    delete newUser.user_Password;
    delete newUser.resetPasswordToken;
    delete newUser.resetPasswordExpires;

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

    const requesterId = req.user ? parseInt(req.user.user_Id, 10) : null;
    const requesterRoleId = req.user ? parseInt(req.user.user_RoleId, 10) : null;
    const requesterRoleName = req.user ? req.user.user_Role : "";
    const isFinanceOrAdmin = [1, 4].includes(requesterRoleId) ||
      ["Admin Manager", "Admin Accountant", "Admin"].includes(requesterRoleName);

    const sanitizedUsers = users.map(user => {
      // SECURITY FIX: Never leak password hashes or reset tokens in API responses
      delete user.user_Password;
      delete user.resetPasswordToken;
      delete user.resetPasswordExpires;

      if (user.account_Number) {
        const decryptedAccount = decrypt(user.account_Number);
        const isOwner = requesterId === parseInt(user.user_Id, 10);
        if (isOwner || isFinanceOrAdmin) {
          user.account_Number = decryptedAccount;
        } else {
          user.account_Number = decryptedAccount && decryptedAccount.length > 4
            ? `****${decryptedAccount.slice(-4)}`
            : "****";
        }
      }

      // If requester is not finance or admin (e.g. Supervisor), mask dailyRate & deduction profile
      if (!isFinanceOrAdmin) {
        delete user.dailyRate;
        delete user.previousDailyRate;
        delete user.rateUpdatedAt;
        delete user.sss_Share;
        delete user.philhealth_Share;
        delete user.hdmf_Share;
        delete user.tax_Share;
        delete user.healthCard_Amnt;
        delete user.SSS_Loan;
        delete user.HDMF_Loan;
        delete user.calamityLoan_Amnt;
        delete user.advances_Amnt;
        delete user.globe_Deduction;
        delete user.eastwest_Loan;
        delete user.multiPurposeSavings;
      }

      return user;
    });

    res.status(200).json(sanitizedUsers);
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

    const requesterId = req.user ? parseInt(req.user.user_Id, 10) : null;
    const requesterRoleId = req.user ? parseInt(req.user.user_RoleId, 10) : null;
    const requesterRoleName = req.user ? req.user.user_Role : "";
    const isFinanceOrAdmin = [1, 4].includes(requesterRoleId) ||
      ["Admin Manager", "Admin Accountant", "Admin"].includes(requesterRoleName);

    const sanitizedUsers = users.map(user => {
      // SECURITY FIX: Never leak password hashes or reset tokens in API responses
      delete user.user_Password;
      delete user.resetPasswordToken;
      delete user.resetPasswordExpires;

      if (user.account_Number) {
        const decryptedAccount = decrypt(user.account_Number);
        const isOwner = requesterId === parseInt(user.user_Id, 10);
        if (isOwner || isFinanceOrAdmin) {
          user.account_Number = decryptedAccount;
        } else {
          user.account_Number = decryptedAccount && decryptedAccount.length > 4
            ? `****${decryptedAccount.slice(-4)}`
            : "****";
        }
      }

      if (!isFinanceOrAdmin) {
        delete user.dailyRate;
        delete user.previousDailyRate;
        delete user.rateUpdatedAt;
      }

      return user;
    });

    res.status(200).json(sanitizedUsers);
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

      // SECURITY FIX (T-001): Never leak password hash or reset tokens in API responses
      delete userData.user_Password;
      delete userData.resetPasswordToken;
      delete userData.resetPasswordExpires;

      if (userData.account_Number) {
        const decryptedAccount = decrypt(userData.account_Number);
        const requesterId = req.user ? parseInt(req.user.user_Id, 10) : null;
        const requesterRoleId = req.user ? parseInt(req.user.user_RoleId, 10) : null;
        const requesterRoleName = req.user ? req.user.user_Role : "";
        const isOwner = requesterId === parseInt(userData.user_Id, 10);
        const isFinanceOrAdmin = [1, 4].includes(requesterRoleId) ||
          ["Admin Manager", "Admin Accountant", "Admin"].includes(requesterRoleName);

        if (isOwner || isFinanceOrAdmin) {
          userData.account_Number = decryptedAccount;
        } else {
          userData.account_Number = decryptedAccount && decryptedAccount.length > 4
            ? `****${decryptedAccount.slice(-4)}`
            : "****";
        }
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

    // 1. Get current hardware info to handle MachipId prefixing and slot deletion
    const hardwareResult = await sequelize.query(
      `SELECT "user_MachipId", "user_FingerprintId", "user_FingerprintId2" FROM "User_Hardware" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    
    const currentMachipId = hardwareResult.length > 0 ? hardwareResult[0].user_MachipId : null;
    const currentFpSlot = hardwareResult.length > 0 ? hardwareResult[0].user_FingerprintId : null;
    const currentFpSlot2 = hardwareResult.length > 0 ? hardwareResult[0].user_FingerprintId2 : null;
    // Append unique suffix to MachipId to free it up for others
    const archivedMachipId = currentMachipId ? `${currentMachipId}-ARCHIVED-${user_Id}` : null;

    const result = await sequelize.query(
      `UPDATE "User" SET "deletedAt" = :now
       WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
      { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE },
    );

    if (result) {
      // Also soft-delete hardware info, archive the MachipId, and wipe fingerprint
      await sequelize.query(
        `UPDATE "User_Hardware" 
         SET "deletedAt" = :now, 
             "user_MachipId" = :archivedMachipId, 
             "user_FingerprintId" = NULL, 
             "user_FingerprintTemplate" = NULL,
             "user_FingerprintId2" = NULL,
             "user_FingerprintTemplate2" = NULL,
             "updatedAt" = :now
         WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id, now: nowStr, archivedMachipId }, type: QueryTypes.UPDATE },
      );

      if (currentFpSlot) {
        queueSlotDeletion(currentFpSlot);
      }
      if (currentFpSlot2) {
        queueSlotDeletion(currentFpSlot2);
      }

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

// ── Restore Soft-Deleted User (Re-Hire) ───────────────────────────────────────
exports.restoreUser = async (req, res) => {
  const { user_Id } = req.params;
  const {
    hireDate,
    user_EmploymentStatusId,
    department,
    position,
    position_id,
    dailyRate
  } = req.body || {};

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

    const oldUser = user[0];
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

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
        targetMachipId = null;
      }
    }

    // Determine updated values
    const newHireDate = hireDate || now.toISOString().split("T")[0];
    const newStatusId = parseInt(user_EmploymentStatusId) || 1; // Default to Regular (1)
    const newDepartment = department || oldUser.department;
    const newPosition = position || oldUser.position;
    const newPositionId = position_id || oldUser.position_id;

    // Rate update tracking
    let newDailyRate = oldUser.dailyRate;
    let newPrevRate = oldUser.previousDailyRate || 0;
    let newRateUpdatedAt = oldUser.rateUpdatedAt;

    if (dailyRate !== undefined && dailyRate !== null && !isNaN(parseFloat(dailyRate))) {
      const parsedRate = parseFloat(dailyRate);
      if (Math.abs(parsedRate - parseFloat(oldUser.dailyRate || 0)) > 0.01) {
        newPrevRate = parseFloat(oldUser.dailyRate || 0);
        newDailyRate = parsedRate;
        newRateUpdatedAt = nowStr;

        // Recompute deduction profile shares for the new rate
        try {
          const shares = await computeMonthlyShares(newDailyRate);
          await sequelize.query(
            `UPDATE "User_Deduction_Profile" 
             SET "sss_Share" = :sss, "philhealth_Share" = :ph, "hdmf_Share" = :hd, "updatedAt" = :now
             WHERE "user_Id" = :user_Id`,
            { 
              replacements: { 
                user_Id, 
                sss: shares.sss_Share, 
                ph: shares.philhealth_Share, 
                hd: shares.hdmf_Share, 
                now: nowStr 
              }, 
              type: QueryTypes.UPDATE 
            }
          );
        } catch (shareErr) {
          console.error(`[RESTORE] Failed to update deduction shares: ${shareErr.message}`);
        }
      }
    }

    // Update User: clear deletedAt, refresh hire date, status to Regular, department, position, daily rate
    await sequelize.query(
      `UPDATE "User" SET 
         "deletedAt" = NULL,
         "hireDate" = :hireDate,
         "user_EmploymentStatusId" = :statusId,
         "department" = :department,
         "position" = :position,
         "position_id" = :position_id,
         "dailyRate" = :dailyRate,
         "previousDailyRate" = :prevRate,
         "rateUpdatedAt" = :rateUpdatedAt,
         "updatedAt" = :now
       WHERE "user_Id" = :user_Id`,
      { 
        replacements: { 
          user_Id, 
          hireDate: newHireDate,
          statusId: newStatusId,
          department: newDepartment,
          position: newPosition,
          position_id: newPositionId,
          dailyRate: newDailyRate,
          prevRate: newPrevRate,
          rateUpdatedAt: newRateUpdatedAt,
          now: nowStr 
        }, 
        type: QueryTypes.UPDATE 
      },
    );

    // Also restore hardware info
    await sequelize.query(
      `UPDATE "User_Hardware" 
       SET "deletedAt" = NULL, "user_MachipId" = :targetMachipId, "updatedAt" = :now 
       WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id, targetMachipId, now: nowStr }, type: QueryTypes.UPDATE },
    );

    // Refresh leave balances for current year
    const currentYear = now.getFullYear();
    const existingLb = await sequelize.query(
      `SELECT "lb_Id" FROM "Leave_Balance" WHERE "user_Id" = :userId AND "year" = :year LIMIT 1`,
      { replacements: { userId: user_Id, year: currentYear }, type: QueryTypes.SELECT }
    );

    if (existingLb.length > 0) {
      await sequelize.query(
        `UPDATE "Leave_Balance" SET
           "VL_balance" = 7, "SL_balance" = 7, "SoloParent_balance" = 7,
           "VL_used" = 0, "SL_used" = 0, "SoloParent_used" = 0,
           "updatedAt" = :now
         WHERE "lb_Id" = :lbId`,
        { replacements: { lbId: existingLb[0].lb_Id, now: nowStr }, type: QueryTypes.UPDATE }
      );
    } else {
      await sequelize.query(
        `INSERT INTO "Leave_Balance" ("user_Id", "year", "VL_balance", "SL_balance", "SoloParent_balance", "VL_used", "SL_used", "SoloParent_used", "createdAt", "updatedAt")
         VALUES (:userId, :year, 7, 7, 7, 0, 0, 0, :now, :now)`,
        { replacements: { userId: user_Id, year: currentYear, now: nowStr }, type: QueryTypes.INSERT }
      );
    }

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
    console.error("[RESTORE USER ERROR]:", error);
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
      `SELECT * FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    const targetUser = user[0];

    // 2. Data Retention Policy Check from SystemSettings
    const settingsResult = await sequelize.query(
      `SELECT "archivedRetentionYears" FROM "SystemSettings" LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    const retentionYears = settingsResult.length > 0 && settingsResult[0].archivedRetentionYears !== null 
      ? parseInt(settingsResult[0].archivedRetentionYears) 
      : 5; // Default 5 years

    if (retentionYears === 0) {
      return res.status(400).json({ 
        error: "Cannot permanently delete: Data retention policy is set to Indefinite. Records must be preserved." 
      });
    }

    if (targetUser.deletedAt) {
      const now = await getSystemTime();
      const deletedDate = new Date(targetUser.deletedAt);
      const retentionEndDate = new Date(deletedDate);
      retentionEndDate.setFullYear(retentionEndDate.getFullYear() + retentionYears);

      if (now < retentionEndDate) {
        const yearsRemaining = ((retentionEndDate - now) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
        return res.status(400).json({ 
          error: `Cannot permanently delete: Data retention policy requires keeping employee records for at least ${retentionYears} years (${yearsRemaining} years remaining).` 
        });
      }
    }

    // 3. Conditional Permanent Delete: Zero linked records mandate
    // Check Payroll, user_logging, emp_Request, employee_Logging_report
    const [payrollCount] = await sequelize.query(
      `SELECT COUNT(*) as count FROM "Payroll" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    const [loggingCount] = await sequelize.query(
      `SELECT COUNT(*) as count FROM "user_logging" WHERE "user_id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    const [requestCount] = await sequelize.query(
      `SELECT COUNT(*) as count FROM "emp_Request" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    const [reportCount] = await sequelize.query(
      `SELECT COUNT(*) as count FROM "employee_Logging_report" WHERE "user_id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );

    const hasLinkedRecords = 
      parseInt(payrollCount?.count || 0) > 0 ||
      parseInt(loggingCount?.count || 0) > 0 ||
      parseInt(requestCount?.count || 0) > 0 ||
      parseInt(reportCount?.count || 0) > 0;

    if (hasLinkedRecords) {
      return res.status(400).json({ 
        error: "Cannot permanently delete: Employee has linked historical records (Payroll, Attendance Logs, or Requests). Under CTPAT/DOLE audit compliance, these records cannot be purged." 
      });
    }

    // 4. Perform hard delete if zero dependencies and retention passed
    const transaction = await sequelize.transaction();
    try {
      await sequelize.query(
        `DELETE FROM "User_Hardware" WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id }, type: QueryTypes.DELETE, transaction }
      );
      await sequelize.query(
        `DELETE FROM "User_Banking" WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id }, type: QueryTypes.DELETE, transaction }
      );
      await sequelize.query(
        `DELETE FROM "User_Deduction_Profile" WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id }, type: QueryTypes.DELETE, transaction }
      );
      await sequelize.query(
        `DELETE FROM "User" WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id }, type: QueryTypes.DELETE, transaction }
      );
      await transaction.commit();
    } catch (deleteErr) {
      await transaction.rollback();
      throw deleteErr;
    }

    await logAudit(req, currentAdminId || 1, "User Management", "PERMANENT_DELETE_USER", "User", user_Id, targetUser, null);

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
  const operatorRoleId = operator ? parseInt(operator.user_RoleId) : null;
  const isAdmin = operatorRoleId === 1;
  const isAccountant = operatorRoleId === 4;
  const isSupervisor = operatorRoleId === 2;
  const isMaster = isAdmin || isAccountant;
  const isStaff = isMaster || isSupervisor;

  // ── 1. AUTHORIZATION CHECK ──
  // If not staff (Admin, Accountant, Supervisor), you can ONLY update your own ID
  if (!isStaff && parseInt(operator?.user_Id) !== parseInt(user_Id)) {
    return res.status(403).json({ error: "Access denied. You can only update your own profile." });
  }

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
         WHERE (h."user_FingerprintId" = :user_FingerprintId OR h."user_FingerprintId2" = :user_FingerprintId) AND u."deletedAt" IS NULL AND u."user_Id" != :targetId`,
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

      // Role assignment security rule:
      // - Admin Manager (isAdmin) can assign any role (1, 2, 3, 4) or alter an Admin Manager.
      // - Admin Accountant (isAccountant) can assign Supervisor (2), Employee (3), Admin Accountant (4),
      //   but CANNOT assign Admin Manager (1), and CANNOT alter an existing Admin Manager's role.
      let assignedRoleId = oldUser.user_RoleId;
      if (isAdmin) {
        assignedRoleId = parseInt(user_RoleId) || oldUser.user_RoleId || 3;
      } else if (isAccountant) {
        if (parseInt(oldUser.user_RoleId) !== 1) {
          const requestedRole = parseInt(user_RoleId);
          if (requestedRole !== 1 && [2, 3, 4].includes(requestedRole)) {
            assignedRoleId = requestedRole;
          }
        }
      }

      // Verify Admin Password if elevating role to Admin Manager (1), Supervisor (2), or Admin Accountant (4)
      if (assignedRoleId !== oldUser.user_RoleId && [1, 2, 4].includes(assignedRoleId)) {
        const confirmPwd = adminConfirmPassword || req.body.adminPassword;
        if (!confirmPwd) {
          await transaction.rollback();
          return res.status(400).json({ error: "Admin confirmation password is required to assign elevated roles." });
        }
        const currentAdminId = operator ? operator.user_Id : (req.headers["x-admin-id"] || 1);
        const [adminRecord] = await sequelize.query(
          `SELECT "user_Password" FROM "User" WHERE "user_Id" = :adminId`,
          { replacements: { adminId: currentAdminId }, type: QueryTypes.SELECT }
        );
        if (!adminRecord || !(await bcrypt.compare(confirmPwd, adminRecord.user_Password))) {
          await transaction.rollback();
          return res.status(401).json({ error: "Invalid admin confirmation password." });
        }
      }

      const settings = await SystemSettings.findOne();
      let resolvedShiftId = isMaster ? (parseInt(req.body.user_ShiftId) || oldUser.user_ShiftId || 1) : oldUser.user_ShiftId;
      if (!settings?.enableNightShift && resolvedShiftId === 2) {
        resolvedShiftId = 1;
      }

      // Build replacements object with explicit types
      const replacements = {
        targetId: parseInt(user_Id),
        firstName: req.body.user_FirstName !== undefined ? (req.body.user_FirstName || null) : oldUser.user_FirstName,
        lastName: req.body.user_LastName !== undefined ? (req.body.user_LastName || null) : oldUser.user_LastName,
        middleName: req.body.user_MiddleName !== undefined ? (req.body.user_MiddleName || null) : oldUser.user_MiddleName,
        machipId: isMaster ? (user_MachipId !== undefined ? (user_MachipId || null) : oldUser.user_MachipId) : oldUser.user_MachipId,
        fingerprintId: isMaster ? (user_FingerprintId !== undefined ? (user_FingerprintId || null) : oldUser.user_FingerprintId) : oldUser.user_FingerprintId,
        roleId: assignedRoleId,
        statusId: isMaster ? (parseInt(user_EmploymentStatusId) || oldUser.user_EmploymentStatusId || 1) : oldUser.user_EmploymentStatusId,
        email: req.body.user_Email !== undefined ? (req.body.user_Email || null) : oldUser.user_Email,
        phone: req.body.user_Phone !== undefined ? (req.body.user_Phone || null) : oldUser.user_Phone,
        address: req.body.user_Address !== undefined ? (req.body.user_Address || null) : oldUser.user_Address,
        dob: req.body.user_DOB !== undefined ? (req.body.user_DOB || null) : oldUser.user_DOB,
        gender: req.body.user_Gender !== undefined ? (req.body.user_Gender || null) : oldUser.user_Gender,
        shiftId: resolvedShiftId,
        accountNumber: account_Number !== undefined ? (encrypt(account_Number) || null) : oldUser.account_Number,
        bankCompany: req.body.bank_Company !== undefined ? (req.body.bank_Company || null) : oldUser.bank_Company,
        bankAccountName: req.body.bank_AccountName !== undefined ? (req.body.bank_AccountName || null) : oldUser.bank_AccountName,
        department: isMaster ? (department !== undefined ? (department || null) : oldUser.department) : oldUser.department,
        position: isMaster ? (position !== undefined ? (position || null) : oldUser.position) : oldUser.position,
        position_id: isMaster ? (position_id !== undefined ? (position_id || null) : oldUser.position_id) : oldUser.position_id,
        hireDate: isAdmin 
          ? (req.body.hireDate !== undefined ? (req.body.hireDate || null) : oldUser.hireDate) 
          : oldUser.hireDate,
        taxStatus: isMaster 
          ? (req.body.taxStatus !== undefined ? (req.body.taxStatus || "S") : (oldUser.taxStatus || "S")) 
          : oldUser.taxStatus,
        civil_status: req.body.civil_status !== undefined ? (req.body.civil_status || "Single") : (oldUser.civil_status || "Single"),
        is_solo_parent: req.body.is_solo_parent !== undefined ? (req.body.is_solo_parent === "true" || req.body.is_solo_parent === true) : (oldUser.is_solo_parent || false),
        dailyRate: isMaster ? parsedDailyRate : (oldUser.dailyRate || 0),
        sss: isMaster ? finalSSS : (oldUser.sss_Share || 0),
        sss_is_manual: isMaster ? (req.body.sss_is_manual === true || req.body.sss_is_manual === "true") : (oldUser.sss_is_manual || false),
        ph: isMaster ? finalPH : (oldUser.philhealth_Share || 0),
        ph_is_manual: isMaster ? (req.body.ph_is_manual === true || req.body.ph_is_manual === "true") : (oldUser.ph_is_manual || false),
        hd: isMaster ? finalHD : (oldUser.hdmf_Share || 0),
        hdmf_is_manual: isMaster ? (req.body.hdmf_is_manual === true || req.body.hdmf_is_manual === "true") : (oldUser.hdmf_is_manual || false),
        tax: isMaster ? (parseFloat(Tax_Ded) || 0) : (oldUser.tax_Share || 0),
        hc: isMaster ? (parseFloat(healthCard_Amnt) || 0) : (oldUser.healthCard_Amnt || 0),
        sl: isMaster ? (parseFloat(SSS_Loan) || 0) : (oldUser.SSS_Loan || 0),
        hl: isMaster ? (parseFloat(HDMF_Loan) || 0) : (oldUser.HDMF_Loan || 0),
        cl: isMaster ? (parseFloat(calamityLoan_Amnt) || 0) : (oldUser.calamityLoan_Amnt || 0),
        el: isMaster ? (parseFloat(eastwest_Loan) || 0) : (oldUser.eastwest_Loan || 0),
        gd: isMaster ? (parseFloat(globe_Deduction) || 0) : (oldUser.globe_Deduction || 0),
        ms: isMaster ? (parseFloat(multiPurposeSavings) || 0) : (oldUser.multiPurposeSavings || 0),
        aa: isMaster ? (parseFloat(advances_Amnt) || 0) : (oldUser.advances_Amnt || 0),
        updatedAt: nowStr
      };

      // Guardrail: is_time_exempt update validation
      let isTimeExemptVal = oldUser.is_time_exempt || false;
      if (req.body.is_time_exempt !== undefined) {
        if (!isAdmin) {
          return res.status(403).json({ error: "Access denied: Only Admin Manager can grant attendance exemptions." });
        }
        isTimeExemptVal = req.body.is_time_exempt === true || req.body.is_time_exempt === "true";
      }
      replacements.is_time_exempt = isTimeExemptVal;

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
          "is_time_exempt" = :is_time_exempt,
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
        const { validatePassword } = require("../utils/passwordValidator");
        const pwdValidation = validatePassword(user_Password);
        if (!pwdValidation.isValid) {
          await transaction.rollback();
          return res.status(400).json({ error: pwdValidation.message });
        }
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

      // 5. If employee is updated to Solo Parent, credit 7 days of annual Solo Parent leave if unused/uninitialized
      if (replacements.is_solo_parent) {
        const currentYear = now.getFullYear();
        await sequelize.query(
          `INSERT INTO "Leave_Balance" 
           ("user_Id", "year", "VL_balance", "SL_balance", "SoloParent_balance", "VL_used", "SL_used", "SoloParent_used", "createdAt", "updatedAt")
           VALUES (:targetId, :currentYear, 7, 7, 7, 0, 0, 0, :updatedAt, :updatedAt)
           ON CONFLICT ("user_Id", "year") DO UPDATE SET
             "SoloParent_balance" = CASE 
               WHEN "Leave_Balance"."SoloParent_balance" = 0 AND "Leave_Balance"."SoloParent_used" = 0 THEN 7 
               ELSE "Leave_Balance"."SoloParent_balance" 
             END,
             "updatedAt" = EXCLUDED."updatedAt"`,
          { replacements: { targetId: user_Id, currentYear, updatedAt: nowStr }, type: QueryTypes.INSERT, transaction }
        );
      }

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

    // SECURITY FIX: Never leak password hash or reset tokens in API responses or audit logs
    delete updatedUser.user_Password;
    delete updatedUser.resetPasswordToken;
    delete updatedUser.resetPasswordExpires;

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
  const authController = require("./auth.controller");
  return authController.forgotPassword(req, res);
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
         h."user_MachipId", h."user_FingerprintId", h."user_FingerprintId2",
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

    let activeLoans = [];
    try {
      activeLoans = await sequelize.query(
        `SELECT "id", "userId", "deductionType", "notes", "totalAmount", "remainingBalance", "deductionPerCutoff", "status"
         FROM "Loan_Deductions"
         WHERE "status" ILIKE 'active'`,
        { type: QueryTypes.SELECT }
      );
    } catch (loanErr) {
      console.warn("[MASTERLIST LOANS FETCH WARN]:", loanErr.message);
    }

    const loansByEmp = {};
    for (const loan of activeLoans) {
      const uid = loan.userId;
      if (!loansByEmp[uid]) loansByEmp[uid] = [];
      loansByEmp[uid].push(loan);
    }

    const decryptedEmployees = employees.map(emp => {
      try {
        if (emp.account_Number) {
          emp.account_Number = decrypt(emp.account_Number);
        }
      } catch (decErr) {
        console.warn(`[MASTERLIST] Decryption failed for user ${emp.user_Id}:`, decErr.message);
      }

      const empActiveLoans = loansByEmp[emp.user_Id] || [];
      emp.activeLoansList = empActiveLoans;

      let activeSSS = 0;
      let activeHDMF = 0;
      let activeCalamity = 0;
      let activeEastWest = 0;
      let activeAdvances = 0;
      let activeMultiPurpose = 0;

      for (const al of empActiveLoans) {
        const perCutoff = parseFloat(al.deductionPerCutoff || 0);
        const type = (al.deductionType || "").toLowerCase();
        if (type === "sss_loan" || type === "sss_conso") {
          activeSSS += perCutoff;
        } else if (type === "hdmf_loan") {
          activeHDMF += perCutoff;
        } else if (type === "calamity" || type === "sss_calamity" || type === "hdmf_calamity" || type === "sss_emergency") {
          activeCalamity += perCutoff;
        } else if (type === "eastwest") {
          activeEastWest += perCutoff;
        } else if (type === "cash_advance") {
          activeAdvances += perCutoff;
        } else if (type === "multipurpose") {
          activeMultiPurpose += perCutoff;
        }
      }

      if (activeSSS > 0) emp.SSS_Loan = activeSSS;
      if (activeHDMF > 0) emp.HDMF_Loan = activeHDMF;
      if (activeCalamity > 0) emp.calamityLoan_Amnt = activeCalamity;
      if (activeEastWest > 0) emp.eastwest_Loan = activeEastWest;
      if (activeAdvances > 0) emp.advances_Amnt = activeAdvances;
      if (activeMultiPurpose > 0) emp.multiPurposeSavings = activeMultiPurpose;

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
         d."advances_Amnt", d."globe_Deduction", d."eastwest_Loan", d."multiPurposeSavings"
       FROM "User" u
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       WHERE u."user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    const updated = updatedResult[0];
    try {
      const activeLoans = await sequelize.query(
        `SELECT "id", "userId", "deductionType", "notes", "totalAmount", "remainingBalance", "deductionPerCutoff", "status"
         FROM "Loan_Deductions"
         WHERE "userId" = :user_Id AND "status" ILIKE 'active'`,
        { replacements: { user_Id }, type: QueryTypes.SELECT }
      );
      updated.activeLoansList = activeLoans;
      let activeSSS = 0, activeHDMF = 0, activeCalamity = 0, activeEastWest = 0, activeAdvances = 0, activeMultiPurpose = 0;
      for (const al of activeLoans) {
        const perCutoff = parseFloat(al.deductionPerCutoff || 0);
        const type = (al.deductionType || "").toLowerCase();
        if (type === "sss_loan" || type === "sss_conso") activeSSS += perCutoff;
        else if (type === "hdmf_loan") activeHDMF += perCutoff;
        else if (type === "calamity" || type === "sss_calamity" || type === "hdmf_calamity" || type === "sss_emergency") activeCalamity += perCutoff;
        else if (type === "eastwest") activeEastWest += perCutoff;
        else if (type === "cash_advance") activeAdvances += perCutoff;
        else if (type === "multipurpose") activeMultiPurpose += perCutoff;
      }
      if (activeSSS > 0) updated.SSS_Loan = activeSSS;
      if (activeHDMF > 0) updated.HDMF_Loan = activeHDMF;
      if (activeCalamity > 0) updated.calamityLoan_Amnt = activeCalamity;
      if (activeEastWest > 0) updated.eastwest_Loan = activeEastWest;
      if (activeAdvances > 0) updated.advances_Amnt = activeAdvances;
      if (activeMultiPurpose > 0) updated.multiPurposeSavings = activeMultiPurpose;
    } catch (loanErr) {
      console.warn("[UPDATE DAILY RATE LOANS WARN]:", loanErr.message);
    }
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
      `SELECT "user_Id" FROM "User_Hardware" WHERE ("user_FingerprintId" = :slot OR "user_FingerprintId2" = :slot) LIMIT 1`,
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

    // Helper to parse CSV lines safely supporting quotes and commas
    const parseCsvLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let idx = 0; idx < line.length; idx++) {
        const char = line[idx];
        if (char === '"') {
          if (inQuotes && line[idx + 1] === '"') {
            current += '"';
            idx++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCsvLine(lines[0]);
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

    // Role and Status Maps (case-insensitive)
    const roleMap = {
      "admin manager": 1,
      "supervisor": 2,
      "employee": 3,
      "admin accountant": 4,
      "admin": 1
    };
    const statusMap = {
      "regular": 1,
      "probationary": 2,
      "active": 1,
      "resigned": 3,
      "terminated": 4,
      "separated": 5,
      "retired": 6
    };

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
    const currentYear = now.getFullYear();

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < headers.length) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: Column count mismatch (expected ${headers.length}, got ${cols.length})`);
        continue;
      }

      const userData = {};
      headers.forEach((h, idx) => {
        userData[h] = cols[idx];
      });

      try {
        // Validation
        if (!userData.user_FirstName || !userData.user_LastName || !userData.user_Email || !userData.user_Password) {
          throw new Error("Missing required data in row " + (i + 1));
        }

        const { validatePassword } = require("../utils/passwordValidator");
        const pwdVal = validatePassword(userData.user_Password);
        if (!pwdVal.isValid) {
          throw new Error(`Row ${i + 1} password invalid: ${pwdVal.message}`);
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

        const roleKey = (userData.user_Role || "").toLowerCase().trim();
        const statusKey = (userData.user_EmploymentStatus || "").toLowerCase().trim();
        const roleId = roleMap[roleKey] || 3;
        const statusId = statusMap[statusKey] || 1;

        // Normalize Tax Status (DB is VARCHAR(5)): map "Single" -> "S", "Married" -> "M"
        let normalizedTax = (userData.taxStatus || "S").trim().toUpperCase();
        if (normalizedTax.startsWith("M")) normalizedTax = "M";
        else if (normalizedTax.startsWith("S")) normalizedTax = "S";
        else normalizedTax = normalizedTax.substring(0, 5);

        // Normalize solo parent boolean
        const soloParentStr = String(userData.is_solo_parent || "").toLowerCase().trim();
        const isSoloParentBool = soloParentStr === "true" || soloParentStr === "1" || soloParentStr === "yes";

        // Normalize hire date format (YYYY-MM-DD)
        let normalizedHireDate = userData.hireDate ? userData.hireDate.trim() : null;
        if (normalizedHireDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedHireDate)) {
          const parsedDate = new Date(normalizedHireDate);
          if (!isNaN(parsedDate.getTime())) {
            normalizedHireDate = parsedDate.toISOString().split('T')[0];
          } else {
            normalizedHireDate = null;
          }
        }

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
                hireDate: normalizedHireDate,
                taxStatus: normalizedTax,
                user_Gender: userData.user_Gender || null,
                civil_status: userData.civil_status || "Single",
                is_solo_parent: isSoloParentBool,
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

          // 5. Initialize Leave_Balance for the current year
          const soloParentCredit = isSoloParentBool ? 7 : 0;
          await sequelize.query(
            `INSERT INTO "Leave_Balance" 
             ("user_Id", "year", "VL_balance", "SL_balance", "SoloParent_balance", "VL_used", "SL_used", "SoloParent_used", "createdAt", "updatedAt")
             VALUES (:user_Id, :currentYear, 7, 7, :soloParentCredit, 0, 0, 0, :now, :now)
             ON CONFLICT ("user_Id", "year") DO NOTHING`,
            {
              replacements: { user_Id: nextId, currentYear, soloParentCredit, now: nowStr },
              type: QueryTypes.INSERT,
              transaction: trans
            }
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

    // Audit log batch upload action
    await logAudit(
      req,
      req.user?.user_Id || 1,
      "User Management",
      "BATCH_REGISTER_USERS",
      "User",
      null,
      null,
      { success: results.success, failed: results.failed, total: lines.length - 1, errors: results.errors.slice(0, 5) }
    );

    // If completely failed, return 400 Bad Request
    if (results.success === 0 && results.failed > 0) {
      return res.status(400).json({
        error: `Batch upload failed: all ${results.failed} records failed validation.`,
        message: `Processed ${lines.length - 1} rows. 0 succeeded, ${results.failed} failed.`,
        results
      });
    }

    // Return 207 Multi-Status if partial, 200 OK if completely successful
    const statusCode = results.failed > 0 ? 207 : 200;
    res.status(statusCode).json({
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
        WHERE "user_MachipId" IS NOT NULL AND "user_MachipId" != '' AND "user_MachipId" NOT LIKE 'MACHIP-%'
      )`;
    } else if (type === 'fingerprint') {
      sql = `
        SELECT u."user_Id", u."user_FirstName", u."user_LastName",
               uh."user_FingerprintId", uh."user_FingerprintId2",
               (uh."user_FingerprintId" IS NOT NULL AND TRIM(COALESCE(uh."user_FingerprintTemplate", '')) != '') AS "hasSlot1",
               (uh."user_FingerprintId2" IS NOT NULL AND TRIM(COALESCE(uh."user_FingerprintTemplate2", '')) != '') AS "hasSlot2"
        FROM "User" u
        LEFT JOIN "User_Hardware" uh ON u."user_Id" = uh."user_Id"
        WHERE u."deletedAt" IS NULL
        AND u."user_Id" != 999
        AND (
          uh."user_FingerprintId" IS NULL 
          OR TRIM(COALESCE(uh."user_FingerprintTemplate", '')) = ''
          OR uh."user_FingerprintId2" IS NULL 
          OR TRIM(COALESCE(uh."user_FingerprintTemplate2", '')) = ''
        )
      `;
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
