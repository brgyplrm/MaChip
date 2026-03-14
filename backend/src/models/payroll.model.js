module.exports = (sequelize, DataTypes) => {
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
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      period_Start: { type: DataTypes.DATEONLY, allowNull: false }, // "JANUARY 01"
      period_End: { type: DataTypes.DATEONLY, allowNull: false }, // "JANUARY 15"
      NoDays_Worked: { type: DataTypes.SMALLINT, allowNull: false }, // "Number of Days: 13"
      NoHrs_Worked: { type: DataTypes.FLOAT, allowNull: false }, // "104.00 hrs"
      ratePerHr: { type: DataTypes.FLOAT, allowNull: false },
      basicPay: { type: DataTypes.FLOAT, allowNull: false }, // "Pay this period"
      totalEarnings: { type: DataTypes.FLOAT, allowNull: false }, // "Total Pay"
      totalDeductions: { type: DataTypes.FLOAT, allowNull: false }, // "Total Deduction"
      netPay: { type: DataTypes.FLOAT, allowNull: false }, // "Net Pay"
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
      payrollId: { type: DataTypes.INTEGER, allowNull: false }, // FK → Payroll
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },

      // From your payslip LEFT side
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
      payrollId: { type: DataTypes.INTEGER, allowNull: false }, // FK → Payroll

      // ── YOUR SCOPE (compute these) ──────────────────────
      absence_Hrs: { type: DataTypes.FLOAT, defaultValue: 0 },
      absence_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      tardiness_Mins: { type: DataTypes.FLOAT, defaultValue: 0 }, // in minutes
      tardiness_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      unpaidLeave_Days: { type: DataTypes.FLOAT, defaultValue: 0 },
      unpaidLeave_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
    },
    { timestamps: false, freezeTableName: true },
  );

  Payroll.hasMany(Payroll_Earnings, { foreignKey: "payrollId" });
  Payroll.hasMany(Payroll_Deductions, { foreignKey: "payrollId" });

  Payroll_Earnings.belongsTo(Payroll, { foreignKey: "payrollId" });
  Payroll_Deductions.belongsTo(Payroll, { foreignKey: "payrollId" });

  Payroll_Earnings.hasMany(Payroll_Earnings, { foreignKey: "payrollId" });
  Payroll_Deductions.hasMany(Payroll_Deductions, { foreignKey: "payrollId" });

  Payroll_Earnings.belongsTo(Payroll_Earnings, { foreignKey: "payrollId" });
  Payroll_Deductions.belongsTo(Payroll_Deductions, { foreignKey: "payrollId" });

  return { Payroll, Payroll_Earnings, Payroll_Deductions, Payroll_status };
};
