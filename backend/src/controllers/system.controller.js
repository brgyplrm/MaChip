const { sequelize, SystemSettings, Holiday, PayrollPeriod } = require("../config/sequelize.js");
const { getSystemTime } = require("../utils/systemTime.js");
const { QueryTypes } = require("sequelize");
const { syncHolidaysService } = require('../utils/holidaySyncService');
const { logAudit } = require("../utils/logger");

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
  const { mockTimeEnabled, mockTimeValue } = req.body;
  try {
    const settings = await SystemSettings.findOne();
    let oldSettings = null;
    let newSettings;

    if (!settings) {
      newSettings = await SystemSettings.create({ mockTimeEnabled, mockTimeValue });
    } else {
      oldSettings = settings.toJSON();
      newSettings = await settings.update({ mockTimeEnabled, mockTimeValue });
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
    const now = await getSystemTime();
    res.status(200).json({ systemTime: now });
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
        const month = now.getMonth(); // 0-indexed
        const day = now.getDate();

        let startDate, endDate, label;

        if (day <= 15) {
            startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            endDate = `${year}-${String(month + 1).padStart(2, '0')}-15`;
            label = `${now.toLocaleString('default', { month: 'long' })} 1-15, ${year}`;
        } else {
            startDate = `${year}-${String(month + 1).padStart(2, '0')}-16`;
            // Get last day of month
            const lastDay = new Date(year, month + 1, 0).getDate();
            endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
            label = `${now.toLocaleString('default', { month: 'long' })} 16-${lastDay}, ${year}`;
        }

        // Check if this specific period already exists
        const existing = await PayrollPeriod.findOne({
            where: { startDate, endDate }
        });

        if (!existing) {
            console.log(`[SYSTEM] Auto-creating missing payroll period: ${label}`);
            await PayrollPeriod.create({
                startDate,
                endDate,
                label,
                status: 'Draft'
            });
        }
    } catch (error) {
        console.error("[ERROR] ensureCurrentPeriodExists:", error.message);
    }
};

exports.getPayrollPeriods = async (req, res) => {
    try {
        // Automatically check and create current period before returning list
        await ensureCurrentPeriodExists();

        const periods = await sequelize.query(
            `SELECT 
                pp."periodId",
                pp."startDate",
                pp."endDate",
                pp."label",
                pp."status",
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

