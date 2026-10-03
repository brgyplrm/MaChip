module.exports = (sequelize, DataTypes) => {
  const SystemSettings = sequelize.define(
    "SystemSettings",
    {
      settingId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      mockTimeEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      mockTimeValue: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      mockTimeSetAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      maxicareTotalGross: {
        type: DataTypes.FLOAT,
        defaultValue: 23410.67,
      },
      maxicareMonthsToPay: {
        type: DataTypes.INTEGER,
        defaultValue: 12,
      },
      maxicareCycleStartDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      maxicareDates: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      vlRate: {
        type: DataTypes.DOUBLE,
        defaultValue: 1.0,
      },
      slRate: {
        type: DataTypes.DOUBLE,
        defaultValue: 1.0,
      },
      storageRootPath: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Shift Configurations
      enableNightShift: { type: DataTypes.BOOLEAN, defaultValue: false },
      morningShiftStart: { type: DataTypes.TIME, defaultValue: "08:30:00" },
      morningShiftEnd: { type: DataTypes.TIME, defaultValue: "17:30:00" },
      eveningShiftStart: { type: DataTypes.TIME, defaultValue: "20:30:00" },
      eveningShiftEnd: { type: DataTypes.TIME, defaultValue: "05:30:00" },

      // Attendance Thresholds
      gracePeriod: { type: DataTypes.TIME, defaultValue: "08:35:00" },
      lunchStartThreshold: { type: DataTypes.TIME, defaultValue: "11:30:00" },
      lunchEndThreshold: { type: DataTypes.TIME, defaultValue: "13:30:00" },
      lunchDuration: { type: DataTypes.INTEGER, defaultValue: 60 },
      flexibleBreakThreshold: { type: DataTypes.INTEGER, defaultValue: 300 }, // in minutes (e.g., 5 hours)
      workHourThreshold: { type: DataTypes.FLOAT, defaultValue: 4.0 }, // Hours needed to not be marked as absent

      // Labor Multipliers
      ordinaryDayRate: { type: DataTypes.DOUBLE, defaultValue: 1.0 },
      specialDayRate: { type: DataTypes.DOUBLE, defaultValue: 1.3 },
      restDayRate: { type: DataTypes.DOUBLE, defaultValue: 1.3 },
      regularHolidayRate: { type: DataTypes.DOUBLE, defaultValue: 2.0 },
      nightDiffRate: { type: DataTypes.DOUBLE, defaultValue: 1.1 },
      overtimeRate: { type: DataTypes.DOUBLE, defaultValue: 1.25 },
      doubleRegularHolidayRate: { type: DataTypes.DOUBLE, defaultValue: 3.0 },
      specialDayRestDayRate: { type: DataTypes.DOUBLE, defaultValue: 1.5 },
      doubleSpecialDayRate: { type: DataTypes.DOUBLE, defaultValue: 1.5 },
      doubleSpecialDayRestDayRate: { type: DataTypes.DOUBLE, defaultValue: 1.95 },
      regularHolidayRestDayRate: { type: DataTypes.DOUBLE, defaultValue: 2.6 },
      doubleRegularHolidayRestDayRate: { type: DataTypes.DOUBLE, defaultValue: 3.9 },

      payrollRates: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      mandatedMinimumWage: {
        type: DataTypes.DOUBLE,
        defaultValue: 610.0,
      },
      mandatedWageEffectiveDate: {
        type: DataTypes.DATEONLY,
        defaultValue: '2025-07-18',
      },
      payrollGracePeriodDays: {
        type: DataTypes.INTEGER,
        defaultValue: 7,
      },
      payrollCutoffBufferDays: {
        type: DataTypes.INTEGER,
        defaultValue: 2,
      },
      payrollProcessingDeadlineDays: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
      },
      payrollAutoRelease: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      payrollRemindersEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      payrollWeekendRule: {
        type: DataTypes.STRING(30),
        defaultValue: 'PRECEDING_FRIDAY',
      },
      archivedRetentionYears: {
        type: DataTypes.INTEGER,
        defaultValue: 5,
      },
      hardwareBufferWindow: {
        type: DataTypes.INTEGER,
        defaultValue: 5,
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
    },
  );

  const Holiday = sequelize.define(
    "Holiday",
    {
      holidayId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING, // e.g., "Regular Holiday", "Special Holiday"
        allowNull: false,
      },
    },
    {
      timestamps: false,
      freezeTableName: true,
    },
  );

  const DueDate = sequelize.define(
    "DueDate",
    {
      dueDateId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      timestamps: false,
      freezeTableName: true,
    },
  );

  const Audit_Log = sequelize.define(
    "Audit_Log",
    {
      auditId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      action: { type: DataTypes.STRING, allowNull: false },
      target_Table: { type: DataTypes.STRING },
      target_Id: { type: DataTypes.INTEGER },
      old_Value: { type: DataTypes.JSONB },
      new_Value: { type: DataTypes.JSONB },
      ip_Address: { type: DataTypes.STRING(45) },
      module: { type: DataTypes.STRING },
    },
    { timestamps: true, freezeTableName: true },
  );

  const Transaction_Log = sequelize.define(
    "Transaction_Log",
    {
      transId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_Id: { type: DataTypes.SMALLINT },
      initiated_By: { type: DataTypes.SMALLINT },
      event_Type: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT },
      metadata: { type: DataTypes.JSONB },
      ip_Address: { type: DataTypes.STRING(45) },
    },
    { timestamps: true, freezeTableName: true },
  );

  const System_State = sequelize.define(
    "System_State",
    {
      stateId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      key: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
    },
  );

  return { SystemSettings, Holiday, DueDate, Audit_Log, Transaction_Log, System_State };
};
