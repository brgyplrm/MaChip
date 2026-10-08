const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { sequelize, User, employee_Logging_report, user_logging } = require('../src/config/sequelize');
const { QueryTypes } = require('sequelize');
const { ensureAbsentsMarked, calculateAndStoreAttendanceUnits } = require('../src/utils/attendanceHelper');
const { computePeriodStats } = require('../src/controllers/payroll.controller');

test.describe('Leave Workflow & Attendance Synchronization Suite', () => {

  test('1. Database attendance_status table has canonical status definitions', async () => {
    const [statuses] = await sequelize.query(`SELECT "statusId", "statusName" FROM "attendance_status" ORDER BY "statusId" ASC`);
    const statusMap = Object.fromEntries(statuses.map(s => [s.statusId, s.statusName]));
    
    assert.strictEqual(statusMap[1], 'On Time', 'Status 1 must be On Time');
    assert.strictEqual(statusMap[2], 'Late', 'Status 2 must be Late');
    assert.strictEqual(statusMap[3], 'Absent', 'Status 3 must be Absent');
    assert.strictEqual(statusMap[4], 'Half Day', 'Status 4 must be Half Day');
    assert.strictEqual(statusMap[5], 'On Leave', 'Status 5 must be On Leave');
  });

  test('2. ensureAbsentsMarked repairs pre-existing Absent (3) to On Leave (5) when approved leave exists', async () => {
    const testUserId = 1003; // Testing Employee
    const testDate = '2026-10-07';

    // Cleanup any existing logs for this test date
    await sequelize.query(`DELETE FROM "employee_Logging_report" WHERE "user_id" = :userId AND "log_Date" = :testDate`, { replacements: { userId: testUserId, testDate } });
    await sequelize.query(`DELETE FROM "user_logging" WHERE "user_id" = :userId AND "log_Date" = :testDate`, { replacements: { userId: testUserId, testDate } });

    // Step A: Simulate 5:30 PM unapproved run marking user as Absent (3)
    await employee_Logging_report.create({
      user_id: testUserId,
      log_Date: testDate,
      time_Logged_inArr: '[]',
      time_Logged_outArr: '[]',
      attendance_StatusId: 3, // Absent
      logged_StatusId: 2
    });

    await user_logging.create({
      user_id: testUserId,
      log_Date: testDate,
      time_Logged: '17:30:00',
      logged_StatusId: 7,
      attendance_StatusId: 3
    });

    // Verify initial Absent state
    const [initialReport] = await sequelize.query(
      `SELECT "attendance_StatusId" FROM "employee_Logging_report" WHERE "user_id" = :userId AND "log_Date" = :testDate`,
      { replacements: { userId: testUserId, testDate }, type: QueryTypes.SELECT }
    );
    assert.strictEqual(Number(initialReport.attendance_StatusId), 3, 'Initial state must be Absent (3)');

    // Step B: Create an approved Vacation Leave (type 3) for this date
    const [reqResult] = await sequelize.query(`
      INSERT INTO "emp_Request" ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "date_Processed", "remarks", "createdAt", "updatedAt")
      VALUES (:userId, 3, 2, :testDate, :testDate, 'Test Vacation Leave', NOW(), NOW())
      RETURNING "emp_reqId"
    `, { replacements: { userId: testUserId, testDate }, type: QueryTypes.INSERT });
    const empReqId = reqResult[0].emp_reqId;

    await sequelize.query(`
      INSERT INTO "Vacation_Leave" ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "reason", "WithPayID")
      VALUES (:empReqId, :userId, :testDate, :testDate, 1.0, 'Family event', 1)
    `, { replacements: { empReqId, userId: testUserId, testDate } });

    // Step C: Run ensureAbsentsMarked for testDate (simulating backfill run)
    await ensureAbsentsMarked(testDate);

    // Step D: Verify that the report was auto-repaired to status 5 (On Leave)
    const [repairedReport] = await sequelize.query(
      `SELECT "attendance_StatusId" FROM "employee_Logging_report" WHERE "user_id" = :userId AND "log_Date" = :testDate`,
      { replacements: { userId: testUserId, testDate }, type: QueryTypes.SELECT }
    );
    assert.strictEqual(Number(repairedReport.attendance_StatusId), 5, 'Report must be upgraded to On Leave (5)');

    const userLogs = await sequelize.query(
      `SELECT "attendance_StatusId" FROM "user_logging" WHERE "user_id" = :userId AND "log_Date"::date = :testDate::date AND "logged_StatusId" = 7`,
      { replacements: { userId: testUserId, testDate }, type: QueryTypes.SELECT }
    );
    assert.ok(userLogs.length > 0, 'User log must exist');
    assert.strictEqual(Number(userLogs[0].attendance_StatusId), 5, 'User log must be upgraded to On Leave (5)');

    // Cleanup test request and logs
    await sequelize.query(`DELETE FROM "Vacation_Leave" WHERE "emp_reqId" = :empReqId`, { replacements: { empReqId } });
    await sequelize.query(`DELETE FROM "emp_Request" WHERE "emp_reqId" = :empReqId`, { replacements: { empReqId } });
    await sequelize.query(`DELETE FROM "employee_Logging_report" WHERE "user_id" = :userId AND "log_Date" = :testDate`, { replacements: { userId: testUserId, testDate } });
    await sequelize.query(`DELETE FROM "user_logging" WHERE "user_id" = :userId AND "log_Date"::date = :testDate::date`, { replacements: { userId: testUserId, testDate } });
  });

  test('3. Payroll engine computes full 8.0 payable units for approved paid leave with no scans', async () => {
    const testUserId = 1003;
    const testDate = '2026-10-06'; // Tuesday

    // Insert approved Sick Leave (With Pay)
    const [reqResult] = await sequelize.query(`
      INSERT INTO "emp_Request" ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "date_Processed", "remarks", "createdAt", "updatedAt")
      VALUES (:userId, 4, 2, :testDate, :testDate, 'Medical Leave', NOW(), NOW())
      RETURNING "emp_reqId"
    `, { replacements: { userId: testUserId, testDate }, type: QueryTypes.INSERT });
    const empReqId = reqResult[0].emp_reqId;

    await sequelize.query(`
      INSERT INTO "Sick_Leave" ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "reason", "WithPayID")
      VALUES (:empReqId, :userId, :testDate, :testDate, 1.0, 'Doctor rest', 1)
    `, { replacements: { empReqId, userId: testUserId, testDate } });

    // Insert attendance report with status 5 (On Leave) and empty punch arrays
    await sequelize.query(`
      INSERT INTO "employee_Logging_report" ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
      VALUES (:userId, :testDate, '[]', '[]', 5, 2)
      ON CONFLICT ("user_id", "log_Date") DO UPDATE SET "attendance_StatusId" = 5, "time_Logged_inArr" = '[]', "time_Logged_outArr" = '[]'
    `, { replacements: { userId: testUserId, testDate } });

    // Run payroll stats calculation for 2026-10-01 to 2026-10-15
    const stats = await computePeriodStats(testUserId, '2026-10-01', '2026-10-15');

    // Verify paid leave day and payable hours
    assert.ok(stats.paidLeave_Days >= 1.0, `paidLeave_Days should be at least 1.0, got ${stats.paidLeave_Days}`);
    assert.ok(stats.Total_Payable_Units >= 8.0, `Total_Payable_Units should include at least 8.0 hours for paid leave, got ${stats.Total_Payable_Units}`);

    // Cleanup
    await sequelize.query(`DELETE FROM "Sick_Leave" WHERE "emp_reqId" = :empReqId`, { replacements: { empReqId } });
    await sequelize.query(`DELETE FROM "emp_Request" WHERE "emp_reqId" = :empReqId`, { replacements: { empReqId } });
    await sequelize.query(`DELETE FROM "employee_Logging_report" WHERE "user_id" = :userId AND "log_Date" = :testDate`, { replacements: { userId: testUserId, testDate } });
  });

  test('4. Child deletion in DeleteRequest handles LogCorrection_Request and Statutory_Leave cleanly', async () => {
    const testUserId = 1003;

    // Test LogCorrection deletion
    const [lcReq] = await sequelize.query(`
      INSERT INTO "emp_Request" ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "createdAt", "updatedAt")
      VALUES (:userId, 5, 1, '2026-10-05', 'Log Correction Test', NOW(), NOW())
      RETURNING "emp_reqId"
    `, { replacements: { userId: testUserId }, type: QueryTypes.INSERT });
    const lcId = lcReq[0].emp_reqId;

    await sequelize.query(`
      INSERT INTO "LogCorrection_Request" ("emp_reqId", "user_Id", "logDate", "claimedIn", "claimedOut", "correctionCategory", "reason")
      VALUES (:lcId, :userId, '2026-10-05', '08:30:00', '17:30:00', 'Forgot to tap', 'Traffic')
    `, { replacements: { lcId, userId: testUserId } });

    // Simulate DeleteRequest transaction for type 5
    await sequelize.transaction(async (t) => {
      await sequelize.query(`DELETE FROM "LogCorrection_Request" WHERE "emp_reqId" = :requestId`, { replacements: { requestId: lcId }, transaction: t });
      await sequelize.query(`DELETE FROM "emp_Request" WHERE "emp_reqId" = :requestId`, { replacements: { requestId: lcId }, transaction: t });
    });

    const [lcCheck] = await sequelize.query(`SELECT * FROM "emp_Request" WHERE "emp_reqId" = :requestId`, { replacements: { requestId: lcId } });
    assert.strictEqual(lcCheck.length, 0, 'LogCorrection emp_Request must be deleted cleanly');

    // Test Statutory_Leave deletion
    const [statReq] = await sequelize.query(`
      INSERT INTO "emp_Request" ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "createdAt", "updatedAt")
      VALUES (:userId, 8, 1, '2026-10-05', 'Statutory Leave Test', NOW(), NOW())
      RETURNING "emp_reqId"
    `, { replacements: { userId: testUserId }, type: QueryTypes.INSERT });
    const statId = statReq[0].emp_reqId;

    await sequelize.query(`
      INSERT INTO "Statutory_Leave" ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "reason", "WithPayID")
      VALUES (:statId, :userId, '2026-10-05', '2026-10-06', 2.0, 'Paternity leave', 1)
    `, { replacements: { statId, userId: testUserId } });

    // Simulate DeleteRequest transaction for type 8
    await sequelize.transaction(async (t) => {
      await sequelize.query(`DELETE FROM "Statutory_Leave" WHERE "emp_reqId" = :requestId`, { replacements: { requestId: statId }, transaction: t });
      await sequelize.query(`DELETE FROM "emp_Request" WHERE "emp_reqId" = :requestId`, { replacements: { requestId: statId }, transaction: t });
    });

    const [statCheck] = await sequelize.query(`SELECT * FROM "emp_Request" WHERE "emp_reqId" = :requestId`, { replacements: { requestId: statId } });
    assert.strictEqual(statCheck.length, 0, 'Statutory emp_Request must be deleted cleanly');
  });

  test('5. UpdateStatusRequest converts Absent to On Leave upon approval', async () => {
    const { UpdateStatusRequest } = require('../src/controllers/userRequest.controlller');
    const testUserId = 1003; // Testing Employee
    const supervisorId = 1005; // Testing Supervisor
    const testDate = '2026-10-08';

    // Cleanup existing logs
    await sequelize.query(`DELETE FROM "employee_Logging_report" WHERE "user_id" = :userId AND "log_Date" = :testDate`, { replacements: { userId: testUserId, testDate } });
    await sequelize.query(`DELETE FROM "user_logging" WHERE "user_id" = :userId AND "log_Date"::date = :testDate::date`, { replacements: { userId: testUserId, testDate } });

    // Step A: Mark user as Absent (status 3)
    await employee_Logging_report.create({
      user_id: testUserId,
      log_Date: testDate,
      time_Logged_inArr: '[]',
      time_Logged_outArr: '[]',
      attendance_StatusId: 3,
      logged_StatusId: 2
    });

    await user_logging.create({
      user_id: testUserId,
      log_Date: testDate,
      time_Logged: '17:30:00',
      logged_StatusId: 7,
      attendance_StatusId: 3
    });

    // Step B: Insert pending Emergency Leave (type 6)
    const [reqResult] = await sequelize.query(`
      INSERT INTO "emp_Request" ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "createdAt", "updatedAt")
      VALUES (:userId, 6, 1, :testDate, 'Emergency Family Matter', NOW(), NOW())
      RETURNING "emp_reqId"
    `, { replacements: { userId: testUserId, testDate }, type: QueryTypes.INSERT });
    const empReqId = reqResult[0].emp_reqId;

    await sequelize.query(`
      INSERT INTO "Emergency_Leave" ("emp_reqId", "user_Id", "DateOfLeave", "NoDays", "reason", "WithPayID")
      VALUES (:empReqId, :userId, :testDate, 1.0, 'Family emergency', 1)
    `, { replacements: { empReqId, userId: testUserId, testDate } });

    // Step C: Call UpdateStatusRequest to approve
    const req = {
      body: {
        emp_reqId: empReqId,
        emp_reqStatusId: 2, // Approved
        processedBy: supervisorId,
        remarks: 'Approved by supervisor'
      },
      user: {
        user_Id: supervisorId,
        user_RoleId: 2
      }
    };
    let responseStatus = 200;
    let responseBody = {};
    const res = {
      status: (code) => { responseStatus = code; return res; },
      json: (data) => { responseBody = data; return res; }
    };

    await UpdateStatusRequest(req, res);
    assert.strictEqual(responseStatus, 200, 'UpdateStatusRequest should respond with HTTP 200');

    // Step D: Verify employee_Logging_report is updated to status 5
    const [report] = await sequelize.query(
      `SELECT "attendance_StatusId" FROM "employee_Logging_report" WHERE "user_id" = :userId AND "log_Date" = :testDate`,
      { replacements: { userId: testUserId, testDate }, type: QueryTypes.SELECT }
    );
    assert.strictEqual(Number(report.attendance_StatusId), 5, 'Attendance report must be converted to On Leave (5)');

    // Step E: Verify user_logging is updated to status 5
    const [userLog] = await sequelize.query(
      `SELECT "attendance_StatusId" FROM "user_logging" WHERE "user_id" = :userId AND "log_Date"::date = :testDate::date AND "logged_StatusId" = 7`,
      { replacements: { userId: testUserId, testDate }, type: QueryTypes.SELECT }
    );
    assert.strictEqual(Number(userLog.attendance_StatusId), 5, 'User log must be converted to On Leave (5)');

    // Cleanup
    await sequelize.query(`DELETE FROM "Emergency_Leave" WHERE "emp_reqId" = :empReqId`, { replacements: { empReqId } });
    await sequelize.query(`DELETE FROM "emp_Request" WHERE "emp_reqId" = :empReqId`, { replacements: { empReqId } });
    await sequelize.query(`DELETE FROM "employee_Logging_report" WHERE "user_id" = :userId AND "log_Date" = :testDate`, { replacements: { userId: testUserId, testDate } });
    await sequelize.query(`DELETE FROM "user_logging" WHERE "user_id" = :userId AND "log_Date"::date = :testDate::date`, { replacements: { userId: testUserId, testDate } });
  });

});
