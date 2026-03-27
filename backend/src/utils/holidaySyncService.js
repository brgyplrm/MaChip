const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const scrapeHolidays = require("./holidayScraper");

/**
 * Automatically synchronizes Philippine holidays for the current and next year.
 * No hardcoded holidays here—everything comes from the scraper source.
 * Uses Pure SQL Queries for all database operations.
 */
async function syncHolidaysService() {
  try {
    const currentYear = new Date().getFullYear();
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
        // Log the scraped data for verification
        const dateObj = new Date(h.date);
        const dayMonth = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
        console.log(`[Sync] ${h.name} - ${dayMonth} ${year} [${h.type}]`);

        // PURE SQL: Check if holiday exists for this date
        const existing = await sequelize.query(
          `SELECT "holidayId" FROM "Holiday" WHERE "date" = :date`,
          { 
            replacements: { date: h.date }, 
            type: QueryTypes.SELECT 
          }
        );

        if (existing.length > 0) {
          // PURE SQL: Update existing record (Sync name and type from website)
          await sequelize.query(
            `UPDATE "Holiday" 
             SET "name" = :name, "type" = :type 
             WHERE "date" = :date`,
            { 
              replacements: { name: h.name, type: h.type, date: h.date }, 
              type: QueryTypes.UPDATE 
            }
          );
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
