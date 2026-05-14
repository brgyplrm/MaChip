const { sequelize, SystemSettings, Holiday, PayrollPeriod, System_State } = require("../config/sequelize.js");
const { getSystemTime } = require("../utils/systemTime.js");
const { QueryTypes } = require("sequelize");
const { syncHolidaysService } = require('../utils/holidaySyncService');
const { logAudit } = require("../utils/logger");
const fs = require('fs');
const path = require('path');

exports.browseDirectories = async (req, res) => {
  const { currentPath } = req.query;
  // Default to root or a sensible starting point if currentPath is empty
  let targetPath = currentPath || (process.platform === 'win32' ? 'C:\\' : '/');

  try {
    if (!fs.existsSync(targetPath)) {
      // Fallback if the path is invalid
      targetPath = (process.platform === 'win32' ? 'C:\\' : '/');
    }

    const files = fs.readdirSync(targetPath, { withFileTypes: true });
    const directories = files
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort();

    const parentPath = path.dirname(targetPath);

    res.status(200).json({
      currentPath: path.resolve(targetPath),
      parentPath: parentPath === targetPath ? null : parentPath,
      directories,
      separator: path.sep
    });
  } catch (error) {
    res.status(500).json({ error: "Access Denied: " + error.message });
  }
};

exports.createDirectory = async (req, res) => {
  const { parentPath, folderName } = req.body;
  if (!parentPath || !folderName) return res.status(400).json({ error: "Path and Name required" });

  try {
    const newPath = path.join(parentPath, folderName);
    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath, { recursive: true });
      res.status(201).json({ success: true, path: newPath });
    } else {
      res.status(400).json({ error: "Folder already exists" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.syncHolidays = async (req, res) => {
    try {
        const result = await syncHolidaysService();
        
        if (!result.success && result.count === 0) {
            return res.status(500).json({ message: "No data synced from Official Gazette." });
        }

        res.status(200).json({ message: "Calendar synced with Official Gazette successfully.", count: result.count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.findAll({
      order: [['date', 'ASC']]
    });
    res.status(200).json(holidays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createHoliday = async (req, res) => {
  try {
    const { name, date, type } = req.body;
    if (!name || !date || !type) {
      return res.status(400).json({ error: "Name, date, and type are required." });
    }
    const holiday = await Holiday.create({ name, date, type });

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "System Settings", "CREATE_HOLIDAY", "Holiday", holiday.holidayId, null, holiday.toJSON());

    res.status(201).json(holiday);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateHoliday = async (req, res) => {
  try {
    const { holidayId } = req.params;
    const { name, date, type } = req.body;

    const holiday = await Holiday.findByPk(holidayId);
    if (!holiday) {
      return res.status(404).json({ error: "Holiday not found." });
    }

    const oldData = holiday.toJSON();
    await holiday.update({ name, date, type });
    const newData = holiday.toJSON();

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "System Settings", "UPDATE_HOLIDAY", "Holiday", holiday.holidayId, oldData, newData);

    res.status(200).json(holiday);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteHoliday = async (req, res) => {
  try {
    const { holidayId } = req.params;
    console.log(`[DEBUG] Attempting to delete holiday with ID: ${holidayId}`);
    
    if (!holidayId || holidayId === "undefined") {
      return res.status(400).json({ error: "Invalid Holiday ID provided." });
    }

    const holiday = await Holiday.findOne({ where: { holidayId: parseInt(holidayId) } });

    const deleted = await Holiday.destroy({ where: { holidayId: parseInt(holidayId) } });
    console.log(`[DEBUG] Holiday.destroy result: ${deleted}`);
    if (deleted) {
      const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
      await logAudit(req, currentAdminId, "System Settings", "DELETE_HOLIDAY", "Holiday", parseInt(holidayId), holiday ? holiday.toJSON() : null, null);
      res.status(200).json({ message: "Holiday deleted successfully." });
    } else {
      res.status(404).json({ error: "Holiday not found." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSystemSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.findOne();
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSystemSettings = async (req, res) => {
  const { 
    mockTimeEnabled, 
    mockTimeValue, 
    maxicareTotalGross, 
    maxicareMonthsToPay, 
    maxicareCycleStartDate,
    maxicareDates,
    vlRate,
    slRate,
    storageRootPath
  } = req.body;

  // Debug log for Maxicare configuration tracking
  console.log("[DEBUG] UPDATE_SYSTEM_SETTINGS Received Payload:", JSON.stringify(req.body, null, 2));

  try {
    const settings = await SystemSettings.findOne();
    let oldSettings = null;
    let newSettings;

    const updateData = { 
      mockTimeEnabled, 
      mockTimeValue, 
      maxicareTotalGross, 
      maxicareMonthsToPay, 
      maxicareCycleStartDate,
      maxicareDates,
      vlRate,
      slRate,
      storageRootPath
    };

    if (!settings) {
      newSettings = await SystemSettings.create(updateData);
    } else {
      oldSettings = settings.toJSON();
      newSettings = await settings.update(updateData);
    }

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "System Settings", "UPDATE_SETTINGS", "SystemSettings", newSettings.settingId, oldSettings, newSettings.toJSON());

    res.status(200).json({ message: "System settings updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSystemTime = async (req, res) => {
  try {
    const settings = await SystemSettings.findOne();
    const now = await getSystemTime();
    res.status(200).json({ 
      systemTime: now,
      unixTime: Math.floor(now.getTime() / 1000),
      isMock: settings ? settings.mockTimeEnabled : false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createPayrollPeriod = async (req, res) => {
    try {
        const { startDate, endDate, label } = req.body;
        console.log("[DEBUG] Creating payroll period:", { startDate, endDate, label });
        const period = await PayrollPeriod.create({ startDate, endDate, label });

        const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
        await logAudit(req, currentAdminId, "System Settings", "CREATE_PAYROLL_PERIOD", "PayrollPeriod", period.periodId, null, period.toJSON());

        res.status(201).json(period);
    } catch (error) {
        console.error("[ERROR] createPayrollPeriod:", error);
        res.status(500).json({ error: error.message });
    }
};

const ensureCurrentPeriodExists = async () => {
    try {
        const now = await getSystemTime();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();

        const periodsToEnsure = [];

        // Always ensure the 1st half exists (1-15)
        const firstHalfStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const firstHalfEnd = `${year}-${String(month + 1).padStart(2, '0')}-15`;
        const firstHalfLabel = `${now.toLocaleString('default', { month: 'long' })} 1-15, ${year}`;
        periodsToEnsure.push({ startDate: firstHalfStart, endDate: firstHalfEnd, label: firstHalfLabel });

        // If today is past the 15th, also ensure the 2nd half exists (16-EOF)
        if (day > 15) {
            const secondHalfStart = `${year}-${String(month + 1).padStart(2, '0')}-16`;
            const lastDay = new Date(year, month + 1, 0).getDate();
            const secondHalfEnd = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
            const secondHalfLabel = `${now.toLocaleString('default', { month: 'long' })} 16-${lastDay}, ${year}`;
            periodsToEnsure.push({ startDate: secondHalfStart, endDate: secondHalfEnd, label: secondHalfLabel });
        }

        for (const p of periodsToEnsure) {
            const existing = await PayrollPeriod.findOne({
                where: { startDate: p.startDate, endDate: p.endDate }
            });

            if (!existing) {
                console.log(`[SYSTEM] Auto-creating missing payroll period: ${p.label}`);
                await PayrollPeriod.create({
                    startDate: p.startDate,
                    endDate: p.endDate,
                    label: p.label,
                    status: 'Draft'
                });
            }
        }
    } catch (error) {
        console.error("[ERROR] ensureCurrentPeriodExists:", error.message);
    }
};

exports.getPayrollPeriods = async (req, res) => {
    try {
        // Automatically check and create current period before returning list
        await ensureCurrentPeriodExists();

        // Check if user is staff/admin (matching roleCheck.js logic)
        const userRole = req.user.user_Role;
        const userRoleId = parseInt(req.user.user_RoleId);
        const isStaff = [1, 2, 4].includes(userRoleId) || 
                        ["Admin Manager", "Supervisor", "Admin Accountant", "Admin"].includes(userRole);

        const periods = await sequelize.query(
            `SELECT 
                pp."periodId",
                pp."startDate",
                pp."endDate",
                pp."label",
                pp."status"
                ${isStaff ? `,
                -- If Draft, show eligible employees. If not, show processed count.
                (CASE 
                    WHEN pp."status" = 'Draft' THEN (SELECT COUNT(*)::int FROM "User" WHERE "deletedAt" IS NULL AND "dailyRate" > 0)
                    ELSE (SELECT COUNT(*)::int FROM "Payroll" p2 WHERE p2."periodId" = pp."periodId")
                END) AS "employeeCount",
                -- If Draft, show potential total (Daily Rate * Work Days). If not, show actual total.
                (CASE 
                    WHEN pp."status" = 'Draft' THEN (
                        COALESCE((SELECT SUM("dailyRate") FROM "User" WHERE "deletedAt" IS NULL AND "dailyRate" > 0), 0) * 
                        (SELECT COUNT(*)::int FROM (
                            SELECT generate_series(pp."startDate"::date, pp."endDate"::date, '1 day'::interval) AS d
                        ) days WHERE extract(dow from d) <> 0)
                    )
                    ELSE COALESCE((SELECT SUM("netPay") FROM "Payroll" p3 WHERE p3."periodId" = pp."periodId"), 0)
                END) AS "totalAmount"
                ` : ''}
             FROM "PayrollPeriod" pp
             ORDER BY pp."startDate" DESC`,
            { type: QueryTypes.SELECT }
        );
        res.status(200).json(periods);
    } catch (error) {
        console.error("[ERROR] getPayrollPeriods:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await sequelize.query(
      `SELECT
         a.*,
         u."user_FirstName", u."user_LastName"
       FROM "Audit_Log" a
       LEFT JOIN "User" u ON u."user_Id" = a."user_Id"
       ORDER BY a."createdAt" DESC`,
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
      `SELECT
         t.*,
         u."user_FirstName" AS "emp_FirstName", u."user_LastName" AS "emp_LastName",
         a."user_FirstName" AS "admin_FirstName", a."user_LastName" AS "admin_LastName"
       FROM "Transaction_Log" t
       LEFT JOIN "User" u ON u."user_Id" = t."user_Id"
       LEFT JOIN "User" a ON a."user_Id" = t."initiated_By"
       ORDER BY t."createdAt" DESC`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.setRegistrationSession = async (req, res) => {
  const { userId, type } = req.body; // type: 'RFID' or 'FP'
  try {
    const [session, created] = await System_State.findOrCreate({
      where: { key: 'REGISTRATION_SESSION' },
      defaults: { value: JSON.stringify({ userId, type }) }
    });

    if (!session) {
       return res.status(500).json({ success: false, message: "Failed to create session" });
    }

    if (!created) {
      await session.update({ value: JSON.stringify({ userId, type }) });
    }

    res.status(200).json({ success: true, message: "Registration session started" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.clearRegistrationSession = async (req, res) => {
  try {
    await System_State.destroy({ where: { key: 'REGISTRATION_SESSION' } });
    res.status(200).json({ success: true, message: "Registration session cleared" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
