const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    user_Number: { type: DataTypes.INTEGER, allowNull: false, autoIncrement: true, unique: true, primaryKey: true },
    user_Id: { type: DataTypes.STRING, allowNull: false, unique: true },
    user_Username: { type: DataTypes.STRING, allowNull: false, unique: true },
    user_FirstName: { type: DataTypes.STRING, allowNull: false},
    user_LastName: { type: DataTypes.STRING, allowNull: false},
    user_MiddleName: { type: DataTypes.STRING, allowNull: true},
    user_Email: { type: DataTypes.STRING, allowNull: false, unique: true },
    user_Password: { type: DataTypes.STRING, allowNull: false },
    user_MachipId: { type: DataTypes.STRING, allowNull: true, unique: true },
    user_Role: { type: DataTypes.ENUM('Employee', 'Staff', 'Admin'), allowNull: false, defaultValue: 'Employee' },
  }, {
    timestamps: false,
    freezeTableName: true,
    hooks: {
        beforeCreate: async (user) => {
          if (user.user_Password) {
            const salt = await bcrypt.genSalt(10);
            user.user_Password = await bcrypt.hash(user.user_Password, salt);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed('user_Password')) {
            const salt = await bcrypt.genSalt(10);
            user.user_Password = await bcrypt.hash(user.user_Password, salt);
          }
        }
      }
    });
    
  return User;
};