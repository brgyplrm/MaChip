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
    },
    {
      timestamps: true,
      freezeTableName: true,
    }
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
    }
  );

  const Audit_Log = sequelize.define("Audit_Log", {
    auditId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_Id: { type: DataTypes.SMALLINT, allowNull: false },
    action: { type: DataTypes.STRING, allowNull: false },
    target_Table: { type: DataTypes.STRING },
    target_Id: { type: DataTypes.INTEGER },
    old_Value: { type: DataTypes.JSONB },
    new_Value: { type: DataTypes.JSONB },
    ip_Address: { type: DataTypes.STRING },
  }, { timestamps: true, freezeTableName: true });

  const Transaction_Log = sequelize.define("Transaction_Log", {
    transId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_Id: { type: DataTypes.SMALLINT },
    initiated_By: { type: DataTypes.SMALLINT },
    event_Type: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    metadata: { type: DataTypes.JSONB },
  }, { timestamps: true, freezeTableName: true });
  
  return { SystemSettings, Holiday, Audit_Log, Transaction_Log };
};
