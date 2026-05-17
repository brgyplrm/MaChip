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
      payrollRates: {
        type: DataTypes.JSONB,
        allowNull: true,
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
