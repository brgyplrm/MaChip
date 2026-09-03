'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = async (tableName) => {
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    };

    // 1. Ensure logged_status table has canonical status mappings
    if (await tableExists('logged_status')) {
      const loggedStatuses = [
        { statusId: 1, statusName: 'Morning IN' },
        { statusId: 2, statusName: 'Morning OUT' },
        { statusId: 3, statusName: 'Afternoon IN' },
        { statusId: 4, statusName: 'Afternoon OUT' },
        { statusId: 5, statusName: 'Overtime IN' },
        { statusId: 6, statusName: 'Overtime OUT' },
        { statusId: 7, statusName: 'System Generated' },
        { statusId: 8, statusName: 'Visitor Access: Opening' },
        { statusId: 9, statusName: 'Visitor Access: Door Closed' }
      ];

      for (const s of loggedStatuses) {
        await queryInterface.sequelize.query(`
          INSERT INTO "logged_status" ("statusId", "statusName")
          VALUES (${s.statusId}, '${s.statusName}')
          ON CONFLICT ("statusId") DO UPDATE
          SET "statusName" = EXCLUDED."statusName";
        `);
      }
    }

    // 2. Ensure attendance_status table has canonical lookups
    if (await tableExists('attendance_status')) {
      const attendanceStatuses = [
        { statusId: 1, statusName: 'Present' },
        { statusId: 2, statusName: 'Late' },
        { statusId: 3, statusName: 'Absent' },
        { statusId: 4, statusName: 'Half Day' },
        { statusId: 5, statusName: 'On Leave' },
        { statusId: 6, statusName: 'Exempt' },
        { statusId: 7, statusName: 'Incidental Visit' },
        { statusId: 8, statusName: 'Irregular' }
      ];

      for (const s of attendanceStatuses) {
        await queryInterface.sequelize.query(`
          INSERT INTO "attendance_status" ("statusId", "statusName")
          VALUES (${s.statusId}, '${s.statusName}')
          ON CONFLICT ("statusId") DO UPDATE
          SET "statusName" = EXCLUDED."statusName";
        `);
      }
    }

    // 3. Correct transposed punch statuses in user_logging
    if (await tableExists('user_logging')) {
      // Lunch exits (11:30 - 12:45): 3 -> 2 (Morning OUT)
      await queryInterface.sequelize.query(`
        UPDATE "user_logging" 
        SET "logged_StatusId" = 2 
        WHERE "time_Logged" BETWEEN '11:30:00' AND '12:45:00' AND "logged_StatusId" = 3;
      `);

      // Lunch returns (12:46 - 13:45): 4 -> 3 (Afternoon IN)
      await queryInterface.sequelize.query(`
        UPDATE "user_logging" 
        SET "logged_StatusId" = 3 
        WHERE "time_Logged" BETWEEN '12:46:00' AND '13:45:00' AND "logged_StatusId" = 4;
      `);

      // Regular afternoon exits (>= 16:00:00): 2 -> 4 (Afternoon OUT)
      await queryInterface.sequelize.query(`
        UPDATE "user_logging" 
        SET "logged_StatusId" = 4 
        WHERE "time_Logged" >= '16:00:00' AND "logged_StatusId" = 2;
      `);
    }

    // 4. Synchronize Overtime IN (5) and Overtime OUT (6) for approved Overtime Requests
    if (await tableExists('user_logging') && await tableExists('Overtime_Request') && await tableExists('emp_Request')) {
      const approvedOT = await queryInterface.sequelize.query(`
        SELECT er."user_Id", ot."OT_DateOf"::date as "dStr", ot."HrFrom", ot."HrTo"
        FROM "emp_Request" er
        JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
        WHERE er."emp_reqStatusId" = 2;
      `, { type: queryInterface.sequelize.QueryTypes.SELECT });

      for (const ot of approvedOT) {
        const hrTo = ot.HrTo && ot.HrTo.length === 5 ? `${ot.HrTo}:00` : ot.HrTo;
        const hrFrom = ot.HrFrom && ot.HrFrom.length === 5 ? `${ot.HrFrom}:00` : ot.HrFrom;

        if (hrTo) {
          await queryInterface.sequelize.query(`
            UPDATE "user_logging"
            SET "logged_StatusId" = 6
            WHERE "user_id" = :userId 
              AND "log_Date"::date = :dStr 
              AND "time_Logged" = :hrTo
              AND "logged_StatusId" = 4;
          `, { replacements: { userId: ot.user_Id, dStr: ot.dStr, hrTo } });
        }

        if (hrFrom) {
          const [existingOtIn] = await queryInterface.sequelize.query(`
            SELECT "user_loggingId" FROM "user_logging"
            WHERE "user_id" = :userId AND "log_Date"::date = :dStr AND "logged_StatusId" = 5;
          `, { replacements: { userId: ot.user_Id, dStr: ot.dStr } });

          if (!existingOtIn || existingOtIn.length === 0) {
            const [existingAOut] = await queryInterface.sequelize.query(`
              SELECT "user_loggingId" FROM "user_logging"
              WHERE "user_id" = :userId AND "log_Date"::date = :dStr AND "logged_StatusId" = 4;
            `, { replacements: { userId: ot.user_Id, dStr: ot.dStr } });

            if (!existingAOut || existingAOut.length === 0) {
              await queryInterface.sequelize.query(`
                INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
                VALUES (:userId, :dStr, :hrFrom, 4, 1);
              `, { replacements: { userId: ot.user_Id, dStr: ot.dStr, hrFrom } });
            }

            await queryInterface.sequelize.query(`
              INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
              VALUES (:userId, :dStr, :hrFrom, 5, 1);
            `, { replacements: { userId: ot.user_Id, dStr: ot.dStr, hrFrom } });
          }
        }
      }
    }

    // 5. Correct employee_Logging_report for live attendance
    if (await tableExists('employee_Logging_report')) {
      const reports = await queryInterface.sequelize.query(`
        SELECT "employee_Logging_reportId", "time_Logged_inArr", "time_Logged_outArr"
        FROM "employee_Logging_report"
        WHERE "time_Logged_outArr" LIKE '%13:00:00%' OR "time_Logged_outArr" LIKE '%13:%';
      `, { type: queryInterface.sequelize.QueryTypes.SELECT });

      for (const r of reports) {
        let inArr = [];
        let outArr = [];
        try { inArr = JSON.parse(r.time_Logged_inArr || '[]'); } catch (e) {}
        try { outArr = JSON.parse(r.time_Logged_outArr || '[]'); } catch (e) {}

        const misplaced = outArr.filter(t => t.startsWith('13:'));
        if (misplaced.length > 0) {
          outArr = outArr.filter(t => !t.startsWith('13:'));
          for (const m of misplaced) {
            if (!inArr.includes(m)) inArr.push(m);
          }
          inArr.sort();

          await queryInterface.sequelize.query(`
            UPDATE "employee_Logging_report"
            SET "time_Logged_inArr" = :inArr,
                "time_Logged_outArr" = :outArr,
                "logged_StatusId" = 1
            WHERE "employee_Logging_reportId" = :repId;
          `, { replacements: { inArr: JSON.stringify(inArr), outArr: JSON.stringify(outArr), repId: r.employee_Logging_reportId } });
        }
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Non-destructive: down migration preserves data integrity
  }
};
