/**
 * Formats a time string (HH:mm:ss) to 12-hour format with AM/PM.
 * @param {string} timeStr - Time string in HH:mm:ss format
 * @returns {string} Formatted time string (e.g., 08:30 AM)
 */
export const formatTime12h = (timeStr) => {
  if (!timeStr || timeStr === "—" || timeStr === "null") return "—";
  
  try {
    const [hours, minutes] = timeStr.split(":");
    let h = parseInt(hours);
    const m = minutes;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12; // the hour '0' should be '12'
    return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
  } catch (err) {
    console.error("Error formatting time:", err);
    return timeStr;
  }
};

/**
 * Formats a Date object to YYYY-MM-DD string in local time.
 * Avoids timezone shifts common with toISOString().
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date string (YYYY-MM-DD)
 */
export const formatDateLocal = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  
  return `${year}-${month}-${day}`;
};

/**
 * Checks if two dates fall within the same payroll period.
 * Periods are defined as: 1-15 and 16-EOF.
 * @param {Date|string} d1 - First date
 * @param {Date|string} d2 - Second date
 * @returns {boolean} True if in same period, month, and year
 */
export const isInSamePeriod = (d1, d2) => {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  
  if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
  
  if (date1.getFullYear() !== date2.getFullYear()) return false;
  if (date1.getMonth() !== date2.getMonth()) return false;
  
  const isFirstPeriod = (d) => d.getDate() <= 15;
  return isFirstPeriod(date1) === isFirstPeriod(date2);
};


