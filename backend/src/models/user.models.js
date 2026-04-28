const bcrypt = require("bcryptjs");
module.exports = (sequelize, DataTypes) => {
  
  const user_Role = sequelize.define(
    "user_Role",
    {
      roleId: { type: DataTypes.SMALLINT, primaryKey: true },
      roleName: { type: DataTypes.STRING, allowNull: false },
    },
    {
      timestamps: false,
    },
  );
  
  const employementStatus = sequelize.define(
    "employementStatus",
    {
      statusId: { type: DataTypes.SMALLINT, primaryKey: true },
      statusName: { type: DataTypes.STRING, allowNull: false },
    },
    {
      timestamps: false,
    },
  );
  
  const User = sequelize.define(
    "User",
    {
      user_Id: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        unique: true,
        primaryKey: true,
      },
      user_FirstName: { type: DataTypes.STRING, allowNull: false },
      user_LastName: { type: DataTypes.STRING, allowNull: false },
      user_MiddleName: { type: DataTypes.STRING, allowNull: true },
      user_Email: { type: DataTypes.STRING, allowNull: false, unique: true },
      user_Password: { type: DataTypes.STRING, allowNull: false },
      user_MachipId: { type: DataTypes.STRING, allowNull: true, unique: true },
      user_RoleId: { type: DataTypes.SMALLINT, allowNull: false },
      user_EmploymentStatusId: { type: DataTypes.SMALLINT, allowNull: false },
      user_ProfilePic: { type: DataTypes.STRING, allowNull: true },
      account_Number: { type: DataTypes.STRING, allowNull: true },
      dailyRate: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
      previousDailyRate: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
      rateUpdatedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      timestamps: true,
      paranoid: true,
      freezeTableName: true,
      hooks: {
        beforeCreate: async (user) => {
          if (user.user_Password) {
            const salt = await bcrypt.genSalt(10);
            user.user_Password = await bcrypt.hash(user.user_Password, salt);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed("user_Password")) {
            const salt = await bcrypt.genSalt(10);
            user.user_Password = await bcrypt.hash(user.user_Password, salt);
          }
        },
      },
    },
  );
  
  User.belongsTo(user_Role, { foreignKey: "user_RoleId", targetKey: "roleId" });
  user_Role.hasMany(User, { foreignKey: "user_RoleId", sourceKey: "roleId" });
  User.belongsTo(employementStatus, { foreignKey: "user_EmploymentStatusId", targetKey: "statusId" });
  employementStatus.hasMany(User, { foreignKey: "user_EmploymentStatusId", sourceKey: "statusId" });

  return {  User, user_Role, employementStatus };
};
