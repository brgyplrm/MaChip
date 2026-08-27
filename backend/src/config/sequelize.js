const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");
const dbConfig = require("./db.config")[process.env.NODE_ENV || "development"];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  dbConfig
);

// ── Models ────────────────────────────────────────────────────────────────────
const {
  User,
  user_Role,
  employementStatus,
  User_Banking,
  User_Deduction_Profile,
  User_Hardware,
} = require("../models/user.models")(sequelize, DataTypes);

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
  Statutory_Leave,
  Loan_Request,
  Leave_Balance,
} = require("../models/request.model.js")(sequelize, DataTypes);

const {
  Payroll,
  Payroll_Earnings,
  Payroll_Deductions,
  Payroll_status,
  PayrollPeriod,
  Payroll_maxicare,
  Payroll_Cash_Advances,
  Payroll_Eastwest,
  Payroll_GovernmentLoans,
  Payroll_ThirteenthMonth,
  Payroll_Separation,
  Separation_Cause,
  Payroll_Retirement,
} = require("../models/payroll.model")(sequelize, DataTypes);

const { Notification } = require("../models/notification.models")(
  sequelize,
  DataTypes,
);

const { Position } = require("../models/position.models")(sequelize, DataTypes);

const {
  SystemSettings,
  Holiday,
  DueDate,
  Audit_Log,
  Transaction_Log,
  System_State,
} = require("../models/system.models")(sequelize, DataTypes);

const { Loan_Deductions, Loan_Deduction_History, Loan_Deduction_Schedules } =
  require("../models/loanDeductions.model")(sequelize, DataTypes);

const {
  SSS_ContributionTable,
  Philhealth_ContributionTable,
  PagIBIG_ContributionTable,
  WithholdingTax_Table,
  ReferenceTable_Audit,
} = require("../models/referenceTables.model")(sequelize, DataTypes);


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
Payroll.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ Maxicare
User.hasMany(Payroll_maxicare, { foreignKey: "user_Id", sourceKey: "user_Id" });
Payroll_maxicare.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ Payroll_Cash_Advances
User.hasMany(Payroll_Cash_Advances, {
  foreignKey: "user_Id",
  sourceKey: "user_Id",
});
Payroll_Cash_Advances.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ Payroll_Eastwest
User.hasMany(Payroll_Eastwest, { foreignKey: "user_Id", sourceKey: "user_Id" });
Payroll_Eastwest.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ Payroll_GovernmentLoans
User.hasMany(Payroll_GovernmentLoans, {
  foreignKey: "user_Id",
  sourceKey: "user_Id",
});
Payroll_GovernmentLoans.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ Payroll_ThirteenthMonth
User.hasMany(Payroll_ThirteenthMonth, {
  foreignKey: "user_Id",
  sourceKey: "user_Id",
});
Payroll_ThirteenthMonth.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ Payroll_Separation
User.hasMany(Payroll_Separation, {
  foreignKey: "user_Id",
  sourceKey: "user_Id",
});
Payroll_Separation.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ Payroll_Retirement
User.hasMany(Payroll_Retirement, {
  foreignKey: "user_Id",
  sourceKey: "user_Id",
});
Payroll_Retirement.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ Notification
User.hasMany(Notification, { foreignKey: "user_Id", sourceKey: "user_Id" });
Notification.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ User Request
User.hasMany(emp_Request, { foreignKey: "user_Id", sourceKey: "user_Id" });
emp_Request.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ Leave Balance
User.hasMany(Leave_Balance, { foreignKey: "user_Id", sourceKey: "user_Id" });
Leave_Balance.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

User.hasMany(Transaction_Log, { foreignKey: "user_Id", sourceKey: "user_Id" });
Transaction_Log.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

User.hasMany(Audit_Log, { foreignKey: "user_Id", sourceKey: "user_Id" });
Audit_Log.belongsTo(User, {
  foreignKey: "user_Id",
  targetKey: "user_Id",
  as: "user",
});

User.hasMany(ReferenceTable_Audit, { foreignKey: "uploadedBy", sourceKey: "user_Id" });
ReferenceTable_Audit.belongsTo(User, {
  foreignKey: "uploadedBy",
  targetKey: "user_Id",
  as: "uploader",
});


// User ↔ Loan_Deductions
User.hasMany(Loan_Deductions, { foreignKey: "userId", sourceKey: "user_Id" });
Loan_Deductions.belongsTo(User, {
  foreignKey: "userId",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ Loan_Deduction_Schedules
User.hasMany(Loan_Deduction_Schedules, {
  foreignKey: "userId",
  sourceKey: "user_Id",
});
Loan_Deduction_Schedules.belongsTo(User, {
  foreignKey: "userId",
  targetKey: "user_Id",
  as: "user",
});

// User ↔ Position
Position.hasMany(User, { foreignKey: "position_id", sourceKey: "positionId" });
User.belongsTo(Position, {
  foreignKey: "position_id",
  targetKey: "positionId",
  as: "jobPosition",
});

// Audit associations for Loan_Deductions
Loan_Deductions.belongsTo(User, {
  foreignKey: "createdBy",
  targetKey: "user_Id",
  as: "creator",
});
Loan_Deductions.belongsTo(User, {
  foreignKey: "updatedBy",
  targetKey: "user_Id",
  as: "updater",
});

// Payroll ↔ Loan_Deduction_History
Payroll.hasMany(Loan_Deduction_History, { foreignKey: "payrollId" });
Loan_Deduction_History.belongsTo(Payroll, {
  foreignKey: "payrollId",
  as: "payroll",
});

// ── connectDB ─────────────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(
      "Connection to the database has been established successfully.",
    );

    // Ensure all base models & tables exist
    await sequelize.sync();

    // Create the 13th Month table if it doesn't exist
    await Payroll_ThirteenthMonth.sync({ alter: true });

    // Create the Separation Pay table if it doesn't exist
    await Separation_Cause.sync({ alter: true });
    await Payroll_Separation.sync({ alter: true });

    // Create the Retirement Pay table if it doesn't exist
    await Payroll_Retirement.sync({ alter: true });

    // Ensure Exempt status exists
    await sequelize.query(`
      INSERT INTO "attendance_status" ("statusId", "statusName")
      VALUES 
        (6, 'Exempt'),
        (7, 'Incidental Visit'),
        (8, 'Irregular')
      ON CONFLICT ("statusId") DO NOTHING;
    `);

    // Ensure System Generated logged status exists
    await sequelize.query(`
      INSERT INTO "logged_status" ("statusId", "statusName")
      VALUES (7, 'System Generated')
      ON CONFLICT ("statusId") DO NOTHING;
    `);

    console.log("Models sync skipped (temporarily disabled to fix user_logging error).");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  sequelize,
  connectDB,
  User,
  User_Banking,
  User_Deduction_Profile,
  User_Hardware,
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
  Statutory_Leave,
  Loan_Request,
  Leave_Balance,
  Payroll_status,
  Payroll_Earnings,
  Payroll_Deductions,
  Payroll,
  Position,
  Notification,
  SystemSettings,
  Holiday,
  DueDate,
  PayrollPeriod,
  Audit_Log,
  Transaction_Log,
  System_State,
  Loan_Deductions,
  Loan_Deduction_History,
  Loan_Deduction_Schedules,
  Payroll_maxicare,
  Payroll_Cash_Advances,
  Payroll_Eastwest,
  Payroll_GovernmentLoans,
  Payroll_ThirteenthMonth,
  Payroll_Separation,
  Separation_Cause,
  Payroll_Retirement,
  SSS_ContributionTable,
  Philhealth_ContributionTable,
  PagIBIG_ContributionTable,
  WithholdingTax_Table,
  ReferenceTable_Audit,
};

