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
      NoDays_Worked: { type: DataTypes.FLOAT, allowNull: false },
      NoHrs_Worked: { type: DataTypes.FLOAT, allowNull: false },
      totalScheduledDays: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
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
      specialHol_Adj: { type: DataTypes.FLOAT, defaultValue: 0 },
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
      SSS_Ded: { type: DataTypes.FLOAT, defaultValue: 0 },
      Philhealth_Ded: { type: DataTypes.FLOAT, defaultValue: 0 },
      HDMF_Ded: { type: DataTypes.FLOAT, defaultValue: 0 },
      SSS_Ded_ER: { type: DataTypes.FLOAT, defaultValue: 0 },
      Philhealth_Ded_ER: { type: DataTypes.FLOAT, defaultValue: 0 },
      HDMF_Ded_ER: { type: DataTypes.FLOAT, defaultValue: 0 },
      Tax_Ded: { type: DataTypes.FLOAT, defaultValue: 0 },
      healthCard_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      SSS_Loan: { type: DataTypes.FLOAT, defaultValue: 0 },
      HDMF_Loan: { type: DataTypes.FLOAT, defaultValue: 0 },
      calamityLoan_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      multiPurposeSavings: { type: DataTypes.FLOAT, defaultValue: 0 },
      advances_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      globe_Deduction: { type: DataTypes.FLOAT, defaultValue: 0 },
      eastwest_Loan: { type: DataTypes.FLOAT, defaultValue: 0 },
    },
    { timestamps: false, freezeTableName: true },
  );

  const Payroll_maxicare = sequelize.define(
    "Payroll_maxicare",
    {
      maxicare_Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_Id: { 
        type: DataTypes.SMALLINT, 
        allowNull: false,
        unique: 'user_month_unique'
      },
      max_Month: { 
        type: DataTypes.DATEONLY, 
        allowNull: false,
        unique: 'user_month_unique'
      },
      amount: { type: DataTypes.FLOAT, defaultValue: 0 },
      maxi_status: {
        type: DataTypes.ENUM("paid", "estimated"),
        defaultValue: "estimated",
      },
    },
    { timestamps: true, freezeTableName: true },
  );

  const Payroll_Cash_Advances = sequelize.define(
    "Payroll_Cash_Advances",
    {
      caId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_Id: { 
        type: DataTypes.SMALLINT, 
        allowNull: false,
        unique: 'user_ca_date_unique'
      },
      date: { 
        type: DataTypes.DATEONLY, 
        allowNull: false,
        unique: 'user_ca_date_unique'
      },
      amount: { type: DataTypes.FLOAT, defaultValue: 0 },
      payrollId: { type: DataTypes.INTEGER, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { timestamps: true, freezeTableName: true },
  );

  const Payroll_Eastwest = sequelize.define(
    "Payroll_Eastwest",
    {
      eastwestId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_Id: { 
        type: DataTypes.SMALLINT, 
        allowNull: false,
        unique: 'user_ew_date_unique'
      },
      date: { 
        type: DataTypes.DATEONLY, 
        allowNull: false,
        unique: 'user_ew_date_unique'
      },
      amount: { type: DataTypes.FLOAT, defaultValue: 0 },
      payrollId: { type: DataTypes.INTEGER, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { timestamps: true, freezeTableName: true },
  );

  const Payroll_GovernmentLoans = sequelize.define(
    "Payroll_GovernmentLoans",
    {
      governId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: "govern_Id"
      },
      user_Id: { 
        type: DataTypes.SMALLINT, 
        allowNull: false,
        unique: 'user_gov_date_type_unique'
      },
      government_type: {
        type: DataTypes.ENUM("SSS", "Pag-IBIG", "Calamity", "Multi-Purpose"),
        defaultValue: "SSS",
        allowNull: false,
        unique: 'user_gov_date_type_unique'
      },
      date: { 
        type: DataTypes.DATEONLY, 
        allowNull: false,
        unique: 'user_gov_date_type_unique'
      },
      amount: { type: DataTypes.FLOAT, defaultValue: 0 },
      payrollId: { type: DataTypes.INTEGER, allowNull: true },
    },
    { timestamps: true, freezeTableName: true },
  );

  const Payroll_ThirteenthMonth = sequelize.define(
    "Payroll_ThirteenthMonth",
    {
      thirteenthId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_Id: { 
        type: DataTypes.SMALLINT, 
        allowNull: false,
        unique: 'user_thirteenth_year_unique'
      },
      year: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        unique: 'user_thirteenth_year_unique'
      },
      totalBasicEarned: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      amount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      taxable_Excess: { type: DataTypes.FLOAT, defaultValue: 0 },
      status: { 
        type: DataTypes.ENUM("Draft", "Released"),
        defaultValue: "Draft"
      },
      releasedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { timestamps: true, freezeTableName: true },
  );

  // Relationships
  Payroll.belongsTo(PayrollPeriod, { foreignKey: "periodId" });
  PayrollPeriod.hasMany(Payroll, { foreignKey: "periodId" });

  Payroll.hasOne(Payroll_Earnings, { foreignKey: "payrollId" });
  Payroll.hasOne(Payroll_Deductions, { foreignKey: "payrollId" });

  Payroll_Earnings.belongsTo(Payroll, { foreignKey: "payrollId" });
  Payroll_Deductions.belongsTo(Payroll, { foreignKey: "payrollId" });
  
  Payroll.belongsTo(Payroll_status, { foreignKey: "status", targetKey: "PaystatusId", as: "payrollStatus" });
  Payroll_status.hasMany(Payroll, { foreignKey: "status", sourceKey: "PaystatusId" });

  Payroll.hasMany(Payroll_Cash_Advances, { foreignKey: "payrollId" });
  Payroll_Cash_Advances.belongsTo(Payroll, { foreignKey: "payrollId" });

  Payroll.hasMany(Payroll_Eastwest, { foreignKey: "payrollId" });
  Payroll_Eastwest.belongsTo(Payroll, { foreignKey: "payrollId" });

  Payroll.hasMany(Payroll_GovernmentLoans, { foreignKey: "payrollId" });
  Payroll_GovernmentLoans.belongsTo(Payroll, { foreignKey: "payrollId" });

  return { Payroll, Payroll_Earnings, Payroll_Deductions, Payroll_status, PayrollPeriod, Payroll_maxicare, Payroll_Cash_Advances, Payroll_Eastwest, Payroll_GovernmentLoans, Payroll_ThirteenthMonth };
};
