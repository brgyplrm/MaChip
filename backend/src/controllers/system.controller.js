const { sequelize, SystemSettings, Holiday, DueDate, PayrollPeriod, System_State } = require("../config/sequelize.js");
const { getSystemTime } = require("../utils/systemTime.js");
const { QueryTypes } = require("sequelize");
const { syncHolidaysService } = require('../utils/holidaySyncService');
const { logAudit, formatUserNumber } = require("../utils/logger");
const { verifyAuditLogChain } = require("../utils/encryption");
const fs = require('fs');
const path = require('path');

const FORBIDDEN_SYSTEM_PATHS = [
  "/etc", "/proc", "/sys", "/dev", "/boot", "/root", "/bin", "/sbin", "/lib", "/lib64", "/usr/bin", "/usr/sbin",
  "C:\\Windows", "C:\\Program Files", "C:\\ProgramData"
];

function isForbiddenSystemPath(p) {
  if (!p) return true;
  const resolved = path.resolve(p);
  return FORBIDDEN_SYSTEM_PATHS.some(forbidden => {
    const fResolved = path.resolve(forbidden);
    return resolved === fResolved || resolved.startsWith(fResolved + path.sep);
  });
}

exports.browseDirectories = async (req, res) => {
  const { currentPath } = req.query;
  // Default to project uploads or home directory rather than raw host root '/'
  const defaultBase = path.resolve(__dirname, "../../uploads");
  let targetPath = currentPath ? path.resolve(currentPath) : defaultBase;

  try {
    // Filesystem Traversal Guard: Block traversal into operating system sensitive trees
    if (isForbiddenSystemPath(targetPath)) {
      return res.status(403).json({ error: "Access Denied: Browsing sensitive operating system directories is prohibited." });
    }

    if (!fs.existsSync(targetPath)) {
      targetPath = defaultBase;
    }

    const files = fs.readdirSync(targetPath, { withFileTypes: true });
    const directories = files
      .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith("."))
      .map(dirent => dirent.name)
      .sort();

    const parentPath = path.dirname(targetPath);
    const isParentForbidden = isForbiddenSystemPath(parentPath);

    res.status(200).json({
      currentPath: path.resolve(targetPath),
      parentPath: (parentPath === targetPath || isParentForbidden) ? null : parentPath,
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

  // Path traversal guard on folder name
  if (folderName.includes("..") || folderName.includes("/") || folderName.includes("\\") || folderName.startsWith(".")) {
    return res.status(400).json({ error: "Invalid folder name: Path traversal sequences and hidden folders are prohibited." });
  }

  const resolvedParent = path.resolve(parentPath);
  if (isForbiddenSystemPath(resolvedParent)) {
    return res.status(403).json({ error: "Access Denied: Creating folders in sensitive system directories is prohibited." });
  }

  try {
    const newPath = path.join(resolvedParent, folderName);
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

exports.updateMandatedWage = async (req, res) => {
  const { mandatedMinimumWage, mandatedWageEffectiveDate } = req.body;
  if (mandatedMinimumWage !== undefined) {
    const parsedWage = parseFloat(mandatedMinimumWage);
    if (isNaN(parsedWage) || parsedWage < 0) {
      return res.status(400).json({ error: "mandatedMinimumWage must be a non-negative number." });
    }
  }
  try {
    const settings = await SystemSettings.findOne();
    if (!settings) {
      const newSettings = await SystemSettings.create({ mandatedMinimumWage, mandatedWageEffectiveDate });
      return res.status(200).json(newSettings);
    }
    const oldData = settings.toJSON();
    await settings.update({ mandatedMinimumWage, mandatedWageEffectiveDate });
    
    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "System Settings", "UPDATE_MANDATED_WAGE", "SystemSettings", settings.settingId, oldData, settings.toJSON());
    
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSystemSettings = async (req, res) => {
  try {
    // Validate numerical inputs
    if (req.body.mandatedMinimumWage !== undefined) {
      const wage = parseFloat(req.body.mandatedMinimumWage);
      if (isNaN(wage) || wage < 0) return res.status(400).json({ error: "mandatedMinimumWage must be a non-negative number." });
    }
    if (req.body.hardwareBufferWindow !== undefined && req.body.hardwareBufferWindow !== null) {
      const buf = parseInt(req.body.hardwareBufferWindow, 10);
      if (isNaN(buf) || buf < 0) return res.status(400).json({ error: "hardwareBufferWindow must be a non-negative integer." });
    }
    if (req.body.doorRelayHoldDurationSec !== undefined && req.body.doorRelayHoldDurationSec !== null) {
      const dur = parseInt(req.body.doorRelayHoldDurationSec, 10);
      if (isNaN(dur) || dur < 1 || dur > 15) return res.status(400).json({ error: "doorRelayHoldDurationSec must be an integer between 1 and 15 seconds." });
    }
    if (req.body.archivedRetentionYears !== undefined && req.body.archivedRetentionYears !== null) {
      const ret = parseInt(req.body.archivedRetentionYears, 10);
      if (isNaN(ret) || ret < 0) return res.status(400).json({ error: "archivedRetentionYears must be a non-negative integer." });
    }
    if (req.body.workHourThreshold !== undefined) {
      const wht = parseFloat(req.body.workHourThreshold);
      if (isNaN(wht) || wht < 0) return res.status(400).json({ error: "workHourThreshold must be a non-negative number." });
    }

    const multiplierFields = [
      'ordinaryDayRate', 'specialDayRate', 'restDayRate', 'regularHolidayRate',
      'nightDiffRate', 'overtimeRate', 'doubleRegularHolidayRate',
      'specialDayRestDayRate', 'doubleSpecialDayRate', 'doubleSpecialDayRestDayRate',
      'regularHolidayRestDayRate', 'doubleRegularHolidayRestDayRate'
    ];
    for (const field of multiplierFields) {
      if (req.body[field] !== undefined) {
        const val = parseFloat(req.body[field]);
        if (isNaN(val) || val < 0) {
          return res.status(400).json({ error: `${field} must be a non-negative number.` });
        }
      }
    }

    const settings = await SystemSettings.findOne();
    let oldSettings = settings ? settings.toJSON() : null;
    let newSettings;

    const updateData = {};

    // 1. Time Simulation
    let mockTimeChanged = false;
    if (req.body.useMockTime !== undefined || req.body.mockTimeEnabled !== undefined) {
      const enabled = req.body.useMockTime !== undefined ? Boolean(req.body.useMockTime) : Boolean(req.body.mockTimeEnabled);
      updateData.mockTimeEnabled = enabled;
      if (enabled && (!oldSettings || !oldSettings.mockTimeEnabled)) {
        mockTimeChanged = true;
      }
    }
    if (req.body.mockDate !== undefined && req.body.mockTime !== undefined) {
      updateData.mockTimeValue = (req.body.mockDate && req.body.mockTime) 
        ? new Date(`${req.body.mockDate}T${req.body.mockTime}`) 
        : null;
      mockTimeChanged = true;
    } else if (req.body.mockTimeValue !== undefined) {
      updateData.mockTimeValue = req.body.mockTimeValue ? new Date(req.body.mockTimeValue) : null;
      mockTimeChanged = true;
    }
    if (mockTimeChanged) {
      updateData.mockTimeSetAt = new Date();
    }

    // 2. Storage & System Infrastructure
    if (req.body.storageRootPath !== undefined) updateData.storageRootPath = req.body.storageRootPath;
    if (req.body.archivedRetentionYears !== undefined && req.body.archivedRetentionYears !== null) {
      updateData.archivedRetentionYears = parseInt(req.body.archivedRetentionYears, 10);
    }
    if (req.body.hardwareBufferWindow !== undefined && req.body.hardwareBufferWindow !== null) {
      updateData.hardwareBufferWindow = parseInt(req.body.hardwareBufferWindow, 10);
    }
    if (req.body.doorRelayHoldDurationSec !== undefined && req.body.doorRelayHoldDurationSec !== null) {
      updateData.doorRelayHoldDurationSec = parseInt(req.body.doorRelayHoldDurationSec, 10);
    }
    if (req.body.vlRate !== undefined) updateData.vlRate = parseFloat(req.body.vlRate);
    if (req.body.slRate !== undefined) updateData.slRate = parseFloat(req.body.slRate);

    // 3. Shifts & Attendance Thresholds
    if (req.body.enableNightShift !== undefined) {
      updateData.enableNightShift = Boolean(req.body.enableNightShift);
      if (!updateData.enableNightShift) {
        await sequelize.query('UPDATE "User" SET "user_ShiftId" = 1 WHERE "user_ShiftId" = 2');
      }
    }
    if (req.body.morningShiftStart !== undefined) updateData.morningShiftStart = req.body.morningShiftStart;
    if (req.body.morningShiftEnd !== undefined) updateData.morningShiftEnd = req.body.morningShiftEnd;
    if (req.body.eveningShiftStart !== undefined) updateData.eveningShiftStart = req.body.eveningShiftStart;
    if (req.body.eveningShiftEnd !== undefined) updateData.eveningShiftEnd = req.body.eveningShiftEnd;
    if (req.body.gracePeriod !== undefined) updateData.gracePeriod = req.body.gracePeriod;
    if (req.body.lunchStartThreshold !== undefined) updateData.lunchStartThreshold = req.body.lunchStartThreshold;
    if (req.body.lunchEndThreshold !== undefined) updateData.lunchEndThreshold = req.body.lunchEndThreshold;
    if (req.body.lunchDuration !== undefined) updateData.lunchDuration = parseInt(req.body.lunchDuration, 10);
    if (req.body.flexibleBreakThreshold !== undefined) updateData.flexibleBreakThreshold = parseInt(req.body.flexibleBreakThreshold, 10);
    if (req.body.workHourThreshold !== undefined) updateData.workHourThreshold = parseFloat(req.body.workHourThreshold);

    // 4. Labor Multipliers
    multiplierFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = parseFloat(req.body[field]);
      }
    });

    // 5. Mandated Wage & Grace Period
    if (req.body.mandatedMinimumWage !== undefined) updateData.mandatedMinimumWage = parseFloat(req.body.mandatedMinimumWage);
    if (req.body.mandatedWageEffectiveDate !== undefined) updateData.mandatedWageEffectiveDate = req.body.mandatedWageEffectiveDate;
    if (req.body.payrollGracePeriodDays !== undefined && req.body.payrollGracePeriodDays !== null) {
      updateData.payrollGracePeriodDays = parseInt(req.body.payrollGracePeriodDays, 10);
    }
    if (req.body.payrollCutoffBufferDays !== undefined && req.body.payrollCutoffBufferDays !== null) {
      updateData.payrollCutoffBufferDays = parseInt(req.body.payrollCutoffBufferDays, 10);
    }
    if (req.body.payrollProcessingDeadlineDays !== undefined && req.body.payrollProcessingDeadlineDays !== null) {
      updateData.payrollProcessingDeadlineDays = parseInt(req.body.payrollProcessingDeadlineDays, 10);
    }
    if (req.body.payrollAutoRelease !== undefined) {
      updateData.payrollAutoRelease = Boolean(req.body.payrollAutoRelease);
    }
    if (req.body.payrollRemindersEnabled !== undefined) {
      updateData.payrollRemindersEnabled = Boolean(req.body.payrollRemindersEnabled);
    }
    if (req.body.payrollWeekendRule !== undefined) {
      updateData.payrollWeekendRule = String(req.body.payrollWeekendRule);
    }
    if (req.body.taxEvaluationMode !== undefined) {
      const mode = String(req.body.taxEvaluationMode);
      if (['PROJECTED_MONTHLY', 'DIRECT_CUTOFF'].includes(mode)) {
        updateData.taxEvaluationMode = mode;
      }
    }

    // 6. Maxicare / HMO
    if (req.body.maxicareTotalGross !== undefined) updateData.maxicareTotalGross = parseFloat(req.body.maxicareTotalGross);
    if (req.body.maxicareMonthsToPay !== undefined) updateData.maxicareMonthsToPay = parseInt(req.body.maxicareMonthsToPay, 10);
    if (req.body.maxicareCycleStartDate !== undefined) updateData.maxicareCycleStartDate = req.body.maxicareCycleStartDate;
    if (req.body.maxicareDates !== undefined) {
      let sanitizedMaxicareDates = req.body.maxicareDates;
      if (sanitizedMaxicareDates && Array.isArray(sanitizedMaxicareDates.dates)) {
        sanitizedMaxicareDates = {
          ...sanitizedMaxicareDates,
          dates: sanitizedMaxicareDates.dates.filter(d => {
            if (!d || typeof d !== 'string') return false;
            const parts = d.split('-');
            return parts.length === 3 && parts[0].length === 4 && d.length === 10;
          }).sort()
        };
      } else if (Array.isArray(sanitizedMaxicareDates)) {
        sanitizedMaxicareDates = sanitizedMaxicareDates.filter(d => {
          if (!d || typeof d !== 'string') return false;
          const parts = d.split('-');
          return parts.length === 3 && parts[0].length === 4 && d.length === 10;
        }).sort();
      }
      updateData.maxicareDates = sanitizedMaxicareDates;
    }

    // 7. Payroll Rates (Deep Merge to prevent wiping statutoryConstants or otNightRates)
    if (req.body.payrollRates !== undefined || req.body.payroll !== undefined) {
      const existingRates = (settings && settings.payrollRates) ? settings.payrollRates : {};
      const newRates = req.body.payrollRates || {};
      const newStatutory = req.body.payroll || newRates.statutoryConstants || {};

      const mergedStatutory = {
        ...(existingRates.statutoryConstants || {}),
        ...(newRates.statutoryConstants || {}),
        ...newStatutory
      };

      updateData.payrollRates = {
        ...existingRates,
        ...newRates,
        statutoryConstants: mergedStatutory
      };
    }

    // If nothing to update, return current settings
    if (Object.keys(updateData).length === 0) {
      return res.status(200).json({ message: "No changes provided", data: settings });
    }

    if (!settings) {
      newSettings = await SystemSettings.create(updateData);
    } else {
      newSettings = await settings.update(updateData);
    }

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "System Settings", "UPDATE_SETTINGS", "SystemSettings", newSettings.settingId, oldSettings, newSettings.toJSON());

    res.status(200).json({ message: "System settings updated successfully", data: newSettings });
  } catch (error) {
    console.error("[ERROR] updateSystemSettings FAILED:", error);
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
        if (!startDate || !endDate) {
            return res.status(400).json({ error: "startDate and endDate are required." });
        }
        if (startDate > endDate) {
            return res.status(400).json({ error: "Invalid date range: startDate cannot be after endDate." });
        }

        const existing = await PayrollPeriod.findOne({
            where: { startDate, endDate }
        });
        if (existing) {
            return res.status(409).json({ error: "A payroll period with this date range already exists.", period: existing });
        }

        console.log("[DEBUG] Creating payroll period:", { startDate, endDate, label });
        const period = await PayrollPeriod.create({ 
            startDate, 
            endDate, 
            label: label || `${startDate} - ${endDate}`,
            status: 'Draft'
        });

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
        const userRole = req.user?.user_Role;
        const userRoleId = parseInt(req.user?.user_RoleId || 0);
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
                    WHEN pp."status" = 'Draft' THEN (SELECT COUNT(*)::int FROM "User" WHERE "deletedAt" IS NULL AND "dailyRate" > 0 AND "user_Id" != 999 AND ("hireDate" IS NULL OR "hireDate" <= pp."endDate"::date))
                    ELSE (SELECT COUNT(*)::int FROM "Payroll" p2 WHERE p2."periodId" = pp."periodId")
                END) AS "employeeCount",
                -- If Draft, show potential total (Daily Rate * Work Days). If not, show actual total.
                (CASE 
                    WHEN pp."status" = 'Draft' THEN (
                        COALESCE((SELECT SUM("dailyRate") FROM "User" WHERE "deletedAt" IS NULL AND "dailyRate" > 0 AND "user_Id" != 999 AND ("hireDate" IS NULL OR "hireDate" <= pp."endDate"::date)), 0) * 
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
    const pageParam = req.query.page;
    const limitParam = req.query.limit;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const action = req.query.action && req.query.action !== 'All Categories' ? String(req.query.action).trim() : '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true';

    // Legacy fallback: if no pagination, search, action, or export is requested, return flat array for backward compatibility
    const isLegacyCall = pageParam === undefined && limitParam === undefined && !search && !action && !startDate && !endDate && !isExport;

    if (isLegacyCall) {
      const logs = await sequelize.query(
        `SELECT
           a.*,
           u."user_FirstName", u."user_LastName", u."user_Email", u."user_RoleId"
         FROM "Audit_Log" a
         LEFT JOIN "User" u ON u."user_Id" = a."user_Id"
         ORDER BY a."createdAt" DESC`,
        { type: QueryTypes.SELECT }
      );
      const sanitized = logs.map(log => {
        const copy = { ...log };
        if (copy.old_Value && typeof copy.old_Value === 'object') {
          delete copy.old_Value.user_Password;
          delete copy.old_Value.resetPasswordToken;
          delete copy.old_Value.resetPasswordExpires;
        }
        if (copy.new_Value && typeof copy.new_Value === 'object') {
          delete copy.new_Value.user_Password;
          delete copy.new_Value.resetPasswordToken;
          delete copy.new_Value.resetPasswordExpires;
        }
        return copy;
      });
      return res.status(200).json(sanitized);
    }

    const whereConditions = [];
    const replacements = {};

    if (search) {
      whereConditions.push(`(
        u."user_FirstName" ILIKE :searchLike OR 
        u."user_LastName" ILIKE :searchLike OR 
        a."action" ILIKE :searchLike OR 
        a."target_Table" ILIKE :searchLike OR 
        a."ip_Address" ILIKE :searchLike OR 
        CAST(a."target_Id" AS TEXT) ILIKE :searchLike OR 
        CAST(a."user_Id" AS TEXT) ILIKE :searchLike OR
        a."module" ILIKE :searchLike
      )`);
      replacements.searchLike = `%${search}%`;
    }

    if (action) {
      whereConditions.push('(a."action" = :action OR a."action" ILIKE :actionLike)');
      replacements.action = action;
      replacements.actionLike = `%${action}%`;
    }

    if (startDate) {
      whereConditions.push('a."createdAt" >= :startDate');
      replacements.startDate = startDate;
    }

    if (endDate) {
      whereConditions.push('a."createdAt" <= :endDate');
      replacements.endDate = endDate;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Calculate database stats across matching records
    const [statsResult] = await sequelize.query(
      `SELECT 
         COUNT(*) AS "total",
         COUNT(CASE WHEN a."action" LIKE '%DELETE%' OR a."action" LIKE '%PERMANENT%' THEN 1 END) AS "securityAlerts",
         COUNT(CASE WHEN a."action" LIKE '%USER%' OR a."action" LIKE '%RATE%' THEN 1 END) AS "userUpdates",
         COUNT(DISTINCT a."user_Id") AS "activeAdmins"
       FROM "Audit_Log" a
       LEFT JOIN "User" u ON u."user_Id" = a."user_Id"
       ${whereClause}`,
      { replacements, type: QueryTypes.SELECT }
    );

    const total = parseInt(statsResult?.total || 0, 10);

    // Get distinct actions for dropdown
    const distinctActionRows = await sequelize.query(
      `SELECT DISTINCT a."action" FROM "Audit_Log" a ORDER BY a."action" ASC LIMIT 50`,
      { type: QueryTypes.SELECT }
    );
    const uniqueActions = ["All Categories", ...distinctActionRows.map(r => r.action).filter(Boolean)];

    if (isExport) {
      const exportLogs = await sequelize.query(
        `SELECT
           a.*,
           u."user_FirstName", u."user_LastName", u."user_Email", u."user_RoleId"
         FROM "Audit_Log" a
         LEFT JOIN "User" u ON u."user_Id" = a."user_Id"
         ${whereClause}
         ORDER BY a."createdAt" DESC
         LIMIT 5000`,
        { replacements, type: QueryTypes.SELECT }
      );
      const sanitizedExport = exportLogs.map(log => {
        const copy = { ...log };
        if (copy.old_Value && typeof copy.old_Value === 'object') {
          delete copy.old_Value.user_Password;
          delete copy.old_Value.resetPasswordToken;
          delete copy.old_Value.resetPasswordExpires;
        }
        if (copy.new_Value && typeof copy.new_Value === 'object') {
          delete copy.new_Value.user_Password;
          delete copy.new_Value.resetPasswordToken;
          delete copy.new_Value.resetPasswordExpires;
        }
        return copy;
      });
      return res.status(200).json(sanitizedExport);
    }

    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitParam, 10) || 10));
    const offset = (page - 1) * limit;

    replacements.limit = limit;
    replacements.offset = offset;

    const pageLogs = await sequelize.query(
      `SELECT
         a.*,
         u."user_FirstName", u."user_LastName", u."user_Email", u."user_RoleId"
       FROM "Audit_Log" a
       LEFT JOIN "User" u ON u."user_Id" = a."user_Id"
       ${whereClause}
       ORDER BY a."createdAt" DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    const sanitized = pageLogs.map(log => {
      const copy = { ...log };
      if (copy.old_Value && typeof copy.old_Value === 'object') {
        delete copy.old_Value.user_Password;
        delete copy.old_Value.resetPasswordToken;
        delete copy.old_Value.resetPasswordExpires;
      }
      if (copy.new_Value && typeof copy.new_Value === 'object') {
        delete copy.new_Value.user_Password;
        delete copy.new_Value.resetPasswordToken;
        delete copy.new_Value.resetPasswordExpires;
      }
      return copy;
    });

    res.status(200).json({
      data: sanitized,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      },
      stats: {
        totalActions: total,
        securityAlerts: parseInt(statsResult?.securityAlerts || 0, 10),
        userUpdates: parseInt(statsResult?.userUpdates || 0, 10),
        activeAdmins: parseInt(statsResult?.activeAdmins || 0, 10)
      },
      uniqueActions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAuditLogById = async (req, res) => {
  try {
    const auditId = parseInt(req.params.auditId, 10);
    if (isNaN(auditId)) return res.status(400).json({ error: "Invalid audit ID." });
    const logs = await sequelize.query(
      `SELECT a.*, u."user_FirstName", u."user_LastName", u."user_Email", u."user_RoleId"
       FROM "Audit_Log" a
       LEFT JOIN "User" u ON u."user_Id" = a."user_Id"
       WHERE a."auditId" = :auditId LIMIT 1`,
      { replacements: { auditId }, type: QueryTypes.SELECT }
    );
    if (logs.length === 0) return res.status(404).json({ error: "Audit log not found." });
    const copy = { ...logs[0] };
    if (copy.old_Value && typeof copy.old_Value === 'object') {
      delete copy.old_Value.user_Password;
      delete copy.old_Value.resetPasswordToken;
      delete copy.old_Value.resetPasswordExpires;
    }
    if (copy.new_Value && typeof copy.new_Value === 'object') {
      delete copy.new_Value.user_Password;
      delete copy.new_Value.resetPasswordToken;
      delete copy.new_Value.resetPasswordExpires;
    }
    res.status(200).json(copy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyAuditChain = async (req, res) => {
  try {
    const logs = await sequelize.query(
      `SELECT * FROM "Audit_Log" ORDER BY "auditId" ASC`,
      { type: QueryTypes.SELECT }
    );
    const result = verifyAuditLogChain(logs);
    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[ERROR] verifyAuditChain:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTransactionLogs = async (req, res) => {
  try {
    const pageParam = req.query.page;
    const limitParam = req.query.limit;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const action = req.query.action && req.query.action !== 'All Actions' ? String(req.query.action).trim() : '';
    const isExport = req.query.export === 'true';

    // Legacy fallback: return flat array when called with no pagination, search, action, or export
    const isLegacyCall = pageParam === undefined && limitParam === undefined && !search && !action && !isExport;

    if (isLegacyCall) {
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
      return res.status(200).json(logs);
    }

    const whereConditions = [];
    const replacements = {};

    if (search) {
      whereConditions.push(`(
        u."user_FirstName" ILIKE :searchLike OR 
        u."user_LastName" ILIKE :searchLike OR 
        a."user_FirstName" ILIKE :searchLike OR 
        a."user_LastName" ILIKE :searchLike OR 
        t."event_Type" ILIKE :searchLike OR 
        t."description" ILIKE :searchLike OR 
        t."ip_Address" ILIKE :searchLike OR 
        CAST(t."user_Id" AS TEXT) ILIKE :searchLike OR 
        CAST(t."initiated_By" AS TEXT) ILIKE :searchLike
      )`);
      replacements.searchLike = `%${search}%`;
    }

    if (action) {
      whereConditions.push('t."event_Type" = :action');
      replacements.action = action;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [statsResult] = await sequelize.query(
      `SELECT 
         COUNT(*) AS "total",
         COUNT(CASE WHEN t."event_Type" = 'PAYROLL_RELEASE' THEN 1 END) AS "payrollReleases",
         COUNT(CASE WHEN t."event_Type" = 'BATCH_PAYROLL_GEN' THEN 1 END) AS "batchRuns",
         COUNT(CASE WHEN t."event_Type" IN ('UNAUTHORIZED_SCAN', 'UNRECOGNIZED_SCAN', 'IRREGULAR_LOG', '2FA_FAILURE', 'SUSPICIOUS_SCAN', 'ATTENDANCE_LOG_SUSPICIOUS') THEN 1 END) AS "unauthorizedScans"
       FROM "Transaction_Log" t
       LEFT JOIN "User" u ON u."user_Id" = t."user_Id"
       LEFT JOIN "User" a ON a."user_Id" = t."initiated_By"
       ${whereClause}`,
      { replacements, type: QueryTypes.SELECT }
    );

    const total = parseInt(statsResult?.total || 0, 10);

    const distinctEvents = await sequelize.query(
      `SELECT DISTINCT t."event_Type" FROM "Transaction_Log" t ORDER BY t."event_Type" ASC LIMIT 50`,
      { type: QueryTypes.SELECT }
    );
    const uniqueActions = ["All Actions", ...distinctEvents.map(r => r.event_Type).filter(Boolean)];

    if (isExport) {
      const exportLogs = await sequelize.query(
        `SELECT
           t.*,
           u."user_FirstName" AS "emp_FirstName", u."user_LastName" AS "emp_LastName",
           a."user_FirstName" AS "admin_FirstName", a."user_LastName" AS "admin_LastName"
         FROM "Transaction_Log" t
         LEFT JOIN "User" u ON u."user_Id" = t."user_Id"
         LEFT JOIN "User" a ON a."user_Id" = t."initiated_By"
         ${whereClause}
         ORDER BY t."createdAt" DESC
         LIMIT 5000`,
        { replacements, type: QueryTypes.SELECT }
      );
      return res.status(200).json(exportLogs);
    }

    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitParam, 10) || 10));
    const offset = (page - 1) * limit;

    replacements.limit = limit;
    replacements.offset = offset;

    const pageLogs = await sequelize.query(
      `SELECT
         t.*,
         u."user_FirstName" AS "emp_FirstName", u."user_LastName" AS "emp_LastName",
         a."user_FirstName" AS "admin_FirstName", a."user_LastName" AS "admin_LastName"
       FROM "Transaction_Log" t
       LEFT JOIN "User" u ON u."user_Id" = t."user_Id"
       LEFT JOIN "User" a ON a."user_Id" = t."initiated_By"
       ${whereClause}
       ORDER BY t."createdAt" DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    res.status(200).json({
      data: pageLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      },
      stats: {
        total,
        payrollReleases: parseInt(statsResult?.payrollReleases || 0, 10),
        batchRuns: parseInt(statsResult?.batchRuns || 0, 10),
        unauthorizedScans: parseInt(statsResult?.unauthorizedScans || 0, 10)
      },
      uniqueActions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMyTransparencyLogs = async (req, res) => {
  try {
    const myUserId = req.user?.user_Id;
    if (!myUserId) {
      return res.status(401).json({ error: "Unauthorized access: Missing user session." });
    }

    // 1. Transparency Trail: Administrative access & changes targeting this employee
    const transparencyLogs = await sequelize.query(
      `SELECT
         a."auditId",
         a."action",
         a."module",
         a."target_Table",
         a."target_Id",
         a."old_Value",
         a."new_Value",
         a."createdAt",
         u."user_FirstName" AS "admin_FirstName",
         u."user_LastName" AS "admin_LastName",
         r."roleName" AS "admin_Role"
       FROM "Audit_Log" a
       LEFT JOIN "User" u ON u."user_Id" = a."user_Id"
       LEFT JOIN "user_Role" r ON r."roleId" = u."user_RoleId"
       WHERE a."target_Id" = :myUserId
         AND a."user_Id" != :myUserId
       ORDER BY a."createdAt" DESC
       LIMIT 100`,
      {
        replacements: { myUserId },
        type: QueryTypes.SELECT,
      }
    );

    // Sanitize any sensitive admin credentials/hashes
    const sanitizedTransparency = transparencyLogs.map(log => {
      const copy = { ...log };
      const stripSensitive = (obj) => {
        if (!obj || typeof obj !== "object") return obj;
        const cleaned = { ...obj };
        delete cleaned.user_Password;
        delete cleaned.password;
        delete cleaned.adminPassword;
        delete cleaned.admin_Password;
        delete cleaned.resetPasswordToken;
        delete cleaned.resetPasswordExpires;
        delete cleaned.user_MachipId;
        delete cleaned.machip_uid_hash;
        delete cleaned.card_UID;
        delete cleaned.account_number_bidx;
        return cleaned;
      };
      if (typeof copy.old_Value === "object") copy.old_Value = stripSensitive(copy.old_Value);
      if (typeof copy.new_Value === "object") copy.new_Value = stripSensitive(copy.new_Value);
      return copy;
    });

    // 2. Personal Activity: Hardware punches, logins, self actions
    const personalActivityLogs = await sequelize.query(
      `SELECT
         t."transId",
         t."event_Type",
         t."description",
         t."metadata",
         t."ip_Address",
         t."createdAt"
       FROM "Transaction_Log" t
       WHERE t."user_Id" = :myUserId
          OR t."initiated_By" = :myUserId
       ORDER BY t."createdAt" DESC
       LIMIT 100`,
      {
        replacements: { myUserId },
        type: QueryTypes.SELECT,
      }
    );

    // Sanitize metadata
    const sanitizedPersonal = personalActivityLogs.map(log => {
      const copy = { ...log };
      if (copy.metadata && typeof copy.metadata === "object") {
        const cleaned = { ...copy.metadata };
        delete cleaned.user_Password;
        delete cleaned.password;
        delete cleaned.card_UID;
        copy.metadata = cleaned;
      }
      return copy;
    });

    res.status(200).json({
      transparencyTrail: sanitizedTransparency,
      personalActivity: sanitizedPersonal,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.setRegistrationSession = async (req, res) => {
  const { userId, type } = req.body; // type: 'RFID' or 'FP'
  const upperType = type ? type.toUpperCase() : null;

  try {
    // Prepare in-memory session without sending cancel signal to ESP32
    const rfidController = require("./rfid.controller.js");
    if (rfidController && rfidController.prepareEnrollmentSession) {
      rfidController.prepareEnrollmentSession(upperType, userId);
    }

    const [session, created] = await System_State.findOrCreate({
      where: { key: 'REGISTRATION_SESSION' },
      defaults: { value: JSON.stringify({ userId, type: upperType }) }
    });

    if (!session) {
       return res.status(500).json({ success: false, message: "Failed to create session" });
    }

    if (!created) {
      await session.update({ value: JSON.stringify({ userId, type: upperType }) });
    }

    res.status(200).json({ success: true, message: "Registration session started" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.clearRegistrationSession = async (req, res) => {
  try {
    await System_State.destroy({ where: { key: 'REGISTRATION_SESSION' } });
    const rfidController = require("./rfid.controller.js");
    if (rfidController && rfidController.resetAllEnrollmentSessions) {
      await rfidController.resetAllEnrollmentSessions();
    }
    res.status(200).json({ success: true, message: "Registration session cleared" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.batchCalendar = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { parseCSVLine, sanitizeField } = require("../utils/sanitizer");

  try {
    const rawContent = fs.readFileSync(req.file.path, 'utf8');
    // Remove BOM if present
    const fileContent = rawContent.replace(/^\uFEFF/, '');
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'CSV file is empty or missing data rows.' });
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    console.log("[BATCH] Headers found:", headers);
    
    let successCount = 0;
    let errors = [];

    // Find indices for Field Work
    const idxUserId = headers.findIndex(h => h === 'user_id' || h === 'empno');
    const idxDate = headers.findIndex(h => h === 'date');
    const idxLocation = headers.findIndex(h => h === 'location');
    const idxHours = headers.findIndex(h => h === 'hours');
    const idxPurpose = headers.findIndex(h => h === 'purpose');

    if (idxUserId !== -1 && idxLocation !== -1) {
      console.log("[BATCH] Processing Field Work...");
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 2) continue;
        
        const empNo = values[idxUserId];
        const date = values[idxDate];
        const location = sanitizeField(values[idxLocation]);
        const hours = values[idxHours] || 8;
        const purpose = sanitizeField(values[idxPurpose] || "Batch Field Work");

        if(!empNo || !date || !location) {
          errors.push(`Row ${i+1}: Missing required fields (User_id, date, or location)`);
          continue;
        }
               
        // Find user by ID, MachipId, or displayId (MACJ-XXX)
        let cleanEmpNo = empNo;
        if (empNo.startsWith('MACJ-')) {
          cleanEmpNo = parseInt(empNo.replace('MACJ-', ''));
        }

        const userQuery = await sequelize.query(
          `SELECT u."user_Id" FROM "User" u
           LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
           WHERE u."user_Id"::text = :empNo 
              OR u."user_Id"::text = :cleanEmpNo::text
              OR h."user_MachipId" = :empNo
           LIMIT 1`,
          { replacements: { empNo, cleanEmpNo }, type: QueryTypes.SELECT }
        );

        if (userQuery.length > 0) {
          const userId = userQuery[0].user_Id;
          const nowStr = new Date().toISOString();
          
          // Create request
          const reqResult = await sequelize.query(
            `INSERT INTO "emp_Request" ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "createdAt", "updatedAt")
             VALUES (:userId, 2, 2, :today, :purpose, :now, :now) RETURNING "emp_reqId"`,
            { replacements: { userId, today: new Date().toISOString().split('T')[0], purpose, now: nowStr }, type: QueryTypes.INSERT }
          );
          
          const reqId = reqResult[0][0].emp_reqId;
          
          await sequelize.query(
            `INSERT INTO "Onfield_Work" ("emp_reqId", "user_Id", "DateonField", "NoDays", "NoHrs", "destination", "reason")
             VALUES (:reqId, :userId, :date, 1, :hours, :location, :purpose)`,
            { replacements: { reqId, userId, date, hours: parseFloat(hours), location, purpose }, type: QueryTypes.INSERT }
          );
          successCount++;
        } else {
          errors.push(`Row ${i+1}: Employee not found (${empNo})`);
        }
      }
    } else if (headers.includes('type') && headers.includes('name')) {
      console.log("[BATCH] Processing Holidays/Due Dates...");
      // Holiday or Due Date batch upload
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 3) continue;
        const type = sanitizeField(values[0]);
        const name = sanitizeField(values[1]);
        const date = values[2]?.trim();
        const details = sanitizeField(values[3] || "");

        if(!type || !name || !date) {
          errors.push(`Row ${i+1}: Missing required fields (type, name, or date)`);
          continue;
        }
        
        if (type === 'Due Date') {
          await sequelize.query(
            `INSERT INTO "DueDate" ("name", "date", "details")
             VALUES (:name, :date, :details)`,
            { replacements: { name, date, details }, type: QueryTypes.INSERT }
          );
        } else {
          let finalType = details || 'Regular Holiday';
          await sequelize.query(
            `INSERT INTO "Holiday" ("name", "date", "type")
             VALUES (:name, :date, :type)`,
            { replacements: { name, date, type: finalType }, type: QueryTypes.INSERT }
          );
        }
        successCount++;
      }
    } else {
       console.log("[BATCH] Invalid headers:", headers);
       if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
       return res.status(400).json({ error: "Invalid CSV format. Please use the provided template." });
    }
    
    console.log(`[BATCH] Completed. Success: ${successCount}, Errors: ${errors.length}`);
    res.status(200).json({ success: true, count: successCount, errors });

  } catch (error) {
    console.error("Batch upload error:", error);
    res.status(500).json({ error: "Failed to process batch upload: " + error.message });
  } finally {
    // Guaranteed cleanup on all execution paths
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("[BATCH CALENDAR CLEANUP ERROR]:", err.message);
      }
    }
  }
};

exports.createDueDate = async (req, res) => {
  try {
    const { name, date, details } = req.body;
    if (!name || !date) {
      return res.status(400).json({ error: "Name and date are required." });
    }
    const dueDate = await DueDate.create({ name, date, details });

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "System Settings", "CREATE_DUE_DATE", "DueDate", dueDate.dueDateId, null, dueDate.toJSON());

    res.status(201).json(dueDate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteDueDate = async (req, res) => {
  try {
    const { dueDateId } = req.params;
    
    if (!dueDateId || dueDateId === "undefined") {
      return res.status(400).json({ error: "Invalid Due Date ID provided." });
    }

    const dueDate = await DueDate.findOne({ where: { dueDateId: parseInt(dueDateId) } });

    const deleted = await DueDate.destroy({ where: { dueDateId: parseInt(dueDateId) } });
    
    if (deleted) {
      const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
      await logAudit(req, currentAdminId, "System Settings", "DELETE_DUE_DATE", "DueDate", parseInt(dueDateId), dueDate ? dueDate.toJSON() : null, null);
      res.status(200).json({ message: "Due Date deleted successfully." });
    } else {
      res.status(404).json({ error: "Due Date not found." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getReferenceTableData = async (req, res) => {
  const { tableType } = req.params;
  try {
    const { SSS_ContributionTable, Philhealth_ContributionTable, PagIBIG_ContributionTable, WithholdingTax_Table, ReferenceTable_Audit, sequelize } = require("../config/sequelize.js");
    let model;
    let dbTableName;
    if (tableType === "sss") { model = SSS_ContributionTable; dbTableName = "SSS_ContributionTable"; }
    else if (tableType === "philhealth") { model = Philhealth_ContributionTable; dbTableName = "Philhealth_ContributionTable"; }
    else if (tableType === "pagibig") { model = PagIBIG_ContributionTable; dbTableName = "PagIBIG_ContributionTable"; }
    else if (tableType === "tax") { model = WithholdingTax_Table; dbTableName = "WithholdingTax_Table"; }
    else {
      return res.status(400).json({ error: "Invalid reference table type." });
    }

    // Get ALL records sorted by range_Min (for active and historical preview)
    const records = await model.findAll({
      order: [["range_Min", "ASC"]]
    });

    // Get audit logs
    const auditLogs = await ReferenceTable_Audit.findAll({
      where: { tableName: dbTableName },
      order: [["uploadDate", "DESC"]]
    });

    // Query active audit IDs (those having active rows in the main table)
    const activeAudits = await model.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('auditId')), 'auditId']],
      where: { isActive: true }
    });
    
    const activeAuditIds = activeAudits.map(a => a.auditId).filter(id => id !== null && id !== undefined);

    res.status(200).json({ records, auditLogs, activeAuditIds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.uploadReferenceTable = async (req, res) => {
  const { tableType } = req.params;
  const { effectiveDate, periodType } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "CSV file is required." });
  }
  if (!effectiveDate) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Effective date is required." });
  }

  try {
    const { sequelize, SSS_ContributionTable, Philhealth_ContributionTable, PagIBIG_ContributionTable, WithholdingTax_Table, ReferenceTable_Audit } = require("../config/sequelize.js");
    const { parseCSV } = require("../utils/csvParser");
    
    let model;
    let dbTableName;
    let requiredFields = [];

    if (tableType === "sss") {
      model = SSS_ContributionTable;
      dbTableName = "SSS_ContributionTable";
      requiredFields = ["range_Min", "range_Max", "monthlySalaryCredit", "er_SS", "ee_SS"];
    } else if (tableType === "philhealth") {
      model = Philhealth_ContributionTable;
      dbTableName = "Philhealth_ContributionTable";
      requiredFields = ["range_Min", "range_Max", "rate", "employeeShareRatio"];
    } else if (tableType === "pagibig") {
      model = PagIBIG_ContributionTable;
      dbTableName = "PagIBIG_ContributionTable";
      requiredFields = ["range_Min", "range_Max", "ee_Rate", "er_Rate", "contributionCeiling"];
    } else if (tableType === "tax") {
      model = WithholdingTax_Table;
      dbTableName = "WithholdingTax_Table";
      requiredFields = ["range_Min", "range_Max", "baseTax", "excessRate", "excessOver"];
    } else {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Invalid reference table type." });
    }

    const csvContent = fs.readFileSync(req.file.path, "utf8");
    const parsedRows = parseCSV(csvContent);

    if (parsedRows.length === 0) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "The uploaded CSV file is empty or malformed." });
    }

    // Validate headers/fields in each row
    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      for (const field of requiredFields) {
        if (row[field] === undefined || row[field] === null || isNaN(Number(row[field]))) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: `Validation failed at row ${i + 1}: field "${field}" is missing or not a valid number.` });
        }
      }
    }

    // Sort rows by range_Min
    parsedRows.sort((a, b) => a.range_Min - b.range_Min);

    // Validate boundaries and continuity
    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      if (row.range_Min < 0 || row.range_Max <= row.range_Min) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: `Validation failed at row ${i + 1}: range_Min must be >= 0 and range_Max must be > range_Min.` });
      }

      // Check continuity with next row
      if (i < parsedRows.length - 1) {
        const nextRow = parsedRows[i + 1];
        if (nextRow.range_Min - row.range_Max > 1.05) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(400).json({ 
            error: `Gap detected between row ${i + 1} and ${i + 2}. Brackets must be continuous. (range_Max: ${row.range_Max}, next range_Min: ${nextRow.range_Min})`
          });
        }
      }
    }

    // Run DB transaction
    await sequelize.transaction(async (transaction) => {
      // 1. Deactivate ALL existing versions across table so only new upload is active
      await model.update(
        { isActive: false },
        { where: {}, transaction }
      );

      // 2. Create audit log entry
      const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
      const auditRecord = await ReferenceTable_Audit.create({
        tableName: dbTableName,
        uploadedBy: currentAdminId,
        uploadDate: new Date(),
        effectiveDate,
        fileName: req.file.originalname,
        rowCount: parsedRows.length,
        periodType: tableType === "tax" ? (periodType || "monthly") : null
      }, { transaction });

      const auditId = auditRecord.auditId;

      // 3. Prepare payload with auditId and periodType
      const recordsToInsert = parsedRows.map(row => ({
        ...row,
        effectiveDate,
        isActive: true,
        auditId,
        periodType: tableType === "tax" ? (periodType || "monthly") : undefined
      }));

      // 4. Bulk create new records
      await model.bulkCreate(recordsToInsert, { transaction });

      // Log to system audit logs as well
      await logAudit(req, currentAdminId, "System Settings", "UPLOAD_REF_TABLE", dbTableName, null, null, {
        fileName: req.file.originalname,
        rowCount: recordsToInsert.length,
        effectiveDate,
        auditId
      });
    });

    res.status(200).json({ success: true, count: parsedRows.length, message: `${dbTableName} uploaded successfully. ${parsedRows.length} rows inserted. Effective from ${effectiveDate}.` });
  } catch (error) {
    console.error("Reference table upload error:", error);
    res.status(500).json({ error: "Failed to process upload: " + error.message });
  } finally {
    // Guaranteed cleanup on all paths
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("[REF TABLE CLEANUP ERROR]:", err.message);
      }
    }
  }
};

exports.toggleReferenceTableVersion = async (req, res) => {
  const { tableType } = req.params;
  const { auditId, isActive } = req.body;

  if (!auditId || isActive === undefined) {
    return res.status(400).json({ error: "auditId and isActive status are required." });
  }

  try {
    const { sequelize, SSS_ContributionTable, Philhealth_ContributionTable, PagIBIG_ContributionTable, WithholdingTax_Table, ReferenceTable_Audit } = require("../config/sequelize.js");
    let model;
    let dbTableName;

    if (tableType === "sss") { model = SSS_ContributionTable; dbTableName = "SSS_ContributionTable"; }
    else if (tableType === "philhealth") { model = Philhealth_ContributionTable; dbTableName = "Philhealth_ContributionTable"; }
    else if (tableType === "pagibig") { model = PagIBIG_ContributionTable; dbTableName = "PagIBIG_ContributionTable"; }
    else if (tableType === "tax") { model = WithholdingTax_Table; dbTableName = "WithholdingTax_Table"; }
    else {
      return res.status(400).json({ error: "Invalid reference table type." });
    }

    // Run transaction to update status
    await sequelize.transaction(async (transaction) => {
      if (isActive) {
        if (tableType === "tax") {
          const auditRec = await ReferenceTable_Audit.findByPk(parseInt(auditId), { transaction });
          const pType = auditRec ? auditRec.periodType : null;
          if (pType) {
            await model.update(
              { isActive: false },
              { where: { periodType: pType }, transaction }
            );
          } else {
            await model.update(
              { isActive: false },
              { where: {}, transaction }
            );
          }
        } else {
          // 1. Deactivate ALL versions across table so only one version is active at a time
          await model.update(
            { isActive: false },
            { where: {}, transaction }
          );
        }
        // 2. Activate ONLY the selected audit version
        await model.update(
          { isActive: true },
          { where: { auditId: parseInt(auditId) }, transaction }
        );
      } else {
        // Deactivate the target version
        await model.update(
          { isActive: false },
          { where: { auditId: parseInt(auditId) }, transaction }
        );
      }
    });

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "System Settings", "TOGGLE_REF_TABLE", dbTableName, null, null, {
      auditId: parseInt(auditId),
      isActive: !!isActive
    });

    res.status(200).json({ success: true, message: `Successfully updated active status for version #${auditId} to ${!!isActive}.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const { sendContactSupportEmail } = require("../utils/emailService");
const { User } = require("../config/sequelize.js");

/**
 * Processes a user's contact support inquiry and sends an email to machipcaps67@gmail.com
 */
exports.contactSupport = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const userId = req.user?.user_Id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized session. Please log in again." });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: "Subject is required." });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    // Retrieve sender details (only query real User table columns)
    const user = await User.findByPk(userId, {
      attributes: [
        "user_Id",
        "user_FirstName",
        "user_LastName",
        "user_Email",
        "user_RoleId",
        "position",
        "department"
      ]
    });

    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    const userData = user.toJSON ? user.toJSON() : { ...user };
    const roleMap = { 1: "Administrator", 2: "Supervisor", 3: "Employee", 4: "Accountant" };
    userData.user_Role = roleMap[userData.user_RoleId] || "Employee";
    userData.user_DisplayId = formatUserNumber(userData.user_Id);

    // Dispatch email to machipcaps67@gmail.com with optional attachment
    await sendContactSupportEmail({
      user: userData,
      subject: subject.trim(),
      message: message.trim(),
      file: req.file || null
    });

    // Write audit log entry
    await logAudit(
      req,
      userId,
      "Help & Support",
      "SUPPORT_INQUIRY_SENT",
      "SupportInquiry",
      null,
      null,
      {
        subject: subject.trim(),
        hasAttachment: !!req.file,
        attachmentName: req.file ? req.file.originalname : null,
        targetEmail: "machipcaps67@gmail.com"
      }
    );

    res.status(200).json({
      success: true,
      message: "Your support inquiry has been sent to the administration team."
    });
  } catch (error) {
    console.error("[CONTACT SUPPORT CONTROLLER ERROR]:", error);
    res.status(500).json({
      error: "Failed to dispatch support inquiry. " + (error.message || "Please try again later.")
    });
  }
};
