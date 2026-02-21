module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    user_Number: { type: DataTypes.INTEGER, allowNull: false, autoIncrement: true, unique: true, primaryKey: true },
    user_Id: { type: DataTypes.STRING, allowNull: false, unique: true },
    user_FirstName: { type: DataTypes.STRING, allowNull: false },
    user_LastName: { type: DataTypes.STRING, allowNull: false },
    user_MiddleName: { type: DataTypes.STRING, allowNull: true },
    user_MachipId: { type: DataTypes.STRING, allowNull: false, unique: true },
    user_Role: { type: DataTypes.ENUM('Employee', 'Staff', 'Admin'), allowNull: false, defaultValue: 'Employee' },
  }, {
    timestamps: false,
    freezeTableName: true
  });

  return User;
};