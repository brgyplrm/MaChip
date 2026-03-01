const { Sequelize, DataTypes } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_DATABASE,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    dialect: "mysql",
    define: {
      freezeTableName: true,
    },
    dialectOptions: {
      ssl: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
      },
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
const User = require("../models/user.models")(sequelize, DataTypes);

const {
  user_logging,
  employee_Logging_report,
  logged_status,
  attendance_status,
} = require("../models/attendance.models")(sequelize, DataTypes);

const { Overtime, OvertimeStatuses } = require("../models/overtime.models")(
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

// User ↔ Overtime
User.hasMany(Overtime, { foreignKey: "OTuser_Id", sourceKey: "user_Id" });
Overtime.belongsTo(User, {
  foreignKey: "OTuser_Id",
  targetKey: "user_Id",
  as: "user",
});

// ── connectDB ─────────────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(
      "Connection to the database has been established successfully.",
    );

    // Create any missing tables (does NOT alter existing ones)
    await sequelize.sync();
    console.log("All models were synchronized successfully.");

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

    // ── Seed: OvertimeStatuses ──────────────────────────────────────────────
    try {
      const overtime_count = await OvertimeStatuses.count();
      if (overtime_count === 0) {
        await OvertimeStatuses.bulkCreate([
          { Status_Id: 1, Status_Name: "Pending" },
          { Status_Id: 2, Status_Name: "Approved" },
          { Status_Id: 3, Status_Name: "Rejected" },
        ]);
        console.log("Seed: OvertimeStatuses inserted.");
      }
    } catch (err) {
      console.error("Seed error (OvertimeStatuses):", err.message);
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
  Overtime,
  OvertimeStatuses,
};
