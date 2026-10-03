/**
 * paydayResolver.js
 * Resolves effective payroll disbursement dates, weekend adjustments (e.g., Sunday to Friday),
 * and calculates the preceding audit & manual verification day.
 */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Formats a Date object to YYYY-MM-DD
 */
function toDateStr(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats YYYY-MM-DD or Date to readable e.g., "Oct 15, 2026"
 */
function formatReadable(d) {
  const dt = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Checks if a date falls on a weekend
 */
function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Moves backward to find the preceding business day (skipping weekends and optional holidays)
 */
function getPrecedingBusinessDay(d, holidays = []) {
  const cur = new Date(d);
  cur.setDate(cur.getDate() - 1);
  while (cur.getDay() === 0 || cur.getDay() === 6 || holidays.includes(toDateStr(cur))) {
    cur.setDate(cur.getDate() - 1);
  }
  return cur;
}

/**
 * Resolves the effective payday and audit day for a given payroll cutoff end date.
 * 
 * @param {string} targetDateStr - Cutoff end date (e.g., "2026-10-15" or "2026-10-31")
 * @param {string} rule - 'PRECEDING_FRIDAY' | 'NEXT_MONDAY' | 'EXACT_DATE'
 * @param {Array<string>} holidays - List of YYYY-MM-DD holiday strings
 * @returns {object} Full resolution details
 */
function resolvePaydaySchedule(targetDateStr, rule = "PRECEDING_FRIDAY", holidays = []) {
  const baseDate = new Date(targetDateStr + "T00:00:00");
  const originalDayNum = baseDate.getDay();
  const originalDayName = DAY_NAMES[originalDayNum];
  const origStr = toDateStr(baseDate);

  let effectiveDate = new Date(baseDate);

  if (rule === "PRECEDING_FRIDAY") {
    // If Sunday (0), move back 2 days to Friday (5). If Saturday (6), move back 1 day to Friday (5).
    if (originalDayNum === 0) {
      effectiveDate.setDate(effectiveDate.getDate() - 2);
    } else if (originalDayNum === 6) {
      effectiveDate.setDate(effectiveDate.getDate() - 1);
    }

    // If the resulting Friday is a holiday, step back to preceding business day
    while (holidays.includes(toDateStr(effectiveDate)) || isWeekend(effectiveDate)) {
      effectiveDate.setDate(effectiveDate.getDate() - 1);
    }
  } else if (rule === "NEXT_MONDAY") {
    // If Saturday (6), move forward 2 days to Monday (1). If Sunday (0), move forward 1 day to Monday (1).
    if (originalDayNum === 6) {
      effectiveDate.setDate(effectiveDate.getDate() + 2);
    } else if (originalDayNum === 0) {
      effectiveDate.setDate(effectiveDate.getDate() + 1);
    }

    while (holidays.includes(toDateStr(effectiveDate)) || isWeekend(effectiveDate)) {
      effectiveDate.setDate(effectiveDate.getDate() + 1);
    }
  }

  const effStr = toDateStr(effectiveDate);
  const isAdjusted = effStr !== origStr;
  const effectiveDayName = DAY_NAMES[effectiveDate.getDay()];

  // Audit / Manual Checking Day is 1 business day before the effective payday
  const checkingDateObj = getPrecedingBusinessDay(effectiveDate, holidays);
  const checkingDateStr = toDateStr(checkingDateObj);
  const checkingDayName = DAY_NAMES[checkingDateObj.getDay()];

  // Notice text without emojis
  let adjustmentNotice = null;
  if (isAdjusted) {
    adjustmentNotice = `Payday shifted from ${originalDayName} (${formatReadable(baseDate)}) to ${effectiveDayName} (${formatReadable(effectiveDate)}) per bank clearing schedule.`;
  }

  return {
    cutoffDate: origStr,
    cutoffDayName: originalDayName,
    effectivePayday: effStr,
    effectiveDayName,
    isAdjusted,
    adjustmentNotice,
    checkingDate: checkingDateStr,
    checkingDayName,
    readablePayday: formatReadable(effectiveDate),
    readableCheckingDate: formatReadable(checkingDateObj),
    readableCutoff: formatReadable(baseDate)
  };
}

module.exports = {
  resolvePaydaySchedule,
  getPrecedingBusinessDay,
  isWeekend,
  toDateStr,
  formatReadable
};
