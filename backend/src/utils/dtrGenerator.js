// utils/dtrGenerator.js
// Generates a DTR PDF buffer using Puppeteer.
// Called during batch payroll — one DTR per employee per period.
//
// Dependencies:  npm install puppeteer
// Usage:
//   const { generateDTRPDF } = require("./dtrGenerator");
//   const pdfBuffer = await generateDTRPDF({ employee, dtrData, period_Start, period_End, netPay });

const puppeteer = require("puppeteer");
const { formatDuration } = require("./systemTime.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format MACJ-001 from raw integer */
const formatUserId = (id) => `MACJ-${String(id).padStart(3, "0")}`;

/** "April 1 – 15, 2026" from two YYYY-MM-DD strings */
const formatPeriodLabel = (startStr, endStr) => {
  const s = new Date(startStr + "T00:00:00");
  const e = new Date(endStr   + "T00:00:00");
  const month = s.toLocaleString("en-PH", { month: "long" });
  return `${month} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`;
};

/** Total hours across all DTR rows */
const totalHours = (dtrData) => {
  const sum = dtrData.reduce((acc, d) => {
    return acc + parseFloat(d.hoursWorked || 0);
  }, 0);
  return formatDuration(sum);
};

// ── HTML Builder ──────────────────────────────────────────────────────────────

/**
 * @param {object}   employee    - { user_Id, user_FirstName, user_LastName }
 * @param {object[]} dtrData     - rows from getAttendanceReportInternal()
 * @param {string}   period_Start - "YYYY-MM-DD"
 * @param {string}   period_End   - "YYYY-MM-DD"
 * @param {object}   fullStats    - computed payroll statistics
 */
const buildDTRHTML = (employee, dtrData, period_Start, period_End, fullStats) => {
  const periodLabel = formatPeriodLabel(period_Start, period_End);
  const empId       = formatUserId(employee.user_Id);
  const empName     = `${employee.user_FirstName} ${employee.user_LastName}`;
  const totalHrs    = totalHours(dtrData);

  // Map fullStats for summary table - be robust with property names (handle camelCase and lowercase)
  console.log(`[DTR_GEN] Generating for ${empName} (${empId}). fullStats keys:`, Object.keys(fullStats || {}));

  const regHrs      = parseFloat(fullStats?.NoHrs_Worked || fullStats?.nohrs_worked || fullStats?.reg_hrs || 0).toFixed(2);
  const hourlyRate  = parseFloat(fullStats?.ratePerHr || fullStats?.rateperhr || fullStats?.dailyRate / 8 || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });
  const bPayValue   = parseFloat(fullStats?.basicPay || fullStats?.basicpay || fullStats?.actualBasicPay || 0);
  const basicPay    = bPayValue.toLocaleString("en-PH", { minimumFractionDigits: 2 });
  const fineValue   = parseFloat(fullStats?.tardiness_Amnt || fullStats?.tardiness_amnt || 0);
  const fines       = fineValue.toLocaleString("en-PH", { minimumFractionDigits: 2 });
  const absValue    = parseInt(fullStats?.absence_Days || fullStats?.absence_days || 0);
  
  const netPayVal   = parseFloat(fullStats?.netPay || fullStats?.netpay || 0);
  const netPay      = netPayVal.toLocaleString("en-PH", { minimumFractionDigits: 2 });
  const totalAtt    = (bPayValue - fineValue).toLocaleString("en-PH", { minimumFractionDigits: 2 });

  console.log(`[DTR_GEN] Mapped -> regHrs: ${regHrs}, rate: ${hourlyRate}, basicPay: ${basicPay}, fines: ${fines}, netPay: ${netPay}`);

  // Build one <tr> per calendar day in the period
  const start    = new Date(period_Start + "T00:00:00");
  const end      = new Date(period_End   + "T00:00:00");
  const dayRows  = [];

  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    const dayNum   = cur.getDate();
    const isSunday = cur.getDay() === 0;

    // Manila-safe YYYY-MM-DD conversion
    const curYYYY = cur.getFullYear();
    const curMM   = String(cur.getMonth() + 1).padStart(2, '0');
    const curDD   = String(cur.getDate()).padStart(2, '0');
    const curDateStr = `${curYYYY}-${curMM}-${curDD}`;

    // Match the DTR row for this calendar day
    const log = dtrData.find((d) => {
      if (!d.log_Date) return false;
      const logDateOnly = String(d.log_Date).split('T')[0];
      return logDateOnly === curDateStr;
    });

    // Helper to hide 00:00 timestamps for system generated logs
    const formatTime = (time, isSystem) => {
      if (!time || time === "—" || time === "00:00") return "";
      if (isSystem && time === "00:00") return "";
      return time;
    };

    const cell = (val) =>
      `<td>${!isSunday && log ? formatTime(val, log.systemGenerated) : ""}</td>`;

    const dailyTotal =
      !isSunday && log ? (log.hoursWorkedFormatted || formatDuration(log.hoursWorked) || "") : "";

    dayRows.push(`
      <tr class="${isSunday ? "weekend" : ""}">
        <td class="dayCol">${dayNum}</td>
        ${cell(log?.morning_In)}
        ${cell(log?.morning_Out)}
        ${cell(log?.afternoon_In)}
        ${cell(log?.afternoon_Out)}
        ${cell(log?.ot_In)}
        ${cell(log?.ot_Out)}
        <td class="totalCol">${dailyTotal}</td>
      </tr>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    font-family: Arial, sans-serif;
    font-size: 12px;
    color: #111;
    background: #fff;
    padding: 15mm;
    display: flex;
    flex-direction: column;
    min-height: 267mm;
  }

  /* ── Card top header ── */
  .cardTopHeader {
    border: 2px solid #333;
    margin-bottom: 0;
  }

  .headerLine {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid #555;
    padding: 8px 12px;
    gap: 16px;
  }
  .headerLine:last-of-type { border-bottom: none; }

  .field {
    display: flex;
    gap: 6px;
    flex: 1;
    font-size: 12px;
    color: #444;
  }
  .field span {
    font-weight: bold;
    color: #000;
    border-bottom: 1px solid #999;
    flex: 1;
    padding-bottom: 1px;
  }

  /* ── Summary table ── */
  .summaryTable {
    width: 100%;
    border-collapse: collapse;
    border-top: 2px solid #333;
    font-size: 11px;
  }
  .summaryTable th, .summaryTable td {
    border: 1px solid #888;
    padding: 6px 8px;
    text-align: center;
  }
  .summaryTable .label { text-align: left; font-weight: normal; color: #555; }
  .summaryTable .empty { min-width: 60px; }
  .summaryTable .verticalTh {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-size: 10px;
    letter-spacing: 1px;
    background: #f0f0f0;
    padding: 6px 2px;
    width: 20px;
    text-align: center;
  }
  .summaryTable .finalRow td { font-weight: bold; font-size: 11px; }

  /* ── Main attendance grid ── */
  .mainAttendanceGrid {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #333;
    border-top: none;
    font-size: 11px;
    flex: 1;
  }
  .mainAttendanceGrid th, .mainAttendanceGrid td {
    border: 1px solid #aaa;
    padding: 7px 4px;
    text-align: center;
    min-width: 46px;
  }
  .mainAttendanceGrid thead th {
    background: #f5f5f5;
    font-size: 10px;
    font-weight: bold;
    padding: 10px 4px;
  }
  .mainAttendanceGrid .dayCol   { font-weight: bold; width: 30px; background: #fafafa; }
  .mainAttendanceGrid .totalCol { font-weight: bold; background: #fafafa; }
  .mainAttendanceGrid .weekend  { background: #f8f4f0; color: #bbb; }

  /* ── Footer ── */
  .cardFooter {
    border: 2px solid #333;
    border-top: none;
    padding: 20px 12px 30px;
  }
  .certification {
    font-size: 10px;
    color: #555;
    margin-bottom: 25px;
    text-align: center;
  }
  .signatureLine {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    max-width: 220px;
    margin: 0 auto;
  }
  .signatureLine .line {
    border-bottom: 1px solid #333;
    width: 100%;
    height: 24px;
  }
  .signatureLine span {
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #555;
  }

  /* ── Page title ── */
  .dtrTitle {
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 8px;
    color: #1a1a1a;
  }
  .dtrSubtitle {
    text-align: center;
    font-size: 10px;
    color: #666;
    margin-bottom: 14px;
  }
</style>
</head>
<body>

<div class="dtrTitle">Daily Time Record</div>
<div class="dtrSubtitle">MAC-J Int'l Forwarding Ltd., Co.</div>

<div class="cardTopHeader">
  <div class="headerLine">
    <div class="field">No. <span>${empId}</span></div>
    <div class="field">Pay Ending <span>${periodLabel}</span></div>
  </div>
  <div class="headerLine">
    <div class="field">Name <span>${empName}</span></div>
    <div class="field">Position <span>Employee</span></div>
  </div>

  <table class="summaryTable">
    <thead>
      <tr>
        <th colspan="2">Hours</th>
        <th>Rate</th>
        <th>Amount</th>
        <th class="verticalTh" rowspan="4">DEDUCTIONS</th>
        <th colspan="2">ABSENCES</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="label">Reg.</td>
        <td class="empty">${regHrs}</td>
        <td class="empty">₱${hourlyRate}</td>
        <td class="empty">₱${basicPay}</td>
        <td class="label">Fines</td>
        <td class="empty">₱${fines}</td>
      </tr>
      <tr>
        <td class="label">Total Hrs</td>
        <td class="empty" colspan="3">${totalHrs} hrs</td>
        <td class="label">Count</td>
        <td class="empty">${absValue} days</td>
      </tr>
      <tr class="finalRow">
        <td class="label" colspan="3">NET PAY (Payroll Total)</td>
        <td class="empty">₱${netPay}</td>
        <td class="label">TOTAL (Attn.)</td>
        <td class="empty">₱${totalAtt}</td>
      </tr>
    </tbody>
  </table>
</div>

<table class="mainAttendanceGrid">
  <thead>
    <tr>
      <th rowspan="2">Days</th>
      <th colspan="2">MORNING</th>
      <th colspan="2">AFTERNOON</th>
      <th colspan="2">OVERTIME</th>
      <th rowspan="2">Daily<br/>Total</th>
    </tr>
    <tr>
      <th>IN</th><th>OUT</th>
      <th>IN</th><th>OUT</th>
      <th>IN</th><th>OUT</th>
    </tr>
  </thead>
  <tbody>
    ${dayRows.join("\n")}
  </tbody>
</table>

<div class="cardFooter">
  <p class="certification">I hereby certify that the above records are true and correct.</p>
  <div class="signatureLine">
    <div class="line"></div>
    <span>Employee's Signature</span>
  </div>
</div>

</body>
</html>`;
};

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Generates a DTR PDF buffer for a single employee.
 *
 * @param {object} params
 * @param {object}   params.employee     - { user_Id, user_FirstName, user_LastName }
 * @param {object[]} params.dtrData      - rows from getAttendanceReportInternal()
 * @param {string}   params.period_Start - "YYYY-MM-DD"
 * @param {string}   params.period_End   - "YYYY-MM-DD"
 * @param {object}   params.fullStats    - computed payroll statistics
 * @returns {Promise<Buffer>} PDF buffer ready to attach to an email
 */
const generateDTRPDF = async ({ employee, dtrData, period_Start, period_End, fullStats }) => {
  const html = buildDTRHTML(employee, dtrData, period_Start, period_End, fullStats);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};

module.exports = { generateDTRPDF };