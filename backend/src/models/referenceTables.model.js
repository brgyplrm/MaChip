module.exports = (sequelize, DataTypes) => {
  const SSS_ContributionTable = sequelize.define(
    "SSS_ContributionTable",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      auditId: { type: DataTypes.INTEGER, allowNull: true },
      range_Min: { type: DataTypes.DOUBLE, allowNull: false },
      range_Max: { type: DataTypes.DOUBLE, allowNull: false },
      monthlySalaryCredit: { type: DataTypes.DOUBLE, allowNull: false },
      er_SS: { type: DataTypes.DOUBLE, allowNull: false },
      ee_SS: { type: DataTypes.DOUBLE, allowNull: false },
      er_EC: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
      ee_EC: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
      er_Provident: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
      ee_Provident: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
      effectiveDate: { type: DataTypes.DATEONLY, allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      timestamps: true,
      freezeTableName: true,
    }
  );

  const Philhealth_ContributionTable = sequelize.define(
    "Philhealth_ContributionTable",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      auditId: { type: DataTypes.INTEGER, allowNull: true },
      range_Min: { type: DataTypes.DOUBLE, allowNull: false },
      range_Max: { type: DataTypes.DOUBLE, allowNull: false },
      rate: { type: DataTypes.DOUBLE, allowNull: false },
      employeeShareRatio: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.5 },
      effectiveDate: { type: DataTypes.DATEONLY, allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      timestamps: true,
      freezeTableName: true,
    }
  );

  const PagIBIG_ContributionTable = sequelize.define(
    "PagIBIG_ContributionTable",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      auditId: { type: DataTypes.INTEGER, allowNull: true },
      range_Min: { type: DataTypes.DOUBLE, allowNull: false },
      range_Max: { type: DataTypes.DOUBLE, allowNull: false },
      ee_Rate: { type: DataTypes.DOUBLE, allowNull: false },
      er_Rate: { type: DataTypes.DOUBLE, allowNull: false },
      contributionCeiling: { type: DataTypes.DOUBLE, allowNull: false },
      effectiveDate: { type: DataTypes.DATEONLY, allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      timestamps: true,
      freezeTableName: true,
    }
  );

  const WithholdingTax_Table = sequelize.define(
    "WithholdingTax_Table",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      auditId: { type: DataTypes.INTEGER, allowNull: true },
      range_Min: { type: DataTypes.DOUBLE, allowNull: false },
      range_Max: { type: DataTypes.DOUBLE, allowNull: false },
      baseTax: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
      excessRate: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
      excessOver: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
      effectiveDate: { type: DataTypes.DATEONLY, allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      periodType: { type: DataTypes.STRING, allowNull: false, defaultValue: "semi-monthly" },
    },
    {
      timestamps: true,
      freezeTableName: true,
    }
  );

  const ReferenceTable_Audit = sequelize.define(
    "ReferenceTable_Audit",
    {
      auditId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      tableName: { type: DataTypes.STRING, allowNull: false },
      uploadedBy: { type: DataTypes.SMALLINT, allowNull: false },
      uploadDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      effectiveDate: { type: DataTypes.DATEONLY, allowNull: false },
      fileName: { type: DataTypes.STRING, allowNull: false },
      rowCount: { type: DataTypes.INTEGER, allowNull: false },
      periodType: { type: DataTypes.STRING, allowNull: true },
    },
    {
      timestamps: true,
      freezeTableName: true,
    }
  );

  return {
    SSS_ContributionTable,
    Philhealth_ContributionTable,
    PagIBIG_ContributionTable,
    WithholdingTax_Table,
    ReferenceTable_Audit,
  };
};
