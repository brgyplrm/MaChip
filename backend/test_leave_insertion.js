const { sequelize } = require("./src/config/sequelize");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatForSQL } = require("./src/utils/systemTime");

async function testLeaveInsertion() {
  try {
    console.log("Starting Leave Request Insertion Test...");

    // 1. Get an active employee (non-admin)
    const employees = await sequelize.query(
      `SELECT "user_Id", "user_FirstName", "user_LastName" 
       FROM "User" 
       WHERE "deletedAt" IS NULL AND "user_RoleId" != 1 
       LIMIT 1`,
      { type: QueryTypes.SELECT }
    );

    if (employees.length === 0) {
      console.log("No non-admin employees found. Aborting.");
      return;
    }

    const employee = employees[0];
    console.log(`Testing with employee: ${employee.user_FirstName} ${employee.user_LastName} (ID: ${employee.user_Id})`);

    const now = await getSystemTime();
    const nowStr = formatForSQL(now);
    const todayStr = now.toISOString().split("T")[0];
    
    // Dates for testing (set to next week to avoid weekend issues or past period blocks)
    const nextWeekStart = new Date(now);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const startDate = nextWeekStart.toISOString().split("T")[0];
    
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 1);
    const endDate = nextWeekEnd.toISOString().split("T")[0];

    // --- TEST 1: VACATION LEAVE (Type 3) ---
    console.log("\nAttempting to insert Approved Vacation Leave...");
    const vlParent = await sequelize.query(
      `INSERT INTO "emp_Request"
        ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "createdAt", "updatedAt")
        VALUES
        (:userId, 3, 2, :date_Filed, 'Test VL Request (Approved)', :now, :now)
        RETURNING "emp_reqId"`,
      {
        replacements: {
          userId: employee.user_Id,
          date_Filed: todayStr,
          now: nowStr,
        },
        type: QueryTypes.INSERT,
      }
    );

    const vlReqId = vlParent[0][0].emp_reqId;
    await sequelize.query(
      `INSERT INTO "Vacation_Leave" 
        ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "WithPayID", "purpose") 
       VALUES 
        (:emp_reqId, :userId, :StartDate, :EndDate, 2, 1, 'Family Vacation')`,
      {
        replacements: {
          emp_reqId: vlReqId,
          userId: employee.user_Id,
          StartDate: startDate,
          EndDate: endDate,
        },
        type: QueryTypes.INSERT,
      }
    );
    console.log(`✅ Vacation Leave inserted successfully (ID: ${vlReqId})`);

    // --- TEST 2: SICK LEAVE (Type 4) ---
    console.log("\nAttempting to insert Approved Sick Leave...");
    const slParent = await sequelize.query(
      `INSERT INTO "emp_Request"
        ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "createdAt", "updatedAt")
        VALUES
        (:userId, 4, 2, :date_Filed, 'Test SL Request (Approved)', :now, :now)
        RETURNING "emp_reqId"`,
      {
        replacements: {
          userId: employee.user_Id,
          date_Filed: todayStr,
          now: nowStr,
        },
        type: QueryTypes.INSERT,
      }
    );

    const slReqId = slParent[0][0].emp_reqId;
    // For Sick Leave, use a different date range
    const slDate = new Date(nextWeekStart);
    slDate.setDate(slDate.getDate() + 5);
    const slStartDate = slDate.toISOString().split("T")[0];
    const slEndDate = slStartDate;

    await sequelize.query(
      `INSERT INTO "Sick_Leave" 
        ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "WithPayID") 
       VALUES 
        (:emp_reqId, :userId, :StartDate, :EndDate, 1, 1)`,
      {
        replacements: {
          emp_reqId: slReqId,
          userId: employee.user_Id,
          StartDate: slStartDate,
          EndDate: slEndDate,
        },
        type: QueryTypes.INSERT,
      }
    );
    console.log(`✅ Sick Leave inserted successfully (ID: ${slReqId})`);

    // Verify retrieval
    console.log("\nVerifying insertion via query...");
    const verify = await sequelize.query(
      `SELECT er."emp_reqId", er."emp_reqTypeId", vl."StartDate" as vl_start, sl."StartDate" as sl_start
       FROM "emp_Request" er
       LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
       LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
       WHERE er."emp_reqId" IN (:vlReqId, :slReqId)`,
      {
        replacements: { vlReqId, slReqId },
        type: QueryTypes.SELECT
      }
    );
    console.log("Verification results:", verify);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during leave insertion test:", error.message);
    if (error.parent) console.error("Database Error:", error.parent.message);
    process.exit(1);
  }
}

testLeaveInsertion();
