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

  // ── Parent ticket ─────────────────────────────────────────────────────────
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
        defaultValue: 1,
      },
      date_Filed: { type: DataTypes.DATEONLY, allowNull: false },
      date_Processed: { type: DataTypes.DATEONLY, allowNull: true },
      processedBy: { type: DataTypes.SMALLINT, allowNull: true }, // admin who gave final approval
      recommendedBy: { type: DataTypes.SMALLINT, allowNull: true }, // supervisor who recommended
      remarks: { type: DataTypes.TEXT, allowNull: true }, // employee remarks
      admin_remarks: { type: DataTypes.TEXT, allowNull: true }, // admin notes
      system_remarks: { type: DataTypes.TEXT, allowNull: true }, // auto-generated warnings
    },
    { timestamps: true, freezeTableName: true },
  );

  // ── Overtime Request ──────────────────────────────────────────────────────
  const Overtime_Request = sequelize.define(
    "Overtime_Request",
    {
      overtimeId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: { type: DataTypes.INTEGER, allowNull: false }, // FK → emp_Request
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      OT_DateOf: { type: DataTypes.DATEONLY, allowNull: false }, // "Date of Overtime"
      HrFrom: { type: DataTypes.TIME, allowNull: false }, // "From"
      HrTo: { type: DataTypes.TIME, allowNull: false }, // "To"
      Total_Hrs: { type: DataTypes.FLOAT, allowNull: false }, // "Total Hr"
      reason: { type: DataTypes.TEXT, allowNull: false }, // "Reasons For Overtime"
    },
    { timestamps: false, freezeTableName: true },
  );

  // ── Vacation Leave ────────────────────────────────────────────────────────
  const Vacation_Leave = sequelize.define(
    "Vacation_Leave",
    {
      Leave_Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: { type: DataTypes.INTEGER, allowNull: false }, // FK → emp_Request
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      StartDate: { type: DataTypes.DATEONLY, allowNull: false },
      EndDate: { type: DataTypes.DATEONLY, allowNull: false },
      NoDays: { type: DataTypes.SMALLINT, allowNull: false },
      purpose: { type: DataTypes.TEXT, allowNull: false },
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
      NoDays: { type: DataTypes.SMALLINT, allowNull: false },
      proof_File: { type: DataTypes.STRING, allowNull: true }, // doctor's cert path
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
      proof_File: { type: DataTypes.STRING, allowNull: true },
    },
    { timestamps: false, freezeTableName: true },
  );

  // ── Log Correction Request ────────────────────────────────────────────────
  const LogCorrection_Request = sequelize.define(
    "LogCorrection_Request",
    {
      log_corrId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: { type: DataTypes.INTEGER, allowNull: false },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      logDate: { type: DataTypes.DATEONLY, allowNull: false },
      currentIn: { type: DataTypes.TIME, allowNull: true },
      currentOut: { type: DataTypes.TIME, allowNull: true },
      claimedIn: { type: DataTypes.TIME, allowNull: false },
      claimedOut: { type: DataTypes.TIME, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: false },
      proof_File: { type: DataTypes.STRING, allowNull: true },
    },
    { timestamps: false, freezeTableName: true },
  );

  // ── Leave Balance ─────────────────────────────────────────────────────────
  const Leave_Balance = sequelize.define(
    "Leave_Balance",
    {
      balance_Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false },
      year: { type: DataTypes.SMALLINT, allowNull: false },
      VL_total: { type: DataTypes.FLOAT, defaultValue: 7 },
      VL_used: { type: DataTypes.FLOAT, defaultValue: 0 },
      VL_balance: { type: DataTypes.FLOAT, defaultValue: 7 },
      SL_total: { type: DataTypes.FLOAT, defaultValue: 7 },
      SL_used: { type: DataTypes.FLOAT, defaultValue: 0 },
      SL_balance: { type: DataTypes.FLOAT, defaultValue: 7 },
    },
    {
      timestamps: false,
      freezeTableName: true,
      indexes: [
        {
          unique: true,
          fields: ["user_Id", "year"],
          name: "unique_user_year_balance",
        },
      ],
    },
  );

  // ── Associations ──────────────────────────────────────────────────────────
  emp_Request.belongsTo(request_Status, {
    foreignKey: "emp_reqStatusId",
    targetKey: "reqStatId",
    as: "status",
  });
  request_Status.hasMany(emp_Request, {
    foreignKey: "emp_reqStatusId",
    sourceKey: "reqStatId",
  });

  emp_Request.belongsTo(request_Type, {
    foreignKey: "emp_reqTypeId",
    targetKey: "reqTypeId",
    as: "type",
  });
  request_Type.hasMany(emp_Request, {
    foreignKey: "emp_reqTypeId",
    sourceKey: "reqTypeId",
  });

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
  
  

  return {
    request_Status,
    request_Type,
    withPay,
    emp_Request,
    Overtime_Request,
    Vacation_Leave,
    Sick_Leave,
    Onfield_Work,
    LogCorrection_Request,
    Leave_Balance,
  };
};
