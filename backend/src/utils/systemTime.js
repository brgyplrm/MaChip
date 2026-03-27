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
 * Uses local time because TZ=Asia/Manila is set in app.js.
 */
function formatForSQL(date) {
  const pad = (n) => n.toString().padStart(2, "0");
  const YYYY = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const DD = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
}

module.exports = { getSystemTime, formatForSQL };
