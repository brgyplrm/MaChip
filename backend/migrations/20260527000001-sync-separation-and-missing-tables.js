'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = async (tableName) => {
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    };

    // ── 1. CORE LOOKUP TABLES ────────────────────────────────────────────────
    
    const lookupTables = [
      { name: 'logged_status', pk: 'statusId' },
      { name: 'attendance_status', pk: 'statusId' },
      { name: 'request_Status', pk: 'reqStatId' },
      { name: 'request_Type', pk: 'reqTypeId' },
      { name: 'withPay', pk: 'withPayId' },
      { name: 'Payroll_status', pk: 'PaystatusId' }
    ];

    for (const table of lookupTables) {
      if (!await tableExists(table.name)) {
        await queryInterface.createTable(table.name, {
          [table.pk]: { type: Sequelize.SMALLINT, primaryKey: true },
          [table.name === 'request_Status' ? 'reqStatName' : table.name === 'request_Type' ? 'reqTypeName' : table.name === 'withPay' ? 'withPayName' : table.name === 'Payroll_status' ? 'PaystatusName' : 'statusName']: { type: Sequelize.STRING, allowNull: false }
        });
      }
    }

    // ── 2. CORE PAYROLL TABLES ───────────────────────────────────────────────
    
    if (!await tableExists('PayrollPeriod')) {
      await queryInterface.createTable('PayrollPeriod', {
        periodId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        startDate: { type: Sequelize.DATEONLY, allowNull: false },
        endDate: { type: Sequelize.DATEONLY, allowNull: false },
        label: { type: Sequelize.STRING },
        status: { type: Sequelize.STRING, defaultValue: "Draft" },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!await tableExists('Payroll')) {
      await queryInterface.createTable('Payroll', {
        payrollId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        periodId: { type: Sequelize.INTEGER, allowNull: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        period_Start: { type: Sequelize.DATEONLY, allowNull: false },
        period_End: { type: Sequelize.DATEONLY, allowNull: false },
        NoDays_Worked: { type: Sequelize.FLOAT, allowNull: false },
        NoHrs_Worked: { type: Sequelize.FLOAT, allowNull: false },
        totalScheduledDays: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        dailyRate: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        previousDailyRate: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        ratePerHr: { type: Sequelize.FLOAT, allowNull: false },
        basicPay: { type: Sequelize.FLOAT, allowNull: false },
        totalEarnings: { type: Sequelize.FLOAT, allowNull: false },
        totalDeductions: { type: Sequelize.FLOAT, allowNull: false },
        netPay: { type: Sequelize.FLOAT, allowNull: false },
        holidaysTotal: { type: Sequelize.SMALLINT, defaultValue: 0 },
        holidaysRegularWorked: { type: Sequelize.SMALLINT, defaultValue: 0 },
        holidaysSpecialWorked: { type: Sequelize.SMALLINT, defaultValue: 0 },
        status: { type: Sequelize.SMALLINT, defaultValue: 1 },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!await tableExists('Payroll_Earnings')) {
      await queryInterface.createTable('Payroll_Earnings', {
        earningId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        payrollId: { type: Sequelize.INTEGER, allowNull: false },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        OT_Hrs: { type: Sequelize.FLOAT, defaultValue: 0 },
        OT_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        nightOT_Hrs: { type: Sequelize.FLOAT, defaultValue: 0 },
        nightOT_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        restDay_OT_Hrs: { type: Sequelize.FLOAT, defaultValue: 0 },
        restDay_OT_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        leaveCredits: { type: Sequelize.FLOAT, defaultValue: 0 },
        nightDiff_Hrs: { type: Sequelize.FLOAT, defaultValue: 0 },
        nightDiff_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        restDay_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        specialHol_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        legalHol_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        specialHol_Adj: { type: Sequelize.FLOAT, defaultValue: 0 },
        incentives: { type: Sequelize.FLOAT, defaultValue: 0 },
        allowance: { type: Sequelize.FLOAT, defaultValue: 0 },
      });
    }

    if (!await tableExists('Payroll_Deductions')) {
      await queryInterface.createTable('Payroll_Deductions', {
        deductionId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        payrollId: { type: Sequelize.INTEGER, allowNull: false },
        absence_Hrs: { type: Sequelize.FLOAT, defaultValue: 0 },
        absence_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        tardiness_Mins: { type: Sequelize.FLOAT, defaultValue: 0 },
        tardiness_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        unpaidLeave_Days: { type: Sequelize.FLOAT, defaultValue: 0 },
        unpaidLeave_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        paidLeave_Days: { type: Sequelize.FLOAT, defaultValue: 0 },
        SSS_Ded: { type: Sequelize.FLOAT, defaultValue: 0 },
        Philhealth_Ded: { type: Sequelize.FLOAT, defaultValue: 0 },
        HDMF_Ded: { type: Sequelize.FLOAT, defaultValue: 0 },
        SSS_Ded_ER: { type: Sequelize.FLOAT, defaultValue: 0 },
        Philhealth_Ded_ER: { type: Sequelize.FLOAT, defaultValue: 0 },
        HDMF_Ded_ER: { type: Sequelize.FLOAT, defaultValue: 0 },
        Tax_Ded: { type: Sequelize.FLOAT, defaultValue: 0 },
        healthCard_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        SSS_Loan: { type: Sequelize.FLOAT, defaultValue: 0 },
        HDMF_Loan: { type: Sequelize.FLOAT, defaultValue: 0 },
        calamityLoan_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        multiPurposeSavings: { type: Sequelize.FLOAT, defaultValue: 0 },
        advances_Amnt: { type: Sequelize.FLOAT, defaultValue: 0 },
        globe_Deduction: { type: Sequelize.FLOAT, defaultValue: 0 },
        eastwest_Loan: { type: Sequelize.FLOAT, defaultValue: 0 },
      });
    }

    // ── 3. FEATURE TABLES ────────────────────────────────────────────────────
    
    if (!await tableExists('Separation_Cause')) {
      await queryInterface.createTable('Separation_Cause', {
        causeId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        causeName: { type: Sequelize.STRING(100), allowNull: false },
        multiplier: { type: Sequelize.DOUBLE, allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!await tableExists('Loan_Request')) {
      await queryInterface.createTable('Loan_Request', {
        loanReqId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        emp_reqId: { type: Sequelize.INTEGER, allowNull: false },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        agency: { type: Sequelize.STRING(50), allowNull: false },
        loanType: { type: Sequelize.STRING(50), allowNull: false },
        amountRequested: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        monthsToPay: { type: Sequelize.INTEGER, allowNull: true },
        isEnrollment: { type: Sequelize.BOOLEAN, defaultValue: false },
        proof_File: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // ── 4. SYSTEM & AUDIT TABLES ─────────────────────────────────────────────
    
    if (!await tableExists('Holiday')) {
      await queryInterface.createTable('Holiday', {
        holidayId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Sequelize.STRING, allowNull: false },
        date: { type: Sequelize.DATEONLY, allowNull: false },
        type: { type: Sequelize.STRING, allowNull: false },
      });
    }

    if (!await tableExists('DueDate')) {
      await queryInterface.createTable('DueDate', {
        dueDateId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Sequelize.STRING, allowNull: false },
        date: { type: Sequelize.DATEONLY, allowNull: false },
        details: { type: Sequelize.TEXT, allowNull: true },
      });
    }

    if (!await tableExists('Audit_Log')) {
      await queryInterface.createTable('Audit_Log', {
        auditId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT, allowNull: false },
        action: { type: Sequelize.STRING, allowNull: false },
        target_Table: { type: Sequelize.STRING },
        target_Id: { type: Sequelize.INTEGER },
        old_Value: { type: Sequelize.JSONB },
        new_Value: { type: Sequelize.JSONB },
        ip_Address: { type: Sequelize.STRING(45) },
        module: { type: Sequelize.STRING },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!await tableExists('Transaction_Log')) {
      await queryInterface.createTable('Transaction_Log', {
        transId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_Id: { type: Sequelize.SMALLINT },
        initiated_By: { type: Sequelize.SMALLINT },
        event_Type: { type: Sequelize.STRING, allowNull: false },
        description: { type: Sequelize.TEXT },
        metadata: { type: Sequelize.JSONB },
        ip_Address: { type: Sequelize.STRING(45) },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!await tableExists('System_State')) {
      await queryInterface.createTable('System_State', {
        stateId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        key: { type: Sequelize.STRING, unique: true, allowNull: false },
        value: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // ── 5. UPDATING EXISTING TABLES ──────────────────────────────────────────
    
    // User Table Columns
    if (await tableExists('User')) {
      const userTable = await queryInterface.describeTable('User');
      const userCols = [
        { name: 'hireDate', type: Sequelize.DATEONLY },
        { name: 'user_DOB', type: Sequelize.DATEONLY },
        { name: 'recommendedBy', type: Sequelize.SMALLINT },
        { name: 'department', type: Sequelize.STRING(100) },
        { name: 'position', type: Sequelize.STRING(100) },
        { name: 'user_Phone', type: Sequelize.STRING(20) },
        { name: 'user_Address', type: Sequelize.TEXT },
        { name: 'user_Gender', type: Sequelize.STRING(20) },
      ];
      for (const col of userCols) {
        if (!userTable[col.name]) {
          await queryInterface.addColumn('User', col.name, { type: col.type, allowNull: true });
        }
      }
    }

    // Payroll_Separation
    if (await tableExists('Payroll_Separation')) {
      const tableInfo = await queryInterface.describeTable('Payroll_Separation');
      if (!tableInfo.causeId) await queryInterface.addColumn('Payroll_Separation', 'causeId', { type: Sequelize.INTEGER, allowNull: true });
      if (!tableInfo.backPay_13thMonth) await queryInterface.addColumn('Payroll_Separation', 'backPay_13thMonth', { type: Sequelize.FLOAT, defaultValue: 0 });
      if (!tableInfo.backPay_LeaveConversion) await queryInterface.addColumn('Payroll_Separation', 'backPay_LeaveConversion', { type: Sequelize.FLOAT, defaultValue: 0 });
      if (!tableInfo.finalWorkedSalary) await queryInterface.addColumn('Payroll_Separation', 'finalWorkedSalary', { type: Sequelize.FLOAT, defaultValue: 0 });
      if (!tableInfo.backPay_Total) await queryInterface.addColumn('Payroll_Separation', 'backPay_Total', { type: Sequelize.FLOAT, defaultValue: 0 });
    }

    // Payroll_Retirement
    if (await tableExists('Payroll_Retirement')) {
      const tableInfo = await queryInterface.describeTable('Payroll_Retirement');
      if (!tableInfo.backPay_13thMonth) await queryInterface.addColumn('Payroll_Retirement', 'backPay_13thMonth', { type: Sequelize.FLOAT, defaultValue: 0 });
      if (!tableInfo.backPay_LeaveConversion) await queryInterface.addColumn('Payroll_Retirement', 'backPay_LeaveConversion', { type: Sequelize.FLOAT, defaultValue: 0 });
      if (!tableInfo.finalWorkedSalary) await queryInterface.addColumn('Payroll_Retirement', 'finalWorkedSalary', { type: Sequelize.FLOAT, defaultValue: 0 });
      if (!tableInfo.backPay_Total) await queryInterface.addColumn('Payroll_Retirement', 'backPay_Total', { type: Sequelize.FLOAT, defaultValue: 0 });
    }
  },

  down: async (queryInterface, Sequelize) => {
  }
};
