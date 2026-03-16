module.exports = (sequelize, DataTypes) => {
  const logged_status = sequelize.define(
    "logged_status",
    {
      statusId: { type: DataTypes.SMALLINT, primaryKey: true },
      statusName: { type: DataTypes.STRING, allowNull: false },
    },
    {
      timestamps: false,
    },
  );

  const attendance_status = sequelize.define(
    "attendance_status",
    {
      statusId: { type: DataTypes.SMALLINT, primaryKey: true },
      statusName: { type: DataTypes.STRING, allowNull: false },
    },
    {
      timestamps: false,
    },
  );

  const user_logging = sequelize.define(
    "user_logging",
    {
      user_id: { type: DataTypes.SMALLINT, allowNull: false },
      user_loggingId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        primaryKey: true,
        autoIncrement: true,
      },
      log_Date: { type: DataTypes.DATE, allowNull: false },
      time_Logged: { type: DataTypes.TIME, allowNull: false },
      logged_StatusId: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 1,
      },
      attendance_StatusId: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      timestamps: false,
      freezeTableName: true,
    },
  );

  user_logging.belongsTo(attendance_status, {
    foreignKey: "attendance_StatusId",
    targetKey: "statusId",
    as: "attendanceStatus",
  });

  attendance_status.hasMany(user_logging, {
    foreignKey: "attendance_StatusId",
    sourceKey: "statusId",
  });

  user_logging.belongsTo(logged_status, {
    foreignKey: "logged_StatusId",
    targetKey: "statusId",
    as: "loggedStatus",
  });

  logged_status.hasMany(user_logging, {
    foreignKey: "logged_StatusId",
    sourceKey: "statusId",
  });

  const employee_Logging_report = sequelize.define(
    "employee_Logging_report",
    {
      employee_Logging_reportId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        primaryKey: true,
        autoIncrement: true,
      },
      // FK to User.user_Id — one report row per user per day
      user_id: {
        type: DataTypes.SMALLINT,
        allowNull: false,
      },
      log_Date: {
        type: DataTypes.DATEONLY, // stores "YYYY-MM-DD", no time component
        allowNull: false,
      },
      // JSON arrays stored as TEXT, e.g. '["08:30:00","13:00:00"]'
      time_Logged_inArr: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "[]",
      },
      time_Logged_outArr: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: "[]",
      },
      // Attendance status from the FIRST login of the day (1=On-Time, 2=Late, 3=Absent, 4=On-Leave)
      attendance_StatusId: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        defaultValue: null,
      },
      // Last known status of the day: 1 = Logged In, 2 = Logged Out
      logged_StatusId: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      timestamps: false,
      freezeTableName: true,
      indexes: [
        {
          // Enforces one report row per user per calendar day
          unique: true,
          fields: ["user_id", "log_Date"],
          name: "unique_user_day",
        },
      ],
    },
  );

  // employee_Logging_report → attendance_status (for display joins)
  employee_Logging_report.belongsTo(attendance_status, {
    foreignKey: "attendance_StatusId",
    targetKey: "statusId",
    as: "attendanceStatus",
  });
  attendance_status.hasMany(employee_Logging_report, {
    foreignKey: "attendance_StatusId",
    sourceKey: "statusId",
  });

  // employee_Logging_report → logged_status (for display joins)
  employee_Logging_report.belongsTo(logged_status, {
    foreignKey: "logged_StatusId",
    targetKey: "statusId",
    as: "loggedStatus",
  });
  logged_status.hasMany(employee_Logging_report, {
    foreignKey: "logged_StatusId",
    sourceKey: "statusId",
  });

  return {
    user_logging,
    employee_Logging_report,
    logged_status,
    attendance_status,
  };
};
