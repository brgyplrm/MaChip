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
  
  return { SystemSettings, Holiday };
};
