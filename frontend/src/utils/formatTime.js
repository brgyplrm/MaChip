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
