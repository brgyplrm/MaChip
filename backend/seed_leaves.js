const { sequelize, User } = require("./src/config/sequelize");
const { QueryTypes } = require("sequelize");

async function seedLeaves() {
  const userId = 3; // Jim Tejeros
  const now = new Date().toISOString();

  try {
    const user = await User.findByPk(userId);
    if (!user) return console.error("User 3 not found!");

    console.log(`Seeding comprehensive requests for ${user.user_FirstName} ${user.user_LastName}...`);

    // Clean up existing seeded data for this user to avoid clutter
    await sequelize.query(`DELETE FROM "emp_Request" WHERE "user_Id" = :userId AND "remarks" LIKE 'Seeded %'`, { replacements: { userId } });

    // 1. Vacation Leave (Pending)
    const [req1] = await sequelize.query(
      `INSERT INTO "emp_Request" ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "createdAt", "updatedAt") 
       VALUES (:userId, 3, 1, :now, 'Seeded Vacation: Family Trip', :now, :now) RETURNING "emp_reqId"`,
      { replacements: { userId, now }, type: QueryTypes.INSERT }
    );
    await sequelize.query(
      `INSERT INTO "Vacation_Leave" ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "reason", "WithPayID")
       VALUES (:emp_reqId, :userId, '2026-06-01', '2026-06-05', 5, 'Family trip to Boracay', 1)`,
      { replacements: { emp_reqId: req1[0].emp_reqId, userId } }
    );

    // 2. Sick Leave (Pending - Needs File)
    const [req2] = await sequelize.query(
      `INSERT INTO "emp_Request" ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "createdAt", "updatedAt") 
       VALUES (:userId, 4, 1, :now, 'Seeded Sick Leave: High Fever', :now, :now) RETURNING "emp_reqId"`,
      { replacements: { userId, now }, type: QueryTypes.INSERT }
    );
    await sequelize.query(
      `INSERT INTO "Sick_Leave" ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "reason", "WithPayID", "proof_File")
       VALUES (:emp_reqId, :userId, '2026-05-22', '2026-05-22', 1, 'Severe flu and high fever', 1, 'medical_cert_sample.jpg')`,
      { replacements: { emp_reqId: req2[0].emp_reqId, userId } }
    );

    // 3. Log Correction (Returned - Needs clearer info)
    const [req3] = await sequelize.query(
      `INSERT INTO "emp_Request" ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "admin_remarks", "createdAt", "updatedAt") 
       VALUES (:userId, 5, 5, :now, 'Seeded Correction: Forgot to tap out', 'Please specify the exact time you left the office.', :now, :now) RETURNING "emp_reqId"`,
      { replacements: { userId, now }, type: QueryTypes.INSERT }
    );
    await sequelize.query(
      `INSERT INTO "LogCorrection_Request" ("emp_reqId", "user_Id", "logDate", "claimedIn", "claimedOut", "correctionCategory", "reason")
       VALUES (:emp_reqId, :userId, '2026-05-21', '08:30:00', '17:35:00', 'Forgot to Clock-out', 'The machine was busy and I was in a rush.')`,
      { replacements: { emp_reqId: req3[0].emp_reqId, userId } }
    );

    // 4. Onfield Work (Approved - with Attachment)
    const [req4] = await sequelize.query(
      `INSERT INTO "emp_Request" ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "createdAt", "updatedAt") 
       VALUES (:userId, 2, 2, :now, 'Seeded Onfield: Client Visit', :now, :now) RETURNING "emp_reqId"`,
      { replacements: { userId, now }, type: QueryTypes.INSERT }
    );
    await sequelize.query(
      `INSERT INTO "Onfield_Work" ("emp_reqId", "user_Id", "DateonField", "NoDays", "NoHrs", "destination", "reason", "proof_File")
       VALUES (:emp_reqId, :userId, '2026-05-19', 1, 8, 'Ayala Makati Office', 'Quarterly review with partner agency', 'client_meeting_photo.png')`,
      { replacements: { emp_reqId: req4[0].emp_reqId, userId } }
    );

    console.log("Successfully seeded comprehensive request scenarios!");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

seedLeaves();
