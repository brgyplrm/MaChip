module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    user_Number: { type: DataTypes.STRING, allowNull: false, unique: true},
    user_Id: { type: DataTypes.STRING, allowNull: false, unique: true, primaryKey: true },
    user_Firstname: { type: DataTypes.STRING, allowNull: false },
    user_Lastname: { type: DataTypes.STRING, allowNull: false },
    user_Middlename: { type: DataTypes.STRING, allowNull: true },
    user_MachipId: { type: DataTypes.STRING, allowNull: false, unique: true },
    user_Role: { type: DataTypes.ENUM('Employee', 'Staff', 'Admin'), allowNull: false },
  });

  return User;
};