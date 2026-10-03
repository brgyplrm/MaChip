/**
 * paydayHelper.js
 * Frontend helper to resolve effective paydays, weekend adjustments (Saturday/Sunday -> Friday),
 * and manual checking/audit dates.
 */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function toDateStr(d) {
  const dt = typeof d === "string" ? new Date(d) : d;
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatReadable(d) {
  const dt = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function resolvePaydaySchedule(targetDateStr, rule = "PRECEDING_FRIDAY", holidays = []) {
  if (!targetDateStr) return null;
  const baseDate = new Date(targetDateStr + "T00:00:00");
  const originalDayNum = baseDate.getDay();
  const originalDayName = DAY_NAMES[originalDayNum];

  let effectiveDate = new Date(baseDate);

  if (rule === "PRECEDING_FRIDAY") {
    if (originalDayNum === 0) { // Sunday -> Friday (-2)
      effectiveDate.setDate(effectiveDate.getDate() - 2);
    } else if (originalDayNum === 6) { // Saturday -> Friday (-1)
      effectiveDate.setDate(effectiveDate.getDate() - 1);
    }

    while (holidays.includes(toDateStr(effectiveDate)) || effectiveDate.getDay() === 0 || effectiveDate.getDay() === 6) {
      effectiveDate.setDate(effectiveDate.getDate() - 1);
    }
  } else if (rule === "NEXT_MONDAY") {
    if (originalDayNum === 6) { // Saturday -> Monday (+2)
      effectiveDate.setDate(effectiveDate.getDate() + 2);
    } else if (originalDayNum === 0) { // Sunday -> Monday (+1)
      effectiveDate.setDate(effectiveDate.getDate() + 1);
    }

    while (holidays.includes(toDateStr(effectiveDate)) || effectiveDate.getDay() === 0 || effectiveDate.getDay() === 6) {
      effectiveDate.setDate(effectiveDate.getDate() + 1);
    }
  }

  const isAdjusted = toDateStr(effectiveDate) !== toDateStr(baseDate);
  const effectiveDayName = DAY_NAMES[effectiveDate.getDay()];

  // Preceding business day for audit & manual checking
  const checkingDateObj = new Date(effectiveDate);
  checkingDateObj.setDate(checkingDateObj.getDate() - 1);
  while (checkingDateObj.getDay() === 0 || checkingDateObj.getDay() === 6 || holidays.includes(toDateStr(checkingDateObj))) {
    checkingDateObj.setDate(checkingDateObj.getDate() - 1);
  }

  const checkingDayName = DAY_NAMES[checkingDateObj.getDay()];

  let adjustmentNotice = null;
  if (isAdjusted) {
    adjustmentNotice = `Payday shifted from ${originalDayName} (${formatReadable(baseDate)}) to ${effectiveDayName} (${formatReadable(effectiveDate)}) per bank clearing schedule.`;
  }

  return {
    cutoffDate: toDateStr(baseDate),
    cutoffDayName: originalDayName,
    effectivePayday: toDateStr(effectiveDate),
    effectiveDayName,
    isAdjusted,
    adjustmentNotice,
    checkingDate: toDateStr(checkingDateObj),
    checkingDayName,
    readablePayday: formatReadable(effectiveDate),
    readableCheckingDate: formatReadable(checkingDateObj),
    readableCutoff: formatReadable(baseDate)
  };
}
