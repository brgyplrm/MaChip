module.exports = (sequelize, DataTypes) => {
  const PayrollPeriod = sequelize.define("PayrollPeriod", {
    periodId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    startDate: { type: DataTypes.DATEONLY, allowNull: false },
    endDate: { type: DataTypes.DATEONLY, allowNull: false },
    label: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: "Draft" } // Draft, Processing, Released, Closed
  }, { timestamps: true, freezeTableName: true });

  const Payroll_status = sequelize.define(
    "Payroll_status",
    {
      PaystatusId: { type: DataTypes.SMALLINT, primaryKey: true },
      PaystatusName: { type: DataTypes.STRING, allowNull: false },
    },
    { timestamps: false, freezeTableName: true },
  );

  const Payroll = sequelize.define(
    "Payroll",
    {
      payrollId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      periodId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      period_Start: { type: DataTypes.DATEONLY, allowNull: false },
      period_End: { type: DataTypes.DATEONLY, allowNull: false },
      NoDays_Worked: { type: DataTypes.SMALLINT, allowNull: false },
      NoHrs_Worked: { type: DataTypes.FLOAT, allowNull: false },
      dailyRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      previousDailyRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      ratePerHr: { type: DataTypes.FLOAT, allowNull: false },
      basicPay: { type: DataTypes.FLOAT, allowNull: false },
      totalEarnings: { type: DataTypes.FLOAT, allowNull: false },
      totalDeductions: { type: DataTypes.FLOAT, allowNull: false },
      netPay: { type: DataTypes.FLOAT, allowNull: false },
      holidaysTotal: { type: DataTypes.SMALLINT, defaultValue: 0 },
      holidaysRegularWorked: { type: DataTypes.SMALLINT, defaultValue: 0 },
      holidaysSpecialWorked: { type: DataTypes.SMALLINT, defaultValue: 0 },
      status: { type: DataTypes.SMALLINT, defaultValue: 1 },
    },
    { timestamps: true, freezeTableName: true },
  );

  const Payroll_Earnings = sequelize.define(
    "Payroll_Earnings",
    {
      earningId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      payrollId: { type: DataTypes.INTEGER, allowNull: false },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      OT_Hrs: { type: DataTypes.FLOAT, defaultValue: 0 },
      OT_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      restDay_OT_Hrs: { type: DataTypes.FLOAT, defaultValue: 0 },
      restDay_OT_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      leaveCredits: { type: DataTypes.FLOAT, defaultValue: 0 },
      nightDiff_Hrs: { type: DataTypes.FLOAT, defaultValue: 0 },
      nightDiff_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      restDay_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      specialHol_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      legalHol_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      incentives: { type: DataTypes.FLOAT, defaultValue: 0 },
      allowance: { type: DataTypes.FLOAT, defaultValue: 0 },
    },
    { timestamps: false, freezeTableName: true },
  );

  const Payroll_Deductions = sequelize.define(
    "Payroll_Deductions",
    {
      deductionId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      payrollId: { type: DataTypes.INTEGER, allowNull: false },
      absence_Hrs: { type: DataTypes.FLOAT, defaultValue: 0 },
      absence_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      tardiness_Mins: { type: DataTypes.FLOAT, defaultValue: 0 },
      tardiness_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      unpaidLeave_Days: { type: DataTypes.FLOAT, defaultValue: 0 },
      unpaidLeave_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      paidLeave_Days: { type: DataTypes.FLOAT, defaultValue: 0 },
    },
    { timestamps: false, freezeTableName: true },
  );

  // Relationships
  Payroll.belongsTo(PayrollPeriod, { foreignKey: "periodId" });
  PayrollPeriod.hasMany(Payroll, { foreignKey: "periodId" });

  Payroll.hasOne(Payroll_Earnings, { foreignKey: "payrollId" });
  Payroll.hasOne(Payroll_Deductions, { foreignKey: "payrollId" });

  Payroll_Earnings.belongsTo(Payroll, { foreignKey: "payrollId" });
  Payroll_Deductions.belongsTo(Payroll, { foreignKey: "payrollId" });
  
  Payroll.belongsTo(PayrollPeriod, { foreignKey: "periodId" });
  PayrollPeriod.hasMany(Payroll, { foreignKey: "periodId" });
  
  Payroll.belongsTo(Payroll_status, { foreignKey: "status", targetKey: "PaystatusId", as: "payrollStatus" });
  Payroll_status.hasMany(Payroll, { foreignKey: "status", sourceKey: "PaystatusId" });

  return { Payroll, Payroll_Earnings, Payroll_Deductions, Payroll_status, PayrollPeriod };
};
