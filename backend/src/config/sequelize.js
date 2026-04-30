const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const sequelize = new Sequelize(
  process.env.DB_DATABASE,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
    timezone: "+08:00",
    define: {
      freezeTableName: true,
      useUTC: false, // Prevents conversion back to UTC when reading from DB
      dateStrings: true,
      typeCast: true,
    },
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
);

// ── Models ────────────────────────────────────────────────────────────────────
const { User, user_Role, employementStatus } = require("../models/user.models")(
  sequelize,
  DataTypes,
);

const {
  user_logging,
  employee_Logging_report,
  logged_status,
  attendance_status,
} = require("../models/attendance.models")(sequelize, DataTypes);

const {
  request_Status,
  request_Type,
  withPay,
  emp_Request,
  Overtime_Request,
  Vacation_Leave,
  Sick_Leave,
  Onfield_Work,
  Leave_Balance,
} = require("../models/request.model")(sequelize, DataTypes);

const { Payroll, Payroll_Earnings, Payroll_Deductions, Payroll_status, PayrollPeriod } =
  require("../models/payroll.model")(sequelize, DataTypes);

const { Notification } = require("../models/notification.models")(
  sequelize,
  DataTypes,
);

const { SystemSettings, Holiday, Audit_Log, Transaction_Log } = require("../models/system.models")(
  sequelize,
  DataTypes,
);

// ── Associations ──────────────────────────────────────────────────────────────

// User ↔ user_logging
User.hasMany(user_logging, { foreignKey: "user_id", sourceKey: "user_Id" });
user_logging.belongsTo(User, {
  foreignKey: "user_id",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ employee_Logging_report
User.hasMany(employee_Logging_report, {
  foreignKey: "user_id",
  sourceKey: "user_Id",
});
employee_Logging_report.belongsTo(User, {
  foreignKey: "user_id",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ Payroll
User.hasMany(Payroll, { foreignKey: "user_Id", sourceKey: "user_Id" });
Payroll.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id", as: "user" });

// User ↔ Notification
User.hasMany(Notification, { foreignKey: "user_Id", sourceKey: "user_Id" });
Notification.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id", as: "user" });

// User ↔ User Request
User.hasMany(emp_Request, { foreignKey: "user_Id", sourceKey: "user_Id" });
emp_Request.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id", as: "user" });

// User ↔ Leave Balance
User.hasMany(Leave_Balance, { foreignKey: "user_Id", sourceKey: "user_Id" });
Leave_Balance.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id", as: "user" });

User.hasMany(Transaction_Log, { foreignKey: "user_Id", sourceKey: "user_Id" });
Transaction_Log.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id", as: "user" });

User.hasMany(Audit_Log, { foreignKey: "user_Id", sourceKey: "user_Id" });
Audit_Log.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id", as: "user" });

// ── connectDB ─────────────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(
      "Connection to the database has been established successfully.",
    );

    // Create any missing tables or update existing ones
    await sequelize.sync();
    console.log("All models were synchronized successfully.");

    // ── Manual Migrations ────────────────────────────────────────────────────
    try {
      const userCols = [
        ['taxStatus', "VARCHAR(5) DEFAULT 'S'"],
        ['department', 'VARCHAR(100)'],
        ['position', 'VARCHAR(100)'],
        ['sss_Share', 'FLOAT DEFAULT 0'],
        ['philhealth_Share', 'FLOAT DEFAULT 0'],
        ['hdmf_Share', 'FLOAT DEFAULT 0'],
        ['tax_Share', 'FLOAT DEFAULT 0']
      ];
      for (const [col, type] of userCols) {
        await sequelize.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "${col}" ${type};`);
      }

      const dedCols = [
        ['SSS_Ded', 'FLOAT DEFAULT 0'],
        ['Philhealth_Ded', 'FLOAT DEFAULT 0'],
        ['HDMF_Ded', 'FLOAT DEFAULT 0'],
        ['Tax_Ded', 'FLOAT DEFAULT 0'],
        ['healthCard_Amnt', 'FLOAT DEFAULT 0'],
        ['SSS_Loan', 'FLOAT DEFAULT 0'],
        ['HDMF_Loan', 'FLOAT DEFAULT 0'],
        ['calamityLoan_Amnt', 'FLOAT DEFAULT 0'],
        ['multiPurposeSavings', 'FLOAT DEFAULT 0'],
        ['advances_Amnt', 'FLOAT DEFAULT 0'],
        ['globe_Deduction', 'FLOAT DEFAULT 0']
      ];
      for (const [col, type] of dedCols) {
        await sequelize.query(`ALTER TABLE "Payroll_Deductions" ADD COLUMN IF NOT EXISTS "${col}" ${type};`);
      }
      console.log("Manual migrations applied.");
    } catch (err) {
      console.error("Manual migration error:", err.message);
    }

    // ── Seed: SystemSettings ─────────────────────────────────────────────────
    try {
      const settingsCount = await SystemSettings.count();
      if (settingsCount === 0) {
        await SystemSettings.create({
          mockTimeEnabled: false,
          mockTimeValue: null,
        });
        console.log("Seed: SystemSettings inserted.");
      }
    } catch (err) {
      console.error("Seed error (SystemSettings):", err.message);
    }

    // ── Seed: logged_status ─────────────────────────────────────────────────
    try {
      const status_count = await logged_status.count();
      if (status_count === 0) {
        await logged_status.bulkCreate([
          { statusId: 1, statusName: "Clock In" },
          { statusId: 2, statusName: "Clock Out" },
          { statusId: 3, statusName: "Out For Lunch" },
          { statusId: 4, statusName: "In From Lunch" },
          { statusId: 5, statusName: "Overtime-In" },
          { statusId: 6, statusName: "Overtime-Out" },
        ]);
        console.log("Seed: logged_status inserted.");
      }
    } catch (err) {
      console.error("Seed error (logged_status):", err.message);
    }

    // ── Seed: attendance_status ─────────────────────────────────────────────
    try {
      const attendance_count = await attendance_status.count();
      if (attendance_count === 0) {
        await attendance_status.bulkCreate([
          { statusId: 1, statusName: "On-Time" },
          { statusId: 2, statusName: "Late" },
          { statusId: 3, statusName: "Absent" },
          { statusId: 4, statusName: "On-Leave" },
        ]);
        console.log("Seed: attendance_status inserted.");
      }
    } catch (err) {
      console.error("Seed error (attendance_status):", err.message);
    }
    // Seed user_Role
    const roleCount = await user_Role.count();
    if (roleCount === 0) {
      await user_Role.bulkCreate([
        { roleId: 1, roleName: "Admin" },
        { roleId: 2, roleName: "Supervisor" },
        { roleId: 3, roleName: "Employee" },
      ]);
      console.log("Seed: User Roles inserted.");
    }

    // Seed employementStatus
    const empCount = await employementStatus.count();
    if (empCount === 0) {
      await employementStatus.bulkCreate([
        { statusId: 1, statusName: "Regular" },
        { statusId: 2, statusName: "OJT/Intern" },
        { statusId: 3, statusName: "Part-time" },
      ]);
      console.log("Seed: Employment Status inserted.");
    }

    // Seed request_Status
    const reqCount = await request_Status.count();
    if (reqCount === 0) {
      await request_Status.bulkCreate([
        { reqStatId: 1, reqStatName: "Pending" },
        { reqStatId: 2, reqStatName: "Approved" },
        { reqStatId: 3, reqStatName: "Rejected" },
      ]);
      console.log("Seed: Request Status inserted.");
    }

    // Seed request_Type
    const reqTypeCount = await request_Type.count();
    if (reqTypeCount === 0) {
      await request_Type.bulkCreate([
        { reqTypeId: 1, reqTypeName: "Overtime" },
        { reqTypeId: 2, reqTypeName: "Onfield Work" },
        { reqTypeId: 3, reqTypeName: "Vacation Leave" },
        { reqTypeId: 4, reqTypeName: "Sick Leave" },
        { reqTypeId: 5, reqTypeName: "Log Correction" }
      ]);
      console.log("Seed: Request Type inserted.");
    }

    // Seed Payroll_status
    const payrollStatusCount = await Payroll_status.count();
    if (payrollStatusCount === 0) {
      await Payroll_status.bulkCreate([
        { PaystatusId: 1, PaystatusName: "Processing" },
        { PaystatusId: 2, PaystatusName: "Released" },
      ]);
      console.log("Seed: Payroll Status inserted.");
    }

    // Seed withPay
    const withPayCount = await withPay.count();
    if (withPayCount === 0) {
      await withPay.bulkCreate([
        { withPayId: 1, withPayName: "Leave with Pay" },
        { withPayId: 2, withPayName: "Leave without Pay" },
        { withPayId: 3, withPayName: "Considered AWOL" },
        { withPayId: 4, withPayName: "For Suspension" },
        { withPayId: 5, withPayName: "For Dismissal" },
      ]);
      console.log("Seed: With Pay inserted.");
    }
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  sequelize,
  connectDB,
  User,
  user_logging,
  employee_Logging_report,
  logged_status,
  attendance_status,
  user_Role,
  employementStatus,
  request_Status,
  request_Type,
  withPay,
  emp_Request,
  Overtime_Request,
  Vacation_Leave,
  Sick_Leave,
  Onfield_Work,
  Leave_Balance,
  Payroll_status,
  Payroll_Earnings,
  Payroll_Deductions,
  Payroll,
  Notification,
  SystemSettings,
  Holiday,
  PayrollPeriod,
  Audit_Log,
  Transaction_Log,
};
