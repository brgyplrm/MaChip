module.exports = (sequelize, DataTypes) => {
  const Position = sequelize.define(
    "Position",
    {
      positionId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      department: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      baseMonthlyPay: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0,
      },
      baseDailyRate: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
    }
  );

  return { Position };
};
