'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = async (tableName) => {
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    };

    // 1. Ensure SystemSettings table exists
    if (!await tableExists('SystemSettings')) {
      await queryInterface.createTable('SystemSettings', {
        settingId: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    // 2. Add missing columns to SystemSettings
    const sysTable = await queryInterface.describeTable('SystemSettings');
    const sysColumns = [
      { name: 'mockTimeEnabled', type: Sequelize.BOOLEAN, defaultValue: false },
      { name: 'mockTimeValue', type: Sequelize.DATE, allowNull: true },
      { name: 'maxicareTotalGross', type: Sequelize.FLOAT, defaultValue: 23410.67 },
      { name: 'maxicareMonthsToPay', type: Sequelize.INTEGER, defaultValue: 12 },
      { name: 'maxicareCycleStartDate', type: Sequelize.DATEONLY, allowNull: true },
      { name: 'maxicareDates', type: Sequelize.JSONB, allowNull: true },
      { name: 'vlRate', type: Sequelize.DOUBLE, defaultValue: 1.0 },
      { name: 'slRate', type: Sequelize.DOUBLE, defaultValue: 1.0 },
      { name: 'storageRootPath', type: Sequelize.STRING, allowNull: true },
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
    ];

    for (const col of sysColumns) {
      if (!sysTable[col.name]) {
        await queryInterface.addColumn('SystemSettings', col.name, {
          type: col.type,
          allowNull: col.allowNull ?? true,
          defaultValue: col.defaultValue,
        });
      }
    }

    // 3. Ensure at least one settings record exists
    const [settings] = await queryInterface.sequelize.query('SELECT "settingId" FROM "SystemSettings" LIMIT 1;');
    if (settings.length === 0) {
      await queryInterface.sequelize.query(`
        INSERT INTO "SystemSettings" (
          "mockTimeEnabled", "maxicareTotalGross", "maxicareMonthsToPay", "vlRate", "slRate",
          "morningShiftStart", "morningShiftEnd", "eveningShiftStart", "eveningShiftEnd",
          "ordinaryDayRate", "specialDayRate", "restDayRate", "regularHolidayRate",
          "nightDiffRate", "overtimeRate", "doubleRegularHolidayRate", "specialDayRestDayRate",
          "doubleSpecialDayRate", "doubleSpecialDayRestDayRate", "regularHolidayRestDayRate",
          "doubleRegularHolidayRestDayRate", "mandatedMinimumWage", "mandatedWageEffectiveDate",
          "createdAt", "updatedAt"
        ) VALUES (
          false, 23410.67, 12, 1.0, 1.0,
          '08:30:00', '17:30:00', '20:30:00', '05:30:00',
          1.0, 1.3, 1.3, 2.0,
          1.1, 1.25, 3.0, 1.5,
          1.5, 1.95, 2.6, 3.9, 610.0, '2025-07-18',
          NOW(), NOW()
        );
      `);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Usually we don't drop SystemSettings columns in down to prevent data loss.
  },
};
