const { sequelize, SystemSettings, Holiday, PayrollPeriod } = require("../config/sequelize.js");
const { getSystemTime } = require("../utils/systemTime.js");
const { QueryTypes } = require("sequelize");
const { syncHolidaysService } = require('../utils/holidaySyncService');

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
    if (!settings) {
      await SystemSettings.create({ mockTimeEnabled, mockTimeValue });
    } else {
      await settings.update({ mockTimeEnabled, mockTimeValue });
    }
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
        res.status(201).json(period);
    } catch (error) {
        console.error("[ERROR] createPayrollPeriod:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getPayrollPeriods = async (req, res) => {
    try {
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

