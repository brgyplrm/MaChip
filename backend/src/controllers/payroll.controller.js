const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");

// ── Constants ─────────────────────────────────────────────────────────────────
const WORK_START = "08:30:00"; // official start
const GRACE_END = "08:35:00"; // 5 min grace period
const WORK_HRS_PER_DAY = 8; // standard hours per day

// ── Generate Payroll ──────────────────────────────────────────────────────────
// Computes deductions (tardiness, absences) and OT earnings for a user
// for a given payroll period then saves to Payroll + child tables
exports.generatePayroll = async (req, res) => {
  const { user_Id, period_Start, period_End, ratePerHr } = req.body;

  if (!user_Id || !period_Start || !period_End || !ratePerHr) {
    return res
      .status(400)
      .json({
        error: "user_Id, period_Start, period_End, ratePerHr are required.",
      });
  }

  try {
    // ── 1. Get all working days in the period (Mon–Sat) ───────────────────
    const workingDays = await sequelize.query(
      `SELECT generate_series(
         :period_Start::date,
         :period_End::date,
         '1 day'::interval
       )::date AS work_date`,
      { replacements: { period_Start, period_End }, type: QueryTypes.SELECT },
    );

    // Filter out Sundays (0 = Sunday in PostgreSQL DOW)
    const validWorkDays = workingDays.filter((d) => {
      const day = new Date(d.work_date).getDay();
      return day !== 0; // exclude Sunday
    });

    const totalWorkDays = validWorkDays.length;

    // ── 2. Get attendance logs for this period ────────────────────────────
    const logs = await sequelize.query(
      `SELECT
         DATE("log_Date") AS log_date,
         MIN(CASE WHEN "logged_StatusId" = 1 THEN "time_Logged" END) AS first_in,
         MAX(CASE WHEN "logged_StatusId" = 2 THEN "time_Logged" END) AS last_out
       FROM "user_logging"
       WHERE "user_id" = :user_Id
       AND DATE("log_Date") BETWEEN :period_Start AND :period_End
       GROUP BY DATE("log_Date")`,
      {
        replacements: { user_Id, period_Start, period_End },
        type: QueryTypes.SELECT,
      },
    );

    // Map logs by date for easy lookup
    const logMap = {};
    logs.forEach((l) => {
      logMap[l.log_date] = l;
    });

    // ── 3. Compute absences and tardiness ─────────────────────────────────
    let absence_Days = 0;
    let tardiness_Mins = 0;

    for (const day of validWorkDays) {
      const dateStr = day.work_date;
      const log = logMap[dateStr];

      if (!log || !log.first_in) {
        // No clock in = absent
        absence_Days += 1;
      } else {
        // Check tardiness — compare first_in vs grace period
        const [gh, gm, gs] = GRACE_END.split(":").map(Number);
        const [lh, lm, ls] = log.first_in.split(":").map(Number);

        const graceMinutes = gh * 60 + gm;
        const loginMinutes = lh * 60 + lm;

        if (loginMinutes > graceMinutes) {
          tardiness_Mins += loginMinutes - graceMinutes;
        }
      }
    }

    // ── 4. Get approved OT for this period ───────────────────────────────
    const overtimeResult = await sequelize.query(
      `SELECT COALESCE(SUM(ot."Total_Hrs"), 0) AS total_OT_hrs
       FROM "Overtime_Request" ot
       JOIN "emp_Request" er ON er."emp_reqId" = ot."emp_reqId"
       WHERE ot."user_Id" = :user_Id
       AND ot."OT_DateOf" BETWEEN :period_Start AND :period_End
       AND er."emp_reqStatusId" = 2`, // 2 = Approved
      {
        replacements: { user_Id, period_Start, period_End },
        type: QueryTypes.SELECT,
      },
    );

    const OT_Hrs = parseFloat(overtimeResult[0].total_OT_hrs) || 0;

    // ── 5. Check approved leaves (unpaid) ────────────────────────────────
    const unpaidLeaves = await sequelize.query(
      `SELECT COALESCE(SUM(vl."NoDays"), 0) AS unpaid_vl_days
       FROM "Vacation_Leave" vl
       JOIN "emp_Request" er ON er."emp_reqId" = vl."emp_reqId"
       WHERE vl."user_Id" = :user_Id
       AND vl."LeaveDate" BETWEEN :period_Start AND :period_End
       AND er."emp_reqStatusId" = 2
       AND vl."isWithPay" = false`,
      {
        replacements: { user_Id, period_Start, period_End },
        type: QueryTypes.SELECT,
      },
    );

    const unpaidLeave_Days = parseFloat(unpaidLeaves[0].unpaid_vl_days) || 0;

    // ── 6. Compute amounts ────────────────────────────────────────────────
    const ratePerDay = ratePerHr * WORK_HRS_PER_DAY;
    const ratePerMin = ratePerHr / 60;

    const NoDays_Worked = totalWorkDays - absence_Days - unpaidLeave_Days;
    const NoHrs_Worked = NoDays_Worked * WORK_HRS_PER_DAY;
    const basicPay = NoHrs_Worked * ratePerHr;

    // Deductions
    const absence_Amnt = absence_Days * ratePerDay;
    const tardiness_Amnt = tardiness_Mins * ratePerMin;
    const unpaidLeave_Amnt = unpaidLeave_Days * ratePerDay;
    const totalDeductions = absence_Amnt + tardiness_Amnt + unpaidLeave_Amnt;

    // Earnings
    const OT_Amnt = OT_Hrs * ratePerHr; // same rate, adjust if OT rate differs
    const totalEarnings = basicPay + OT_Amnt;

    // Net Pay
    const netPay = totalEarnings - totalDeductions;

    // ── 7. Insert Payroll parent row ──────────────────────────────────────
    const payrollResult = await sequelize.query(
      `INSERT INTO "Payroll"
        ("user_Id", "period_Start", "period_End", "NoDays_Worked", "NoHrs_Worked",
         "ratePerHr", "basicPay", "totalEarnings", "totalDeductions", "netPay",
         "status", "createdAt", "updatedAt")
       VALUES
        (:user_Id, :period_Start, :period_End, :NoDays_Worked, :NoHrs_Worked,
         :ratePerHr, :basicPay, :totalEarnings, :totalDeductions, :netPay,
         1, NOW(), NOW())
       RETURNING *`,
      {
        replacements: {
          user_Id,
          period_Start,
          period_End,
          NoDays_Worked,
          NoHrs_Worked,
          ratePerHr,
          basicPay,
          totalEarnings,
          totalDeductions,
          netPay,
        },
        type: QueryTypes.INSERT,
      },
    );

    const payroll = payrollResult[0][0];
    const payrollId = payroll.payrollId;

    // ── 8. Insert Payroll_Earnings ────────────────────────────────────────
    await sequelize.query(
      `INSERT INTO "Payroll_Earnings"
        ("payrollId", "user_Id", "OT_Hrs", "OT_Amnt")
       VALUES
        (:payrollId, :user_Id, :OT_Hrs, :OT_Amnt)`,
      {
        replacements: { payrollId, user_Id, OT_Hrs, OT_Amnt },
        type: QueryTypes.INSERT,
      },
    );

    // ── 9. Insert Payroll_Deductions ──────────────────────────────────────
    await sequelize.query(
      `INSERT INTO "Payroll_Deductions"
        ("payrollId", "absence_Hrs", "absence_Amnt",
         "tardiness_Mins", "tardiness_Amnt",
         "unpaidLeave_Days", "unpaidLeave_Amnt")
       VALUES
        (:payrollId, :absence_Hrs, :absence_Amnt,
         :tardiness_Mins, :tardiness_Amnt,
         :unpaidLeave_Days, :unpaidLeave_Amnt)`,
      {
        replacements: {
          payrollId,
          absence_Hrs: absence_Days * WORK_HRS_PER_DAY,
          absence_Amnt,
          tardiness_Mins,
          tardiness_Amnt,
          unpaidLeave_Days,
          unpaidLeave_Amnt,
        },
        type: QueryTypes.INSERT,
      },
    );

    // ── 10. Return summary ────────────────────────────────────────────────
    return res.status(201).json({
      message: "Payroll generated successfully.",
      summary: {
        user_Id,
        period: `${period_Start} to ${period_End}`,
        NoDays_Worked,
        NoHrs_Worked,
        basicPay,
        earnings: {
          OT_Hrs,
          OT_Amnt,
          totalEarnings,
        },
        deductions: {
          absence_Days,
          absence_Amnt,
          tardiness_Mins,
          tardiness_Amnt,
          unpaidLeave_Days,
          unpaidLeave_Amnt,
          totalDeductions,
        },
        netPay,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── View Payroll by User ──────────────────────────────────────────────────────
exports.getPayrollByUser = async (req, res) => {
  const { user_Id } = req.params;
  try {
    const payrolls = await sequelize.query(
      `SELECT
         p.*,
         e."OT_Hrs", e."OT_Amnt",
         d."absence_Hrs", d."absence_Amnt",
         d."tardiness_Mins", d."tardiness_Amnt",
         d."unpaidLeave_Days", d."unpaidLeave_Amnt",
         u."user_FirstName", u."user_LastName",
         ps."PaystatusName"
       FROM "Payroll" p
       LEFT JOIN "Payroll_Earnings" e ON e."payrollId" = p."payrollId"
       LEFT JOIN "Payroll_Deductions" d ON d."payrollId" = p."payrollId"
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
       WHERE p."user_Id" = :user_Id
       ORDER BY p."period_Start" DESC`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    res.status(200).json(payrolls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── View All Payrolls ─────────────────────────────────────────────────────────
exports.getAllPayrolls = async (req, res) => {
  try {
    const payrolls = await sequelize.query(
      `SELECT
         p.*,
         u."user_FirstName", u."user_LastName", u."user_MachipId",
         ps."PaystatusName"
       FROM "Payroll" p
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
       ORDER BY p."createdAt" DESC`,
      { type: QueryTypes.SELECT },
    );

    res.status(200).json(payrolls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Release Payroll (change status to Released) ───────────────────────────────
exports.releasePayroll = async (req, res) => {
  const { payrollId } = req.params;
  try {
    await sequelize.query(
      `UPDATE "Payroll"
       SET "status" = 2, "updatedAt" = NOW()
       WHERE "payrollId" = :payrollId`,
      { replacements: { payrollId }, type: QueryTypes.UPDATE },
    );

    res.status(200).json({ message: "Payroll released successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
