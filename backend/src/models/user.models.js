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
      user_RoleId: { type: DataTypes.SMALLINT, allowNull: false },
      user_EmploymentStatusId: { type: DataTypes.SMALLINT, allowNull: false },
      user_ProfilePic: { type: DataTypes.STRING, allowNull: true },
      recommendedBy: { type: DataTypes.SMALLINT, allowNull: true },
      department: { type: DataTypes.STRING(100), allowNull: true },
      position: { type: DataTypes.STRING(100), allowNull: true },
      position_id: { type: DataTypes.INTEGER, allowNull: true },
      hireDate: { type: DataTypes.DATEONLY, allowNull: true },
      user_Phone: { type: DataTypes.STRING(20), allowNull: true },
      user_Address: { type: DataTypes.TEXT, allowNull: true },
      user_DOB: { type: DataTypes.DATEONLY, allowNull: true },
      user_Gender: { type: DataTypes.STRING(20), allowNull: true },
      civil_status: { type: DataTypes.STRING(20), defaultValue: "Single" },
      is_solo_parent: { type: DataTypes.BOOLEAN, defaultValue: false },
      user_ShiftId: { type: DataTypes.SMALLINT, defaultValue: 1 }, // 1 = Morning, 2 = Evening
      taxStatus: { type: DataTypes.STRING(5), defaultValue: "S" },
      dailyRate: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
      previousDailyRate: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
      rateUpdatedAt: { type: DataTypes.DATE, allowNull: true },
      hasAvailedRetirementTax: { type: DataTypes.BOOLEAN, defaultValue: false },
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

  const User_Banking = sequelize.define(
    "User_Banking",
    {
      bankingId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false, unique: true },
      account_Number: { type: DataTypes.STRING, allowNull: true },
      bank_Company: { type: DataTypes.STRING, allowNull: true },
      bank_AccountName: { type: DataTypes.STRING, allowNull: true },
    },
    {
      timestamps: true,
      paranoid: true,
      freezeTableName: true,
    }
  );

  const User_Deduction_Profile = sequelize.define(
    "User_Deduction_Profile",
    {
      profileId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false, unique: true },
      sss_Share: { type: DataTypes.FLOAT, defaultValue: 0 },
      philhealth_Share: { type: DataTypes.FLOAT, defaultValue: 0 },
      hdmf_Share: { type: DataTypes.FLOAT, defaultValue: 0 },
      tax_Share: { type: DataTypes.FLOAT, defaultValue: 0 },
      healthCard_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      SSS_Loan: { type: DataTypes.FLOAT, defaultValue: 0 },
      HDMF_Loan: { type: DataTypes.FLOAT, defaultValue: 0 },
      calamityLoan_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      advances_Amnt: { type: DataTypes.FLOAT, defaultValue: 0 },
      globe_Deduction: { type: DataTypes.FLOAT, defaultValue: 0 },
      eastwest_Loan: { type: DataTypes.FLOAT, defaultValue: 0 },
      multiPurposeSavings: { type: DataTypes.FLOAT, defaultValue: 0 },
    },
    {
      timestamps: true,
      paranoid: true,
      freezeTableName: true,
    }
  );

  const User_Hardware = sequelize.define(
    "User_Hardware",
    {
      hardwareId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_Id: { type: DataTypes.SMALLINT, allowNull: false, unique: true },
      user_MachipId: { type: DataTypes.STRING, allowNull: true, unique: true },
      user_FingerprintId: { type: DataTypes.INTEGER, allowNull: true, unique: true },
      user_FingerprintTemplate: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      timestamps: true,
      paranoid: true,
      freezeTableName: true,
    }
  );
  
  User.belongsTo(user_Role, { foreignKey: "user_RoleId", targetKey: "roleId" });
  user_Role.hasMany(User, { foreignKey: "user_RoleId", sourceKey: "roleId" });
  User.belongsTo(employementStatus, { foreignKey: "user_EmploymentStatusId", targetKey: "statusId" });
  employementStatus.hasMany(User, { foreignKey: "user_EmploymentStatusId", sourceKey: "statusId" });

  // 1:1 Associations
  User.hasOne(User_Banking, { foreignKey: "user_Id", sourceKey: "user_Id", as: "banking" });
  User_Banking.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id" });

  User.hasOne(User_Deduction_Profile, { foreignKey: "user_Id", sourceKey: "user_Id", as: "deductions" });
  User_Deduction_Profile.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id" });

  User.hasOne(User_Hardware, { foreignKey: "user_Id", sourceKey: "user_Id", as: "hardware" });
  User_Hardware.belongsTo(User, { foreignKey: "user_Id", targetKey: "user_Id" });

  return { User, user_Role, employementStatus, User_Banking, User_Deduction_Profile, User_Hardware };
};

