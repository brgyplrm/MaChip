const { 
  sequelize, 
  user_logging, 
  employee_Logging_report,
  User
} = require("./src/config/sequelize");

async function seedAttendanceExtreme() {
  try {
    console.log("Starting Extreme Attendance Seeding (April 16-30)...");

    const users = await User.findAll({ where: { deletedAt: null } });
    if (users.length === 0) {
      console.error("No users found. Run db_reset.js first.");
      process.exit(1);
    }

    console.log("Cleaning previous logs...");
    await sequelize.query(`TRUNCATE TABLE "user_logging" RESTART IDENTITY CASCADE`);
    await sequelize.query(`TRUNCATE TABLE "employee_Logging_report" RESTART IDENTITY CASCADE`);

    const startDate = 16;
    const endDate = 30;

    for (const user of users) {
      console.log(`Generating logs for ${user.user_FirstName}...`);
      
      const isOwner = user.user_Id === 1;

      for (let day = startDate; day <= endDate; day++) {
        const dateStr = `2026-04-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(dateStr);
        if (dateObj.getDay() === 0) continue; // Skip Sundays

        let logs = [];
        let inArr = [];
        let outArr = [];
        let status = 1; // On-time

        if (isOwner) {
          // Scenario: PERFECT RECORD for Owner (MACJ-001)
          logs = [
            { time: "08:00:00", statusId: 1 },
            { time: "12:00:00", statusId: 3 },
            { time: "13:00:00", statusId: 4 },
            { time: "17:30:00", statusId: 2 }
          ];
          inArr = ["08:00:00", "13:00:00"]; 
          outArr = ["12:00:00", "17:30:00"];
          status = 1; // On-Time
        } else {
          // RANDOMIZED SCENARIOS FOR OTHER EMPLOYEES
          const rand = Math.random();

          if (rand < 0.05) {
            // 5% chance: ABSENT
            console.log(` -> User ${user.user_Id} ABSENT on ${dateStr}`);
            await employee_Logging_report.create({
              user_id: user.user_Id, log_Date: dateStr,
              time_Logged_inArr: "[]", time_Logged_outArr: "[]",
              attendance_StatusId: 3, logged_StatusId: 2
            });
            continue;
          } else if (rand < 0.10) {
            // 5% chance: HALF DAY
            console.log(` -> User ${user.user_Id} HALF DAY on ${dateStr}`);
            logs = [{ time: "08:00:00", statusId: 1 }, { time: "12:00:00", statusId: 2 }];
            inArr = ["08:00:00"]; outArr = ["12:00:00"];
            status = 1;
          } else if (rand < 0.20) {
            // 10% chance: LATE
            const lateMinutes = Math.floor(Math.random() * 59) + 1; // 1 to 59 mins late
            const lateTime = `08:${String(lateMinutes).padStart(2, '0')}:00`;
            console.log(` -> User ${user.user_Id} LATE (${lateTime}) on ${dateStr}`);
            logs = [
              { time: lateTime, statusId: 1 },
              { time: "12:00:00", statusId: 3 },
              { time: "13:00:00", statusId: 4 },
              { time: "17:30:00", statusId: 2 }
            ];
            inArr = [lateTime, "13:00:00"]; outArr = ["12:00:00", "17:30:00"];
            status = 2; // Late
          } else if (rand < 0.30) {
            // 10% chance: SUSPICIOUS LATE CLOCK OUT (OT)
            const otMinutesTotal = Math.floor(Math.random() * 120) + 30; // 30 to 150 mins OT
            const baseMinutes = 30 + otMinutesTotal; // 30 is the 17:30 base
            const otHour = 17 + Math.floor(baseMinutes / 60);
            const otMin = baseMinutes % 60;
            const otTime = `${String(otHour).padStart(2, '0')}:${String(otMin).padStart(2, '0')}:00`;
            console.log(` -> User ${user.user_Id} SUSPICIOUS OT (${otTime}) on ${dateStr}`);
            logs = [
              { time: "08:00:00", statusId: 1 },
              { time: "12:00:00", statusId: 3 },
              { time: "13:00:00", statusId: 4 },
              { time: "17:30:00", statusId: 2 },
              { time: "17:40:00", statusId: 5 }, // OT-In
              { time: otTime, statusId: 6 }      // OT-Out
            ];
            inArr = ["08:00:00", "13:00:00", "17:40:00"];
            outArr = ["12:00:00", "17:30:00", otTime];
            status = 1;
          } else {
            // DEFAULT STANDARD DAY
            logs = [
              { time: "08:00:00", statusId: 1 },
              { time: "12:00:00", statusId: 3 },
              { time: "13:00:00", statusId: 4 },
              { time: "17:30:00", statusId: 2 }
            ];
            inArr = ["08:00:00", "13:00:00"]; outArr = ["12:00:00", "17:30:00"];
            status = 1;
          }
        }

        for (const l of logs) {
          await user_logging.create({
            user_id: user.user_Id,
            log_Date: dateStr,
            time_Logged: l.time,
            logged_StatusId: l.statusId,
            attendance_StatusId: status
          });
        }

        await employee_Logging_report.create({
          user_id: user.user_Id,
          log_Date: dateStr,
          time_Logged_inArr: JSON.stringify(inArr),
          time_Logged_outArr: JSON.stringify(outArr),
          attendance_StatusId: status,
          logged_StatusId: 2
        });
      }
    }

    console.log("Extreme seeding completed with randomized scenarios.");
    console.log("Owner (User ID: 1) has been seeded with a PERFECT record.");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

seedAttendanceExtreme();
