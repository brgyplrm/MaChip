const { SystemSettings } = require("../config/sequelize.js");

/**
 * Returns the current system time (either real or mock).
 */
async function getSystemTime() {
  try {
    const settings = await SystemSettings.findOne();
    if (settings && settings.mockTimeEnabled && settings.mockTimeValue) {
      return new Date(settings.mockTimeValue);
    }
    return new Date();
  } catch (error) {
    console.error("Error fetching system time:", error);
    return new Date();
  }
}

/**
 * Formats a Date object to 'YYYY-MM-DD HH:mm:ss' for PostgreSQL.
 */
function formatForSQL(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { getSystemTime, formatForSQL };
