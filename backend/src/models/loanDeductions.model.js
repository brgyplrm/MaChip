module.exports = (sequelize, DataTypes) => {
  const Loan_Deductions = sequelize.define(
    "Loan_Deductions",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.SMALLINT,
        allowNull: false,
      },
      deductionType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          isIn: [['maxicare', 'eastwest', 'cash_advance', 'sss_loan', 'hdmf_loan', 'multipurpose', 'calamity']],
        },
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active',
        validate: {
          isIn: [['active', 'suspended', 'closed', 'paid_off']],
        },
      },
      contractDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      renewalDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      monthsToPay: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      deductionPerCutoff: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      totalDeducted: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      remainingBalance: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      lastDeductionDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      provider: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      reference: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.SMALLINT,
        allowNull: true,
      },
      deductionFrequency: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'semi-monthly',
      },
      updatedBy: {
        type: DataTypes.SMALLINT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
    }
  );

  const Loan_Deduction_History = sequelize.define(
    "Loan_Deduction_History",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      loanDeductionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      payrollId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      deductionDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      cutoffPeriod: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      amountDeducted: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      balanceAfter: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'processed',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      updatedAt: false, // history is immutable
      freezeTableName: true,
    }
  );

  const Loan_Deduction_Schedules = sequelize.define(
    "Loan_Deduction_Schedules",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      loanDeductionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.SMALLINT,
        allowNull: false,
      },
      cutoffDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      scheduledAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      actualAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
      indexes: [
        {
          unique: true,
          fields: ['loanDeductionId', 'cutoffDate'],
          name: 'unique_loan_cutoff',
        },
      ],
    }
  );

  // Internal Associations
  Loan_Deductions.hasMany(Loan_Deduction_History, {
    foreignKey: 'loanDeductionId',
    as: 'history',
  });
  Loan_Deduction_History.belongsTo(Loan_Deductions, {
    foreignKey: 'loanDeductionId',
    as: 'loan',
  });

  Loan_Deductions.hasMany(Loan_Deduction_Schedules, {
    foreignKey: 'loanDeductionId',
    as: 'schedules',
  });
  Loan_Deduction_Schedules.belongsTo(Loan_Deductions, {
    foreignKey: 'loanDeductionId',
    as: 'loan',
  });

  return { Loan_Deductions, Loan_Deduction_History, Loan_Deduction_Schedules };
};
