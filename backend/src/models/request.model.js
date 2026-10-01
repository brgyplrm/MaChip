module.exports = (sequelize, DataTypes) => {
  const request_Status = sequelize.define(
    "request_Status",
    {
      reqStatId: { type: DataTypes.SMALLINT, primaryKey: true },
      reqStatName: { type: DataTypes.STRING, allowNull: false },
    },
    { timestamps: false, freezeTableName: true },
  );

  const request_Type = sequelize.define(
    "request_Type",
    {
      reqTypeId: { type: DataTypes.SMALLINT, primaryKey: true },
      reqTypeName: { type: DataTypes.STRING, allowNull: false },
    },
    { timestamps: false, freezeTableName: true },
  );

  const withPay = sequelize.define(
    "withPay",
    {
      withPayId: { type: DataTypes.SMALLINT, primaryKey: true },
      withPayName: { type: DataTypes.STRING, allowNull: false },
    },
    { timestamps: false, freezeTableName: true },
  );

  const emp_Request = sequelize.define(
    "emp_Request",
    {
      emp_reqId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      emp_reqTypeId: { type: DataTypes.SMALLINT, allowNull: false },
      emp_reqStatusId: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 1, // 1 for pending
      },
      date_Filed: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      date_Processed: { type: DataTypes.DATE, allowNull: true },
      processedBy: { type: DataTypes.SMALLINT, allowNull: true },
      recommendedBy: { type: DataTypes.SMALLINT, allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
      admin_remarks: { type: DataTypes.TEXT, allowNull: true },
      system_remarks: { type: DataTypes.TEXT, allowNull: true },
      last_escalated_at: { type: DataTypes.DATE, allowNull: true },
    },
    { timestamps: true, freezeTableName: true },
  );

  // ── Overtime Request ───────────────────────────────────────────────────────
  const Overtime_Request = sequelize.define(
    "Overtime_Request",
    {
      otId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: { type: DataTypes.INTEGER, allowNull: false }, // FK → emp_Request
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      OT_DateOf: { type: DataTypes.DATEONLY, allowNull: false },
      HrFrom: { type: DataTypes.STRING, allowNull: false },
      HrTo: { type: DataTypes.STRING, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: false },
      Total_Hrs: { type: DataTypes.FLOAT, allowNull: false },
    },
    { timestamps: false, freezeTableName: true },
  );

  // ── Vacation Leave ─────────────────────────────────────────────────────────
  const Vacation_Leave = sequelize.define(
    "Vacation_Leave",
    {
      vacL_Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: { type: DataTypes.INTEGER, allowNull: false }, // FK → emp_Request
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      StartDate: { type: DataTypes.DATEONLY, allowNull: false },
      EndDate: { type: DataTypes.DATEONLY, allowNull: false },
      NoDays: { type: DataTypes.FLOAT, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: false },
      WithPayID: { type: DataTypes.SMALLINT, allowNull: false },
    },
    { timestamps: false, freezeTableName: true },
  );

  // ── Sick Leave ────────────────────────────────────────────────────────────
  const Sick_Leave = sequelize.define(
    "Sick_Leave",
    {
      SickL_Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: { type: DataTypes.INTEGER, allowNull: false }, // FK → emp_Request
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      StartDate: { type: DataTypes.DATEONLY, allowNull: false },
      EndDate: { type: DataTypes.DATEONLY, allowNull: false },
      NoDays: { type: DataTypes.FLOAT, allowNull: false },
      proof_File: { type: DataTypes.STRING, allowNull: true }, // doctor's cert path
      reason: { type: DataTypes.TEXT, allowNull: false },
      WithPayID: { type: DataTypes.SMALLINT, allowNull: false },
    },
    { timestamps: false, freezeTableName: true },
  );

  // ── Emergency Leave ───────────────────────────────────────────────────────
  const Emergency_Leave = sequelize.define(
    "Emergency_Leave",
    {
      EL_Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: { type: DataTypes.INTEGER, allowNull: false },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      DateOfLeave: { type: DataTypes.DATEONLY, allowNull: false },
      NoDays: { type: DataTypes.FLOAT, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: false },
      WithPayID: { type: DataTypes.SMALLINT, allowNull: false },
    },
    { timestamps: false, freezeTableName: true },
  );

  // ── Half-day Leave ────────────────────────────────────────────────────────
  const HalfDay_Leave = sequelize.define(
    "HalfDay_Leave",
    {
      HD_Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: { type: DataTypes.INTEGER, allowNull: false },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      DateOfLeave: { type: DataTypes.DATEONLY, allowNull: false },
      period: { type: DataTypes.STRING, allowNull: false }, // "Morning" or "Afternoon"
      timeRange: { type: DataTypes.STRING, allowNull: false }, // e.g. "08:30am - 12:00pm"
      reason: { type: DataTypes.TEXT, allowNull: false },
      WithPayID: { type: DataTypes.SMALLINT, allowNull: false },
    },
    { timestamps: false, freezeTableName: true },
  );

  // ── Onfield Work ──────────────────────────────────────────────────────────
  const Onfield_Work = sequelize.define(
    "Onfield_Work",
    {
      onField_Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: { type: DataTypes.INTEGER, allowNull: false }, // FK → emp_Request
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      DateonField: { type: DataTypes.DATEONLY, allowNull: false },
      NoDays: { type: DataTypes.SMALLINT, allowNull: false },
      NoHrs: { type: DataTypes.FLOAT, allowNull: false },
      destination: { type: DataTypes.STRING, allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: false },
      proof_File: { type: DataTypes.STRING, allowNull: true },
    },
    { timestamps: false, freezeTableName: true },
  );

  // ── Log Correction Request ───────────────────────────────────────────────
  const LogCorrection_Request = sequelize.define(
    "LogCorrection_Request",
    {
      lcId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: { type: DataTypes.INTEGER, allowNull: false }, // FK → emp_Request
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      logDate: { type: DataTypes.DATEONLY, allowNull: false },
      currentIn: { type: DataTypes.STRING, allowNull: true },
      currentOut: { type: DataTypes.STRING, allowNull: true },
      claimedIn: { type: DataTypes.STRING, allowNull: true },
      claimedOut: { type: DataTypes.STRING, allowNull: true },
      correctionCategory: { type: DataTypes.STRING, allowNull: false },
      proof_File: { type: DataTypes.STRING, allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: true },
    },
    { timestamps: false, freezeTableName: true },
  );

  // ── Statutory Leave (Maternity, Paternity, Solo Parent, VAWC, Special) ───
  const Statutory_Leave = sequelize.define(
    "Statutory_Leave",
    {
      statL_Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: { type: DataTypes.INTEGER, allowNull: false }, // FK → emp_Request
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      StartDate: { type: DataTypes.DATEONLY, allowNull: false },
      EndDate: { type: DataTypes.DATEONLY, allowNull: false },
      NoDays: { type: DataTypes.FLOAT, allowNull: false },
      proof_File: { type: DataTypes.STRING, allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: false },
      WithPayID: { type: DataTypes.SMALLINT, allowNull: false },
    },
    { timestamps: false, freezeTableName: true },
  );

  // ── Loan Request ──────────────────────────────────────────────────────────
  const Loan_Request = sequelize.define(
    "Loan_Request",
    {
      loanReqId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: { type: DataTypes.INTEGER, allowNull: false },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      agency: { type: DataTypes.STRING(50), allowNull: false },
      loanType: { type: DataTypes.STRING(50), allowNull: false },
      amountRequested: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      monthsToPay: { type: DataTypes.INTEGER, allowNull: true },
      isEnrollment: { type: DataTypes.BOOLEAN, defaultValue: false },
      proof_File: { type: DataTypes.STRING, allowNull: true },
      loanReferenceNo: { type: DataTypes.STRING(100), allowNull: true },
      loanApprovalDate: { type: DataTypes.DATEONLY, allowNull: true },
      monthlyAmortization: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      totalLoanTerm: { type: DataTypes.INTEGER, allowNull: true },
      amortizationStartMonth: { type: DataTypes.STRING(50), allowNull: true },
      totalOutstandingBalance: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      calamityArea: { type: DataTypes.STRING(255), allowNull: true },
      damageProof_File: { type: DataTypes.STRING(255), allowNull: true },
      netPaySufficient: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: true },
      mscCount: { type: DataTypes.STRING(20), allowNull: true },
      avgMSC: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      consoDP: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      pagibigTAV: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      interestRate: { type: DataTypes.DOUBLE, defaultValue: 0.10 },
      serviceFee: { type: DataTypes.DOUBLE, defaultValue: 0.01 },
      proRatedInterest: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      netDisbursement: { type: DataTypes.DECIMAL(12, 2) },
      deductionFrequency: { type: DataTypes.STRING(20), defaultValue: 'semi-monthly', allowNull: true },
    },
    { timestamps: true, freezeTableName: true },
  );

  // ── Leave Balance ──────────────────────────────────────────────────────────
  const Leave_Balance = sequelize.define(
    "Leave_Balance",
    {
      lb_Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      year: { type: DataTypes.INTEGER, allowNull: false },
      VL_balance: { type: DataTypes.FLOAT, defaultValue: 7 },
      SL_balance: { type: DataTypes.FLOAT, defaultValue: 7 },
      SoloParent_balance: { type: DataTypes.FLOAT, defaultValue: 0 },
      VL_used: { type: DataTypes.FLOAT, defaultValue: 0 },
      SL_used: { type: DataTypes.FLOAT, defaultValue: 0 },
      SoloParent_used: { type: DataTypes.FLOAT, defaultValue: 0 },
    },
    { timestamps: true, freezeTableName: true },
  );

  // ── Associations ──────────────────────────────────────────────────────────
  emp_Request.hasOne(Overtime_Request, {
    foreignKey: "emp_reqId",
    sourceKey: "emp_reqId",
  });
  Overtime_Request.belongsTo(emp_Request, {
    foreignKey: "emp_reqId",
    as: "request",
  });

  emp_Request.hasOne(Vacation_Leave, {
    foreignKey: "emp_reqId",
    sourceKey: "emp_reqId",
  });
  Vacation_Leave.belongsTo(emp_Request, {
    foreignKey: "emp_reqId",
    as: "request",
  });

  emp_Request.hasOne(Sick_Leave, {
    foreignKey: "emp_reqId",
    sourceKey: "emp_reqId",
  });
  Sick_Leave.belongsTo(emp_Request, { foreignKey: "emp_reqId", as: "request" });

  emp_Request.hasOne(Emergency_Leave, {
    foreignKey: "emp_reqId",
    sourceKey: "emp_reqId",
  });
  Emergency_Leave.belongsTo(emp_Request, { foreignKey: "emp_reqId", as: "request" });

  emp_Request.hasOne(HalfDay_Leave, {
    foreignKey: "emp_reqId",
    sourceKey: "emp_reqId",
  });
  HalfDay_Leave.belongsTo(emp_Request, { foreignKey: "emp_reqId", as: "request" });

  emp_Request.hasOne(Onfield_Work, {
    foreignKey: "emp_reqId",
    sourceKey: "emp_reqId",
  });
  Onfield_Work.belongsTo(emp_Request, {
    foreignKey: "emp_reqId",
    as: "request",
  });

  emp_Request.hasOne(LogCorrection_Request, {
    foreignKey: "emp_reqId",
    sourceKey: "emp_reqId",
  });
  LogCorrection_Request.belongsTo(emp_Request, {
    foreignKey: "emp_reqId",
    as: "request",
  });

  emp_Request.hasOne(Statutory_Leave, {
    foreignKey: "emp_reqId",
    sourceKey: "emp_reqId",
  });
  Statutory_Leave.belongsTo(emp_Request, {
    foreignKey: "emp_reqId",
    as: "request",
  });

  emp_Request.hasOne(Loan_Request, {
    foreignKey: "emp_reqId",
    sourceKey: "emp_reqId",
  });
  Loan_Request.belongsTo(emp_Request, {
    foreignKey: "emp_reqId",
    as: "request",
  });

  Vacation_Leave.belongsTo(withPay, {
    foreignKey: "WithPayID",
    targetKey: "withPayId",
    as: "withPayType",
  });
  Sick_Leave.belongsTo(withPay, {
    foreignKey: "WithPayID",
    targetKey: "withPayId",
    as: "withPayType",
  });
  Statutory_Leave.belongsTo(withPay, {
    foreignKey: "WithPayID",
    targetKey: "withPayId",
    as: "withPayType",
  });
  
  return {
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
  };
};
