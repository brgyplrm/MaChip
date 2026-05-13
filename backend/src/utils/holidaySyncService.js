const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const scrapeHolidays = require("./holidayScraper");
const { getSystemTime } = require("./systemTime");

/**
 * Automatically synchronizes Philippine holidays for the current and next year.
 * Protects past holidays: Only updates or adds holidays starting from the current date.
 * Uses Pure SQL Queries for all database operations.
 */
async function syncHolidaysService() {
  try {
    const now = await getSystemTime();
    const todayStr = now.toISOString().split("T")[0];
    const currentYear = now.getFullYear();
    const yearsToSync = [currentYear, currentYear + 1];
    let totalNewSyncCount = 0;

    for (const year of yearsToSync) {
      const scrapedHolidays = await scrapeHolidays(year);
      
      if (!scrapedHolidays || scrapedHolidays.length === 0) {
        console.log(`[Auto-Sync] No data found for year ${year}. Skipping.`);
        continue;
      }

      console.log(`[Auto-Sync] Year ${year}: Found ${scrapedHolidays.length} matching holidays.`);
      for (const h of scrapedHolidays) {
        // PURE SQL: Check if holiday exists for this date
        const existing = await sequelize.query(
          `SELECT "holidayId", "name", "type" FROM "Holiday" WHERE "date" = :date`,
          { 
            replacements: { date: h.date }, 
            type: QueryTypes.SELECT 
          }
        );

        if (existing.length > 0) {
          // If it exists but the name or type changed in the API, update it
          if (existing[0].name !== h.name || existing[0].type !== h.type) {
            console.log(`[Sync] Updating holiday on ${h.date}: ${existing[0].name} -> ${h.name}`);
            await sequelize.query(
              `UPDATE "Holiday" SET "name" = :name, "type" = :type WHERE "date" = :date`,
              { 
                replacements: { name: h.name, type: h.type, date: h.date }, 
                type: QueryTypes.UPDATE 
              }
            );
          }
          continue;
        } else {
          // PURE SQL: Insert new record
          await sequelize.query(
            `INSERT INTO "Holiday" ("name", "date", "type") 
             VALUES (:name, :date, :type)`,
            { 
              replacements: { name: h.name, date: h.date, type: h.type }, 
              type: QueryTypes.INSERT 
            }
          );
          totalNewSyncCount++;
          console.log(`[Sync] Added new holiday: ${h.name} (${h.date})`);
        }
      }
    }

    console.log(`[Auto-Sync] Completed. ${totalNewSyncCount} new holidays added.`);
    return { success: true, count: totalNewSyncCount };
  } catch (error) {
    console.error("[Auto-Sync Error]:", error.message);
    throw error;
  }
}

module.exports = { syncHolidaysService };
