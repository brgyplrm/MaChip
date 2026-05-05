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
  Emergency_Leave,
  HalfDay_Leave,
  Onfield_Work,
  LogCorrection_Request,
  Leave_Balance,
} = require("../models/request.model")(sequelize, DataTypes);

const { Payroll, Payroll_Earnings, Payroll_Deductions, Payroll_status, PayrollPeriod, Payroll_maxicare, Payroll_Cash_Advances, Payroll_Eastwest, Payroll_GovernmentLoans } =
  require("../models/payroll.model")(sequelize, DataTypes);

const { Notification } = require("../models/notification.models")(
  sequelize,
  DataTypes,
);

const { SystemSettings, Holiday, Audit_Log, Transaction_Log } = require("../models/system.models")(
  sequelize,
  DataTypes,
);

const { Loan_Deductions, Loan_Deduction_History, Loan_Deduction_Schedules } = require("../models/loanDeductions.model")(
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

// User ↔ Maxicare
User.hasMany(Payroll_maxicare, { foreignKey: "user_Id", sourceKey: "user_Id" });
Payroll_maxicare.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id", as: "user" });

// User ↔ Payroll_Cash_Advances
User.hasMany(Payroll_Cash_Advances, { foreignKey: "user_Id", sourceKey: "user_Id" });
Payroll_Cash_Advances.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id", as: "user" });

// User ↔ Payroll_Eastwest
User.hasMany(Payroll_Eastwest, { foreignKey: "user_Id", sourceKey: "user_Id" });
Payroll_Eastwest.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id", as: "user" });

// User ↔ Payroll_GovernmentLoans
User.hasMany(Payroll_GovernmentLoans, { foreignKey: "user_Id", sourceKey: "user_Id" });
Payroll_GovernmentLoans.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id", as: "user" });

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

// User ↔ Loan_Deductions
User.hasMany(Loan_Deductions, { foreignKey: "userId", sourceKey: "user_Id" });
Loan_Deductions.belongsTo(User, { foreignKey: "userId", targetKey: "user_Id", as: "user" });

// User ↔ Loan_Deduction_Schedules
User.hasMany(Loan_Deduction_Schedules, { foreignKey: "userId", sourceKey: "user_Id" });
Loan_Deduction_Schedules.belongsTo(User, { foreignKey: "userId", targetKey: "user_Id", as: "user" });

// Audit associations for Loan_Deductions
Loan_Deductions.belongsTo(User, { foreignKey: "createdBy", targetKey: "user_Id", as: "creator" });
Loan_Deductions.belongsTo(User, { foreignKey: "updatedBy", targetKey: "user_Id", as: "updater" });

// Payroll ↔ Loan_Deduction_History
Payroll.hasMany(Loan_Deduction_History, { foreignKey: "payrollId" });
Loan_Deduction_History.belongsTo(Payroll, { foreignKey: "payrollId", as: "payroll" });

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
        ['hireDate', 'DATE'],
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
        ['globe_Deduction', 'FLOAT DEFAULT 0'],
        ['eastwest_Loan', 'FLOAT DEFAULT 0']
      ];
      for (const [col, type] of dedCols) {
        await sequelize.query(`ALTER TABLE "Payroll_Deductions" ADD COLUMN IF NOT EXISTS "${col}" ${type};`);
      }

      await sequelize.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "eastwest_Loan" FLOAT DEFAULT 0;`);

      await sequelize.query(`ALTER TABLE "Payroll_Earnings" ADD COLUMN IF NOT EXISTS "specialHol_Adj" FLOAT DEFAULT 0;`);

      const settingsCols = [
        ['maxicareTotalGross', 'FLOAT DEFAULT 23410.67'],
        ['maxicareMonthsToPay', 'INTEGER DEFAULT 12'],
        ['maxicareCycleStartDate', 'DATE'],
        ['maxicareDates', 'JSONB'],
        ['vlRate', 'DOUBLE PRECISION DEFAULT 1.0'],
        ['slRate', 'DOUBLE PRECISION DEFAULT 1.0']
      ];
      for (const [col, type] of settingsCols) {
        await sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "${col}" ${type};`);
      }

      // Loan Deductions Tables Migration (Manual SQL for constraints and indexes)
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "Loan_Deductions" (
          "id"                  SERIAL PRIMARY KEY,
          "userId"              SMALLINT NOT NULL REFERENCES "User"("user_Id") ON DELETE CASCADE,
          "deductionType"       VARCHAR(50) NOT NULL,
          "status"              VARCHAR(20) NOT NULL DEFAULT 'active',
          "contractDate"        DATE NOT NULL,
          "renewalDate"         DATE,
          "monthsToPay"         INTEGER,
          "deductionPerCutoff"  DECIMAL(10,2) NOT NULL,
          "totalAmount"         DECIMAL(12,2) NOT NULL,
          "totalDeducted"       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          "remainingBalance"    DECIMAL(12,2) NOT NULL,
          "lastDeductionDate"   DATE,
          "provider"            VARCHAR(150),
          "reference"           VARCHAR(150),
          "notes"               TEXT,
          "createdAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdBy"           SMALLINT REFERENCES "User"("user_Id"),
          "updatedBy"           SMALLINT REFERENCES "User"("user_Id"),
          CONSTRAINT "chk_deductionType" CHECK ("deductionType" IN ('maxicare','eastwest','cash_advance','sss_loan','hdmf_loan','multipurpose','calamity')),
          CONSTRAINT "chk_status" CHECK ("status" IN ('active','suspended','closed','paid_off')),
          CONSTRAINT "chk_amounts_positive" CHECK ("deductionPerCutoff" > 0 AND "totalAmount" > 0)
        );
      `);

      await sequelize.query('CREATE INDEX IF NOT EXISTS "idx_loan_user_type" ON "Loan_Deductions" ("userId", "deductionType");');
      await sequelize.query('CREATE INDEX IF NOT EXISTS "idx_loan_status" ON "Loan_Deductions" ("status");');

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "Loan_Deduction_History" (
          "id"                  SERIAL PRIMARY KEY,
          "loanDeductionId"     INTEGER NOT NULL REFERENCES "Loan_Deductions"("id") ON DELETE CASCADE,
          "payrollId"           INTEGER REFERENCES "Payroll"("payrollId"),
          "deductionDate"       DATE NOT NULL,
          "cutoffPeriod"        VARCHAR(20),
          "amountDeducted"      DECIMAL(10,2) NOT NULL,
          "balanceAfter"        DECIMAL(12,2) NOT NULL,
          "status"              VARCHAR(20) NOT NULL DEFAULT 'processed',
          "notes"               TEXT,
          "createdAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await sequelize.query('CREATE INDEX IF NOT EXISTS "idx_ldh_loan" ON "Loan_Deduction_History" ("loanDeductionId");');
      await sequelize.query('CREATE INDEX IF NOT EXISTS "idx_ldh_date" ON "Loan_Deduction_History" ("deductionDate");');

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "Loan_Deduction_Schedules" (
          "id"                  SERIAL PRIMARY KEY,
          "loanDeductionId"     INTEGER NOT NULL REFERENCES "Loan_Deductions"("id") ON DELETE CASCADE,
          "userId"              SMALLINT NOT NULL REFERENCES "User"("user_Id"),
          "cutoffDate"          DATE NOT NULL,
          "scheduledAmount"     DECIMAL(10,2) NOT NULL,
          "actualAmount"        DECIMAL(10,2),
          "status"              VARCHAR(20) NOT NULL DEFAULT 'pending',
          "createdAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE ("loanDeductionId", "cutoffDate")
        );
      `);

      await sequelize.query(`
        CREATE OR REPLACE FUNCTION update_loan_deductions_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await sequelize.query('DROP TRIGGER IF EXISTS trg_loan_deductions_updated_at ON "Loan_Deductions";');
      await sequelize.query(`
        CREATE TRIGGER trg_loan_deductions_updated_at
          BEFORE UPDATE ON "Loan_Deductions"
          FOR EACH ROW EXECUTE FUNCTION update_loan_deductions_updated_at();
      `);

      // Manual Migration for Payroll_maxicare Enum (Postgres special handling)
      try {
        await sequelize.query(`DO $$ BEGIN
          CREATE TYPE "enum_Payroll_maxicare_maxi_status" AS ENUM('paid', 'estimated');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;`);
      } catch (e) {}

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "Payroll_maxicare" (
          "maxicare_Id" SERIAL PRIMARY KEY,
          "user_Id" SMALLINT NOT NULL REFERENCES "User"("user_Id"),
          "max_Month" DATE NOT NULL,
          "amount" FLOAT DEFAULT 0,
          "maxi_status" "enum_Payroll_maxicare_maxi_status" DEFAULT 'estimated',
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          CONSTRAINT "user_month_unique" UNIQUE ("user_Id", "max_Month")
        );
      `);

      // Force add the unique constraint if the table existed without it
      await sequelize.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_month_unique') THEN
            ALTER TABLE "Payroll_maxicare" ADD CONSTRAINT "user_month_unique" UNIQUE ("user_Id", "max_Month");
          END IF;
        END $$;
      `);

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "Payroll_Cash_Advances" (
          "caId" SERIAL PRIMARY KEY,
          "user_Id" SMALLINT NOT NULL REFERENCES "User"("user_Id"),
          "date" DATE NOT NULL,
          "amount" FLOAT DEFAULT 0,
          "payrollId" INTEGER REFERENCES "Payroll"("payrollId"),
          "notes" TEXT,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "user_ca_date_unique" UNIQUE ("user_Id", "date")
        );
      `);

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "Payroll_Eastwest" (
          "eastwestId" SERIAL PRIMARY KEY,
          "user_Id" SMALLINT NOT NULL REFERENCES "User"("user_Id"),
          "date" DATE NOT NULL,
          "amount" FLOAT DEFAULT 0,
          "payrollId" INTEGER REFERENCES "Payroll"("payrollId"),
          "notes" TEXT,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "user_ew_date_unique" UNIQUE ("user_Id", "date")
        );
      `);

      try {
        await sequelize.query(`DO $$ BEGIN
          CREATE TYPE "enum_Payroll_GovernmentLoans_government_type" AS ENUM('SSS', 'Pag-IBIG', 'Calamity', 'Multi-Purpose');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;`);
      } catch (e) {}

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "Payroll_GovernmentLoans" (
          "govern_Id" SERIAL PRIMARY KEY,
          "user_Id" SMALLINT NOT NULL REFERENCES "User"("user_Id"),
          "government_type" "enum_Payroll_GovernmentLoans_government_type" NOT NULL DEFAULT 'SSS',
          "date" DATE NOT NULL,
          "amount" FLOAT DEFAULT 0,
          "payrollId" INTEGER REFERENCES "Payroll"("payrollId"),
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "user_gov_date_type_unique" UNIQUE ("user_Id", "date", "government_type")
        );
      `);

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
          maxicareTotalGross: 23410.67,
          maxicareMonthsToPay: 12,
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
        { reqStatId: 4, reqStatName: "Canceled" },
      ]);
      console.log("Seed: Request Status inserted.");
    } else {
      // Upsert Canceled if missing
      await sequelize.query(`INSERT INTO "request_Status" ("reqStatId", "reqStatName") VALUES (4, 'Canceled') ON CONFLICT DO NOTHING;`);
    }

    // Seed request_Type
    const reqTypeCount = await request_Type.count();
    if (reqTypeCount === 0) {
      await request_Type.bulkCreate([
        { reqTypeId: 1, reqTypeName: "Overtime" },
        { reqTypeId: 2, reqTypeName: "Onfield Work" },
        { reqTypeId: 3, reqTypeName: "Vacation Leave" },
        { reqTypeId: 4, reqTypeName: "Sick Leave" },
        { reqTypeId: 5, reqTypeName: "Log Correction" },
        { reqTypeId: 6, reqTypeName: "Emergency Leave" },
        { reqTypeId: 7, reqTypeName: "Half-day Request" }
      ]);
      console.log("Seed: Request Type inserted.");
    } else {
      // Upsert new types if missing
      await sequelize.query(`INSERT INTO "request_Type" ("reqTypeId", "reqTypeName") VALUES (6, 'Emergency Leave') ON CONFLICT DO NOTHING;`);
      await sequelize.query(`INSERT INTO "request_Type" ("reqTypeId", "reqTypeName") VALUES (7, 'Half-day Request') ON CONFLICT DO NOTHING;`);
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
  Emergency_Leave,
  HalfDay_Leave,
  Onfield_Work,
  LogCorrection_Request,
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
  Loan_Deductions,
  Loan_Deduction_History,
  Loan_Deduction_Schedules,
  Payroll_maxicare,
  Payroll_Cash_Advances,
  Payroll_Eastwest,
  Payroll_GovernmentLoans,
};
