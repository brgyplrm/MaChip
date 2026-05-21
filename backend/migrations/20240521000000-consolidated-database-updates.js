'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = async (tableName) => {
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    };

    // ── 1. Create Normalization & New Feature Tables ───────────────────────────
    
    // User_Banking
    if (!await tableExists('User_Banking')) {
      await queryInterface.createTable('User_Banking', {
        bankingId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false, unique: true },
        account_Number: { type: Sequelize.STRING, allowNull: true },
        bank_Company: { type: Sequelize.STRING, allowNull: true },
        bank_AccountName: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
    }

    // User_Deduction_Profile
    if (!await tableExists('User_Deduction_Profile')) {
      await queryInterface.createTable('User_Deduction_Profile', {
        profileId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false, unique: true },
        sss_Share: { type: Sequelize.FLOAT, defaultValue: 0 },
        sss_is_manual: { type: Sequelize.BOOLEAN, defaultValue: false },
        philhealth_Share: { type: Sequelize.FLOAT, defaultValue: 0 },
        ph_is_manual: { type: Sequelize.BOOLEAN, defaultValue: false },
        hdmf_Share: { type: Sequelize.FLOAT, defaultValue: 0 },
        hdmf_is_manual: { type: Sequelize.BOOLEAN, defaultValue: false },
        tax_Share: { type: Sequelize.FLOAT, defaultValue: 0 },
        healthCard_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        SSS_Loan: { type: Sequelize.FLOAT, defaultValue: 0 },
        HDMF_Loan: { type: Sequelize.FLOAT, defaultValue: 0 },
        calamityLoan_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        advances_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        globe_Deduction: { type: Sequelize.FLOAT, defaultValue: 0 },
        eastwest_Loan: { type: Sequelize.FLOAT, defaultValue: 0 },
        multiPurposeSavings: { type: Sequelize.FLOAT, defaultValue: 0 },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
    }

    // User_Hardware
    if (!await tableExists('User_Hardware')) {
      await queryInterface.createTable('User_Hardware', {
        hardwareId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false, unique: true },
        user_MachipId: { type: Sequelize.STRING, allowNull: true, unique: true },
        user_FingerprintId: { type: Sequelize.INTEGER, allowNull: true, unique: true },
        user_FingerprintTemplate: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
    }

    // Position Table
    if (!await tableExists('Position')) {
      await queryInterface.createTable('Position', {
        positionId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        title: { type: Sequelize.STRING(100), allowNull: false },
        department: { type: Sequelize.STRING(100), allowNull: false },
        baseMonthlyPay: { type: Sequelize.DOUBLE, allowNull: false, defaultValue: 0 },
        baseDailyRate: { type: Sequelize.DOUBLE, allowNull: false, defaultValue: 0 },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // Notification Table
    if (!await tableExists('Notification')) {
      await queryInterface.createTable('Notification', {
        notifId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        title: { type: Sequelize.STRING, allowNull: false },
        message: { type: Sequelize.TEXT, allowNull: false },
        isRead: { type: Sequelize.BOOLEAN, defaultValue: false },
        targetId: { type: Sequelize.INTEGER, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // ── 2. Add New Columns to User Table ──────────────────────────────────────
    
    const userTable = await queryInterface.describeTable('User');
    const userColumns = [
      { name: 'civil_status', type: Sequelize.STRING(20), defaultValue: "Single" },
      { name: 'is_solo_parent', type: Sequelize.BOOLEAN, defaultValue: false },
      { name: 'user_ShiftId', type: Sequelize.SMALLINT, defaultValue: 1 },
      { name: 'taxStatus', type: Sequelize.STRING(5), defaultValue: "S" },
      { name: 'dailyRate', type: Sequelize.FLOAT, allowNull: true, defaultValue: 0 },
      { name: 'previousDailyRate', type: Sequelize.FLOAT, allowNull: true, defaultValue: 0 },
      { name: 'rateUpdatedAt', type: Sequelize.DATE, allowNull: true },
      { name: 'hasAvailedRetirementTax', type: Sequelize.BOOLEAN, defaultValue: false },
      { name: 'position_id', type: Sequelize.INTEGER, allowNull: true },
    ];

    for (const col of userColumns) {
      if (!userTable[col.name]) {
        await queryInterface.addColumn('User', col.name, { 
          type: col.type, 
          allowNull: col.allowNull ?? true, 
          defaultValue: col.defaultValue 
        });
      }
    }

    // ── 3. Create Payroll Extension Tables ─────────────────────────────────────
    
    // Payroll_maxicare
    if (!await tableExists('Payroll_maxicare')) {
      await queryInterface.createTable('Payroll_maxicare', {
        maxicare_Id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        max_Month: { type: Sequelize.DATEONLY, allowNull: false },
        amount: { type: Sequelize.FLOAT, defaultValue: 0 },
        maxi_status: { type: Sequelize.ENUM("paid", "estimated"), defaultValue: "estimated" },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addConstraint('Payroll_maxicare', {
        fields: ['user_Id', 'max_Month'], type: 'unique', name: 'user_month_unique'
      });
    }

    // Payroll_Cash_Advances
    if (!await tableExists('Payroll_Cash_Advances')) {
      await queryInterface.createTable('Payroll_Cash_Advances', {
        caId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        date: { type: Sequelize.DATEONLY, allowNull: false },
        amount: { type: Sequelize.FLOAT, defaultValue: 0 },
        payrollId: { type: Sequelize.INTEGER, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addConstraint('Payroll_Cash_Advances', {
        fields: ['user_Id', 'date'], type: 'unique', name: 'user_ca_date_unique'
      });
    }

    // Payroll_Eastwest
    if (!await tableExists('Payroll_Eastwest')) {
      await queryInterface.createTable('Payroll_Eastwest', {
        eastwestId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        date: { type: Sequelize.DATEONLY, allowNull: false },
        amount: { type: Sequelize.FLOAT, defaultValue: 0 },
        payrollId: { type: Sequelize.INTEGER, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addConstraint('Payroll_Eastwest', {
        fields: ['user_Id', 'date'], type: 'unique', name: 'user_ew_date_unique'
      });
    }

    // Payroll_GovernmentLoans
    if (!await tableExists('Payroll_GovernmentLoans')) {
      await queryInterface.createTable('Payroll_GovernmentLoans', {
        govern_Id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        government_type: { type: Sequelize.ENUM("SSS", "Pag-IBIG", "Calamity", "Multi-Purpose"), defaultValue: "SSS", allowNull: false },
        date: { type: Sequelize.DATEONLY, allowNull: false },
        amount: { type: Sequelize.FLOAT, defaultValue: 0 },
        payrollId: { type: Sequelize.INTEGER, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addConstraint('Payroll_GovernmentLoans', {
        fields: ['user_Id', 'government_type', 'date'], type: 'unique', name: 'user_gov_date_type_unique'
      });
    }

    // Payroll_ThirteenthMonth
    if (!await tableExists('Payroll_ThirteenthMonth')) {
      await queryInterface.createTable('Payroll_ThirteenthMonth', {
        thirteenthId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        year: { type: Sequelize.INTEGER, allowNull: false },
        totalBasicEarned: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        amount: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        taxable_Excess: { type: Sequelize.FLOAT, defaultValue: 0 },
        status: { type: Sequelize.ENUM("Draft", "Released"), defaultValue: "Draft" },
        releasedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addConstraint('Payroll_ThirteenthMonth', {
        fields: ['user_Id', 'year'], type: 'unique', name: 'user_thirteenth_year_unique'
      });
    }

    // Payroll_Separation
    if (!await tableExists('Payroll_Separation')) {
      await queryInterface.createTable('Payroll_Separation', {
        separationId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        hireDate: { type: Sequelize.DATEONLY, allowNull: false },
        separationDate: { type: Sequelize.DATEONLY, allowNull: false },
        yearsOfService: { type: Sequelize.FLOAT, allowNull: false },
        baseSalary: { type: Sequelize.FLOAT, allowNull: false },
        multiplier: { type: Sequelize.FLOAT, allowNull: false },
        totalAmount: { type: Sequelize.FLOAT, allowNull: false },
        reason: { type: Sequelize.STRING, allowNull: false },
        causeType: { type: Sequelize.ENUM("Retrenchment/Closure/Disease (1/2 Month)", "Redundancy/Installation of Devices (1 Month)"), allowNull: false },
        isTaxExempt: { type: Sequelize.BOOLEAN, defaultValue: true },
        status: { type: Sequelize.ENUM("Draft", "Released"), defaultValue: "Draft" },
        releasedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // Payroll_Retirement
    if (!await tableExists('Payroll_Retirement')) {
      await queryInterface.createTable('Payroll_Retirement', {
        retirementId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        hireDate: { type: Sequelize.DATEONLY, allowNull: false },
        retirementDate: { type: Sequelize.DATEONLY, allowNull: false },
        yearsOfService: { type: Sequelize.FLOAT, allowNull: false },
        dailyRate: { type: Sequelize.FLOAT, allowNull: false },
        totalAmount: { type: Sequelize.FLOAT, allowNull: false },
        component_salary_15days: { type: Sequelize.FLOAT, allowNull: false },
        component_sil_5days: { type: Sequelize.FLOAT, allowNull: false },
        component_13thmonth_2_5days: { type: Sequelize.FLOAT, allowNull: false },
        isTaxExempt: { type: Sequelize.BOOLEAN, defaultValue: false },
        status: { type: Sequelize.ENUM("Draft", "Released"), defaultValue: "Draft" },
        releasedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // ── 4. Create Loan Tracking Tables ────────────────────────────────────────
    
    // Loan_Deductions
    if (!await tableExists('Loan_Deductions')) {
      await queryInterface.createTable('Loan_Deductions', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.SMALLINT, allowNull: false },
        deductionType: { type: Sequelize.STRING(50), allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'active' },
        contractDate: { type: Sequelize.DATEONLY, allowNull: false },
        renewalDate: { type: Sequelize.DATEONLY, allowNull: true },
        monthsToPay: { type: Sequelize.INTEGER, allowNull: true },
        deductionPerCutoff: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        totalAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        totalDeducted: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0.00 },
        remainingBalance: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        lastDeductionDate: { type: Sequelize.DATEONLY, allowNull: true },
        provider: { type: Sequelize.STRING(150), allowNull: true },
        reference: { type: Sequelize.STRING(150), allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        createdBy: { type: Sequelize.SMALLINT, allowNull: true },
        updatedBy: { type: Sequelize.SMALLINT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // Loan_Deduction_History
    if (!await tableExists('Loan_Deduction_History')) {
      await queryInterface.createTable('Loan_Deduction_History', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        loanDeductionId: { type: Sequelize.INTEGER, allowNull: false },
        payrollId: { type: Sequelize.INTEGER, allowNull: true },
        deductionDate: { type: Sequelize.DATEONLY, allowNull: false },
        cutoffPeriod: { type: Sequelize.STRING(20), allowNull: true },
        amountDeducted: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        balanceAfter: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'processed' },
        notes: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // Loan_Deduction_Schedules
    if (!await tableExists('Loan_Deduction_Schedules')) {
      await queryInterface.createTable('Loan_Deduction_Schedules', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        loanDeductionId: { type: Sequelize.INTEGER, allowNull: false },
        userId: { type: Sequelize.SMALLINT, allowNull: false },
        cutoffDate: { type: Sequelize.DATEONLY, allowNull: false },
        scheduledAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        actualAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pending' },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex('Loan_Deduction_Schedules', ['loanDeductionId', 'cutoffDate'], {
        unique: true, name: 'unique_loan_cutoff'
      });
    }

    // ── 5. Update Payroll Tables ───────────────────────────────────────────────
    
    // Payroll Table
    const payrollTable = await queryInterface.describeTable('Payroll');
    if (!payrollTable.totalScheduledDays) {
      await queryInterface.addColumn('Payroll', 'totalScheduledDays', { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 });
    }
    if (!payrollTable.previousDailyRate) {
      await queryInterface.addColumn('Payroll', 'previousDailyRate', { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 });
    }

    // Payroll_Earnings Table (Check for missing columns)
    const earningsTable = await queryInterface.describeTable('Payroll_Earnings');
    const earningsCols = [
      { name: 'restDay_OT_Hrs', type: Sequelize.FLOAT, defaultValue: 0 },
      { name: 'restDay_OT_Amnt', type: Sequelize.FLOAT, defaultValue: 0 },
      { name: 'nightDiff_Hrs', type: Sequelize.FLOAT, defaultValue: 0 },
      { name: 'nightDiff_Amnt', type: Sequelize.FLOAT, defaultValue: 0 },
      { name: 'restDay_Amnt', type: Sequelize.FLOAT, defaultValue: 0 },
      { name: 'specialHol_Amnt', type: Sequelize.FLOAT, defaultValue: 0 },
      { name: 'legalHol_Amnt', type: Sequelize.FLOAT, defaultValue: 0 },
      { name: 'specialHol_Adj', type: Sequelize.FLOAT, defaultValue: 0 },
    ];
    for (const col of earningsCols) {
      if (!earningsTable[col.name]) {
        await queryInterface.addColumn('Payroll_Earnings', col.name, { type: col.type, defaultValue: col.defaultValue });
      }
    }

    // Payroll_Deductions Table (Check for missing columns)
    const deductionsTable = await queryInterface.describeTable('Payroll_Deductions');
    const deductionsCols = [
      { name: 'SSS_Ded_ER', type: Sequelize.FLOAT, defaultValue: 0 },
      { name: 'Philhealth_Ded_ER', type: Sequelize.FLOAT, defaultValue: 0 },
      { name: 'HDMF_Ded_ER', type: Sequelize.FLOAT, defaultValue: 0 },
      { name: 'multiPurposeSavings', type: Sequelize.FLOAT, defaultValue: 0 },
    ];
    for (const col of deductionsCols) {
      if (!deductionsTable[col.name]) {
        await queryInterface.addColumn('Payroll_Deductions', col.name, { type: col.type, defaultValue: col.defaultValue });
      }
    }

    // ── 6. Update SystemSettings Table ──────────────────────────────────────────
    const sysTable = await queryInterface.describeTable('SystemSettings');
    const sysColumns = [
      { name: 'morningShiftStart', type: Sequelize.TIME, defaultValue: "08:30:00" },
      { name: 'morningShiftEnd', type: Sequelize.TIME, defaultValue: "17:30:00" },
      { name: 'eveningShiftStart', type: Sequelize.TIME, defaultValue: "20:30:00" },
      { name: 'eveningShiftEnd', type: Sequelize.TIME, defaultValue: "05:30:00" },
      { name: 'ordinaryDayRate', type: Sequelize.DOUBLE, defaultValue: 1.0 },
      { name: 'specialDayRate', type: Sequelize.DOUBLE, defaultValue: 1.3 },
      { name: 'restDayRate', type: Sequelize.DOUBLE, defaultValue: 1.3 },
      { name: 'regularHolidayRate', type: Sequelize.DOUBLE, defaultValue: 2.0 },
      { name: 'nightDiffRate', type: Sequelize.DOUBLE, defaultValue: 1.1 },
      { name: 'overtimeRate', type: Sequelize.DOUBLE, defaultValue: 1.25 },
      { name: 'doubleRegularHolidayRate', type: Sequelize.DOUBLE, defaultValue: 3.0 },
      { name: 'specialDayRestDayRate', type: Sequelize.DOUBLE, defaultValue: 1.5 },
      { name: 'doubleSpecialDayRate', type: Sequelize.DOUBLE, defaultValue: 1.5 },
      { name: 'doubleSpecialDayRestDayRate', type: Sequelize.DOUBLE, defaultValue: 1.95 },
      { name: 'regularHolidayRestDayRate', type: Sequelize.DOUBLE, defaultValue: 2.6 },
      { name: 'doubleRegularHolidayRestDayRate', type: Sequelize.DOUBLE, defaultValue: 3.9 },
      { name: 'payrollRates', type: Sequelize.JSONB, allowNull: true },
      { name: 'mandatedMinimumWage', type: Sequelize.DOUBLE, defaultValue: 610.0 },
      { name: 'mandatedWageEffectiveDate', type: Sequelize.DATEONLY, defaultValue: '2025-07-18' },
      { name: 'storageRootPath', type: Sequelize.STRING, allowNull: true },
      { name: 'maxicareCycleStartDate', type: Sequelize.DATEONLY, allowNull: true },
      { name: 'maxicareDates', type: Sequelize.JSONB, allowNull: true },
    ];

    for (const col of sysColumns) {
      if (!sysTable[col.name]) {
        await queryInterface.addColumn('SystemSettings', col.name, { 
          type: col.type, 
          allowNull: col.allowNull ?? true, 
          defaultValue: col.defaultValue 
        });
      }
    }

    // ── 7. Update Request & Leave Tables ────────────────────────────────────────
    
    // emp_Request
    const reqTable = await queryInterface.describeTable('emp_Request');
    if (!reqTable.admin_remarks) {
      await queryInterface.addColumn('emp_Request', 'admin_remarks', { type: Sequelize.TEXT, allowNull: true });
    }
    if (!reqTable.system_remarks) {
      await queryInterface.addColumn('emp_Request', 'system_remarks', { type: Sequelize.TEXT, allowNull: true });
    }
    if (!reqTable.last_escalated_at) {
      await queryInterface.addColumn('emp_Request', 'last_escalated_at', { type: Sequelize.DATE, allowNull: true });
    }

    // Leave_Balance
    const lbTable = await queryInterface.describeTable('Leave_Balance');
    if (!lbTable.SoloParent_balance) {
      await queryInterface.addColumn('Leave_Balance', 'SoloParent_balance', { type: Sequelize.FLOAT, defaultValue: 0 });
    }
    if (!lbTable.SoloParent_used) {
      await queryInterface.addColumn('Leave_Balance', 'SoloParent_used', { type: Sequelize.FLOAT, defaultValue: 0 });
    }

    // Statutory_Leave
    if (!await tableExists('Statutory_Leave')) {
      await queryInterface.createTable('Statutory_Leave', {
        statL_Id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        emp_reqId: { type: Sequelize.INTEGER, allowNull: false },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        StartDate: { type: Sequelize.DATEONLY, allowNull: false },
        EndDate: { type: Sequelize.DATEONLY, allowNull: false },
        NoDays: { type: Sequelize.FLOAT, allowNull: false },
        proof_File: { type: Sequelize.STRING, allowNull: true },
        reason: { type: Sequelize.TEXT, allowNull: false },
        WithPayID: { type: Sequelize.SMALLINT, allowNull: false },
      });
    }

    // ── 8. Seed Essential Data ──────────────────────────────────────────────────
    await queryInterface.sequelize.query(`
      INSERT INTO "attendance_status" ("statusId", "statusName")
      VALUES (6, 'Exempt')
      ON CONFLICT ("statusId") DO NOTHING;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Teardown logic
    await queryInterface.dropTable('Statutory_Leave');
    await queryInterface.dropTable('Loan_Deduction_Schedules');
    await queryInterface.dropTable('Loan_Deduction_History');
    await queryInterface.dropTable('Loan_Deductions');
    await queryInterface.dropTable('Payroll_Retirement');
    await queryInterface.dropTable('Payroll_Separation');
    await queryInterface.dropTable('Payroll_ThirteenthMonth');
    await queryInterface.dropTable('Payroll_GovernmentLoans');
    await queryInterface.dropTable('Payroll_Eastwest');
    await queryInterface.dropTable('Payroll_Cash_Advances');
    await queryInterface.dropTable('Payroll_maxicare');
    await queryInterface.dropTable('Notification');
    await queryInterface.dropTable('Position');
    await queryInterface.dropTable('User_Hardware');
    await queryInterface.dropTable('User_Deduction_Profile');
    await queryInterface.dropTable('User_Banking');
  }
};
