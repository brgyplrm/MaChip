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
      freezeTableName: true, // Stops "Users" vs "User" duplicates
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

// 2. Define all models by passing the sequelize instance
const User = require("../models/user.models")(sequelize, DataTypes);
const {
  user_logging,
  employee_Logging_report,
  logged_status,
  attendance_status,
} = require("../models/attendance.models")(sequelize, DataTypes);

// 3. Define associations
User.hasMany(user_logging, { foreignKey: "user_id", sourceKey: "user_Id" });
user_logging.belongsTo(User, {
  foreignKey: "user_id",
  targetKey: "user_Id",
  as: "user",
});

// employee_Logging_report → User (daily report belongs to a user)
User.hasMany(employee_Logging_report, {
  foreignKey: "user_id",
  sourceKey: "user_Id",
});
employee_Logging_report.belongsTo(User, {
  foreignKey: "user_id",
  targetKey: "user_Id",
  as: "user",
});

// 4. The connectDB function remains the same
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(
      "Connection to the database has been established successfully.",
    );
    // Synchronize models (e.g., create tables if they don't exist)
    await sequelize.sync();
    console.log("All models were synchronized successfully.");

    // ── Migrate employee_Logging_report to the new daily-summary schema ───────
    // Disable FK checks so we can safely drop old columns and add new ones
    // without worrying about dangling constraint names from the old schema.
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
    try {
      // Alter the table to match the new model definition
      await employee_Logging_report.sync({ alter: true });
      console.log("employee_Logging_report schema migrated successfully.");
    } catch (err) {
      console.warn("employee_Logging_report migration warning:", err.message);
    } finally {
      await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    // ── Reset AUTO_INCREMENT counters to MAX + 1 ──────────────────────────────
    // MySQL InnoDB never rolls back the AUTO_INCREMENT counter on a failed INSERT.
    // This means every validation error or constraint violation permanently
    // inflates the counter. Running ALTER TABLE ... AUTO_INCREMENT = 1 on startup
    // tells MySQL to reset to MAX(id) + 1, closing any gaps accumulated from
    // previous failed attempts or from sync({ alter: true }) runs.
    // MySQL silently ignores the "1" and uses MAX(pk) + 1 instead.
    await sequelize.query("ALTER TABLE `User` AUTO_INCREMENT = 1");
    await sequelize.query("ALTER TABLE `user_logging` AUTO_INCREMENT = 1");
    await sequelize.query(
      "ALTER TABLE `employee_Logging_report` AUTO_INCREMENT = 1",
    );
    console.log("AUTO_INCREMENT counters normalized to MAX + 1.");

    const status_count = await logged_status.count();
    if (status_count == 0) {
      await logged_status.bulkCreate([
        { statusId: 1, statusName: "Logged In" },
        { statusId: 2, statusName: "Logged Out" },
      ]);
      console.log("Logged status data inserted successfully.");
    }

    const attendance_count = await attendance_status.count();
    if (attendance_count == 0) {
      await attendance_status.bulkCreate([
        { statusId: 1, statusName: "On-Time" },
        { statusId: 2, statusName: "Late" },
        { statusId: 3, statusName: "Absent" },
        { statusId: 4, statusName: "On-Leave" },
      ]);
      console.log("Attendance status data inserted successfully");
    }
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

// 5. Export everything
module.exports = {
  sequelize,
  connectDB,
  User,
  user_logging,
  employee_Logging_report,
  logged_status,
  attendance_status,
};
