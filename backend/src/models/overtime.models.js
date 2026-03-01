module.exports = (sequelize, DataTypes) => {
  const Overtime = sequelize.define(
    "OvertimeRequest",
    {
      overtimeId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      OTuser_Id: {
        type: DataTypes.SMALLINT,
        allowNull: false,
      },
      date_Requested: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      hours_Requested: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      OvertimeStatusId: {
        type: DataTypes.TINYINT(1),
        allowNull: false,
      },
    },
    {
      timestamps: false,
    },
  );

  const OvertimeStatuses = sequelize.define(
    "OvertimeStatus",
    {
      Status_Id: {
        type: DataTypes.TINYINT(1),
        primaryKey: true,
      },
      Status_Name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      timestamps: false,
    },
  );

  Overtime.belongsTo(OvertimeStatuses, {
    foreignKey: "OvertimeStatusId",
    targetKey: "Status_Id",
    as: "Status",
  });

  OvertimeStatuses.hasMany(Overtime, {
    foreignKey: "OvertimeStatusId",
    sourceKey: "Status_Id",
  });

  return { Overtime, OvertimeStatuses };
};
