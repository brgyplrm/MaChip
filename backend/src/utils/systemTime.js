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

/**
 * Formats a Date object to 'YYYY-MM-DD' for PostgreSQL/comparisons.
 * Uses local time because TZ=Asia/Manila is set in app.js.
 */
function formatDateLocal(date) {
  const pad = (n) => n.toString().padStart(2, "0");
  const YYYY = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const DD = pad(date.getDate());
  return `${YYYY}-${MM}-${DD}`;
}

/**
 * Formats decimal hours (e.g., 8.5) into 'Xh Ym' (e.g., 8h 30m).
 */
function formatDuration(decimalHours) {
  const totalMinutes = Math.round(parseFloat(decimalHours || 0) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

module.exports = { getSystemTime, formatForSQL, formatDateLocal, formatDuration };
