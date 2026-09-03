// backend/src/utils/payrollSummaryGenerator.js
// Generates a 7-page Payroll Summary PDF replicating the Mac-J Excel format.
const puppeteer = require("puppeteer");
const { formatDuration } = require("./systemTime.js");

// ── Helpers ───────────────────────────────────────────────────────────────────
const peso = (val) => {
  const v = Math.max(0, parseFloat(val) || 0);
  return v.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const thousandths = (val) => {
  const v = Math.max(0, parseFloat(val) || 0);
  return v.toLocaleString("en-PH", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
};

const sum = (rows, key) =>
  rows.reduce((acc, r) => acc + parseFloat(r[key] || 0), 0);

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-PH", { day: "2-digit", month: "short", year: "numeric" });
};

const formatEmpId = (id) => {
  if (!id) return "";
  return `MACJ-${String(id).padStart(3, "0")}`;
};

const formatFullName = (last, first) => {
  if (!last && !first) return "";
  return `${last}, ${first}`;
};

const formatShortName = (last, first) => {
  if (!last && !first) return "";
  const initial = first ? first.charAt(0).toUpperCase() + "." : "";
  return `${last}, ${initial}`;
};

const getPastMonth = (rows) => {
  if (!rows || rows.length === 0 || !rows[0].period_Start) return "PAST MONTH";
  // Append time to ensure it's treated as local/start of day
  const d = new Date(rows[0].period_Start + "T00:00:00");
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleString("en-PH", { month: "long" }).toUpperCase();
};

// ── HTML Builder ──────────────────────────────────────────────────────────────
const buildReportHTML = (rawRows, periodLabel, signatures = {}) => {
  // Default signatures if not provided
  const sigs = {
    preparedBy: signatures.preparedBy || "Loonie Medina",
    approvedBy: signatures.approvedBy || "Kael Voss",
    checkedBy: signatures.checkedBy || "Jenny C. Galeon",
    preparedByLabel: signatures.preparedByLabel || "Prepared by",
    approvedByLabel: signatures.approvedByLabel || "Approved by",
    checkedByLabel: signatures.checkedByLabel || "Checked by"
  };

  // ── Pre-process rows to ensure "Worked Days" model consistency ─────────────
  const payrollRows = rawRows.map(r => {
    const dailyRate = parseFloat(r.dailyRate || 0);
    const workedDays = parseFloat(r.NoDays_Worked || 0);
    const scheduledDays = parseFloat(r.totalScheduledDays || 0);
    const absenceHrs = parseFloat(r.absence_Hrs || 0);
    const tardinessMins = parseFloat(r.tardiness_Mins || 0);

    // Worked-based basic pay (Page 2)
    const computedBasic = workedDays * dailyRate;
    
    // Formula: amount = Rate per Hour / 60 * Minutes
    // Minutes = (Absence Hours * 60) + Tardiness Minutes
    const ratePerMin = (dailyRate / 8) / 60;
    const totalMins = (absenceHrs * 60) + tardinessMins;
    const absTard_Amnt = totalMins * ratePerMin;
    
    const holPay = parseFloat(r.legalHol_Amnt || 0) + parseFloat(r.specialHol_Amnt || 0);

    return {
      ...r,
      basicPay: computedBasic,
      NoHrs_Worked_Formatted: formatDuration(r.NoHrs_Worked),
      OT_Hrs_Formatted: formatDuration(r.OT_Hrs),
      absence_Amnt: 0, // Set to 0 because absences are consolidated into tardiness_Amnt for deduction
      tardiness_Amnt: absTard_Amnt,
      absTardDisplay: absTard_Amnt,  // For Page 3 display
      totalMins,       // For Page 3 display
      holPay
    };
  });

  const totals = {
    basicPay: sum(payrollRows, "basicPay"),
    OT_Amnt: sum(payrollRows, "OT_Amnt"),
    absence_Amnt: sum(payrollRows, "absence_Amnt"),
    tardiness_Amnt: sum(payrollRows, "tardiness_Amnt"),
    totalAbsTardDisplay: sum(payrollRows, "absTardDisplay"),
    totalAbsenceTardiness: sum(payrollRows, "tardiness_Amnt"),
    totalAdditionalPay: sum(payrollRows, "OT_Amnt") + sum(payrollRows, "incentives") + sum(payrollRows, "leaveCredits") + sum(payrollRows, "legalHol_Amnt") + sum(payrollRows, "specialHol_Amnt"),
    totalGrossPay: sum(payrollRows, "basicPay") - sum(payrollRows, "tardiness_Amnt") + (sum(payrollRows, "OT_Amnt") + sum(payrollRows, "incentives") + sum(payrollRows, "leaveCredits") + sum(payrollRows, "legalHol_Amnt") + sum(payrollRows, "specialHol_Amnt")),
    totalGovtDed: sum(payrollRows, "SSS_Ded") + sum(payrollRows, "Philhealth_Ded") + sum(payrollRows, "HDMF_Ded"),
    totalIncome: (sum(payrollRows, "basicPay") - sum(payrollRows, "tardiness_Amnt") + (sum(payrollRows, "OT_Amnt") + sum(payrollRows, "incentives") + sum(payrollRows, "leaveCredits") + sum(payrollRows, "legalHol_Amnt") + sum(payrollRows, "specialHol_Amnt"))) - (sum(payrollRows, "SSS_Ded") + sum(payrollRows, "Philhealth_Ded") + sum(payrollRows, "HDMF_Ded")),
    totalOtherDed: sum(payrollRows, "Tax_Ded") + sum(payrollRows, "healthCard_Amnt") + sum(payrollRows, "SSS_Loan") + sum(payrollRows, "HDMF_Loan") + sum(payrollRows, "multiPurposeSavings") + sum(payrollRows, "advances_Amnt"),
    totalNetPay: ((sum(payrollRows, "basicPay") - sum(payrollRows, "tardiness_Amnt") + (sum(payrollRows, "OT_Amnt") + sum(payrollRows, "incentives") + sum(payrollRows, "leaveCredits") + sum(payrollRows, "legalHol_Amnt") + sum(payrollRows, "specialHol_Amnt"))) - (sum(payrollRows, "SSS_Ded") + sum(payrollRows, "Philhealth_Ded") + sum(payrollRows, "HDMF_Ded"))) - (sum(payrollRows, "Tax_Ded") + sum(payrollRows, "healthCard_Amnt") + sum(payrollRows, "SSS_Loan") + sum(payrollRows, "HDMF_Loan") + sum(payrollRows, "multiPurposeSavings") + sum(payrollRows, "advances_Amnt")) + sum(payrollRows, "allowance"),
    totalAllDeductions: sum(payrollRows, "totalDeductions"),
    totalEarnings: sum(payrollRows, "totalEarnings") + sum(payrollRows, "allowance"),
    SSS_Ded: sum(payrollRows, "SSS_Ded"),
    Philhealth_Ded: sum(payrollRows, "Philhealth_Ded"),
    HDMF_Ded: sum(payrollRows, "HDMF_Ded"),
    Tax_Ded: sum(payrollRows, "Tax_Ded"),
    netPay: sum(payrollRows, "netPay"),
    // ER Shares
    ER_SSS: sum(payrollRows, "SSS_Ded_ER"),
    ER_PH: sum(payrollRows, "Philhealth_Ded_ER"),
    ER_HDMF: sum(payrollRows, "HDMF_Ded_ER"),
    // Other Deductions
    healthCard: sum(payrollRows, "healthCard_Amnt"),
    SSS_Loan: sum(payrollRows, "SSS_Loan"),
    HDMF_Loan: sum(payrollRows, "HDMF_Loan"),
    calamity: sum(payrollRows, "calamityLoan_Amnt"),
    advances: sum(payrollRows, "advances_Amnt"),
    globe: sum(payrollRows, "globe_Deduction"),
    mpSavings: sum(payrollRows, "multiPurposeSavings"),
    eastwest: sum(payrollRows, "eastwest_Loan"),
    healthCardCount: payrollRows.filter(r => parseFloat(r.healthCard_Amnt) > 0).length,
    // Extra Earnings
    nightDiff: sum(payrollRows, "nightDiff_Amnt"),
    holidayPay: sum(payrollRows, "legalHol_Amnt") + sum(payrollRows, "specialHol_Amnt"),
    incentives: sum(payrollRows, "incentives"),
    allowance: sum(payrollRows, "allowance"),
    // Page 6 specific totals
    totalERShare: sum(payrollRows, "SSS_Ded_ER") + sum(payrollRows, "Philhealth_Ded_ER") + sum(payrollRows, "HDMF_Ded_ER"),
    remitSSS: sum(payrollRows, "SSS_Ded") + sum(payrollRows, "SSS_Ded_ER"),
    remitPH: sum(payrollRows, "Philhealth_Ded") + sum(payrollRows, "Philhealth_Ded_ER"),
    remitHDMF: sum(payrollRows, "HDMF_Ded") + sum(payrollRows, "HDMF_Ded_ER"),
    totalRemittance: (sum(payrollRows, "SSS_Ded") + sum(payrollRows, "SSS_Ded_ER")) + (sum(payrollRows, "Philhealth_Ded") + sum(payrollRows, "Philhealth_Ded_ER")) + (sum(payrollRows, "HDMF_Ded") + sum(payrollRows, "HDMF_Ded_ER")),
    totalMonthlyRate: sum(payrollRows, "dailyRate") * 26
  };

  // Final BDO Deposit = Received by (Net Pay subtotal) - EastWest
  totals.totalForDeposit = totals.totalNetPay - totals.eastwest;

  const commonHeader = `
    <div class="company-header">
      <h1>MAC-J INT'L., FORWARDING LTD., CO.</h1>
      <p>Room 1 Skyfreight Bldg., C, NAIA Avenue, Paranaque City</p>
      <div class="period-label">${periodLabel}</div>
    </div>
  `;

  const footerSigsPages1to6 = `
    <div class="signature-area">
      <div class="sig-block"><div class="sig-line"></div><div class="sig-name">${sigs.preparedBy}</div><div class="sig-label">${sigs.preparedByLabel}</div></div>
      <div class="sig-block"><div class="sig-line"></div><div class="sig-name">${sigs.approvedBy}</div><div class="sig-label">${sigs.approvedByLabel}</div></div>
    </div>
  `;

  const footerSigsPage7 = `
    <div class="signature-area">
      <div class="sig-block"><div class="sig-line"></div><div class="sig-name">${sigs.preparedBy}</div><div class="sig-label">${sigs.preparedByLabel}</div></div>
      <div class="sig-block"><div class="sig-line"></div><div class="sig-name">${sigs.approvedBy}</div><div class="sig-label">${sigs.approvedByLabel}</div></div>
      <div class="sig-block"><div class="sig-line"></div><div class="sig-name">${sigs.checkedBy}</div><div class="sig-label">${sigs.checkedByLabel}</div></div>
    </div>
  `;

  const pageNum = (n) => `<div class="page-num">Page ${n} of 7</div>`;

  // Page 1: Employee Info
  const page1 = `
    <div class="page">
      ${commonHeader}
      <div class="doc-title">Employee Information Summary (Page 1)</div>
      <table>
        <thead>
          <tr><th>REMARKS</th><th>EMP#</th><th>Name of Employee</th><th>Tax Status</th><th>DATE HIRED</th><th>ACCOUNT NUMBER</th><th>DEPARTMENT</th></tr>
        </thead>
        <tbody>
          ${payrollRows.map(r => `
            <tr>
              <td>${parseFloat(r.profileHealthCard || 0) > 0 ? "MAXICARE" : "Above Minimum"}</td><td>${formatEmpId(r.user_Id)}</td><td>${formatFullName(r.user_LastName, r.user_FirstName)}</td>
              <td class="center">${r.taxStatus || 'S'}</td><td>${formatDate(r.hireDate)}</td><td>${r.accountNo || ''}</td><td>${r.department || ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${pageNum(1)}
    </div>
  `;

  // Page 2: Earnings I
  const page2 = `
    <div class="page">
      ${commonHeader}
      <div class="doc-title">Earnings Summary - Basic Pay (Page 2)</div>
      <table>
        <thead>
          <tr>
            <th>EMP#</th><th>Name of Employee</th><th>Tax Status</th><th>POSITION</th>
            <th>OLD DAILY RATE</th><th>NEW DAILY RATE</th><th>Rate per Hour</th>
            <th>Number of Days</th><th>Number of Hour</th><th>PAY THIS PERIOD</th>
          </tr>
        </thead>
        <tbody>
          ${payrollRows.map(r => `
            <tr>
              <td>${formatEmpId(r.user_Id)}</td><td>${formatShortName(r.user_LastName, r.user_FirstName)}</td>
              <td class="center">${r.taxStatus || 'S'}</td><td>${r.position || ''}</td>
              <td class="amt">${peso(r.previousDailyRate)}</td><td class="amt">${peso(r.dailyRate)}</td>
              <td class="amt">${thousandths(r.ratePerHr)}</td><td class="center">${r.NoDays_Worked}</td>
              <td class="center">${r.NoHrs_Worked_Formatted}</td><td class="amt bold">${peso(r.basicPay)}</td>
            </tr>`).join('')}
          <tr class="totals-row"><td colspan="9">TOTAL</td><td class="amt">${peso(totals.basicPay)}</td></tr>
        </tbody>
      </table>
      ${pageNum(2)}
    </div>
  `;

  // Page 3: Attendance & Overtime
  const pastMonth = getPastMonth(payrollRows);
  const page3 = `
    <div class="page">
      ${commonHeader}
      <div class="doc-title">Attendance & Overtime Summary (Page 3)</div>
      <table>
        <thead>
          <tr class="group-header">
            <th rowspan="3">EMP#</th>
            <th rowspan="3">NAME</th>
            <th rowspan="3">TAX</th>
            <th colspan="3">SCHEDULE 1 (Tardiness)</th>
            <th colspan="4">ADDITIONAL PAY</th>
            <th rowspan="3">Total<br> Additional Pay</th>
            <th rowspan="3">Total<br> Gross Pay</th>
            <th rowspan="3">BASIC PAY</th>
          </tr>
          <tr class="group-header">
            <th rowspan="2">Minutes</th>
            <th rowspan="2">Amount</th>
            <th rowspan="2">Total Absences & <br/> Tardiness</th>
            <th colspan="2">SCHEDULE 2 (Overtime)</th>
            <th rowspan="2">INCENTIVES FTM OF<br/>(${pastMonth})</th>
            <th rowspan="2">VL<br> INCENTIVES</th>
          </tr>
          <tr class="sub-header">
            <th>Hours</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${payrollRows.map(r => {
            const addPay = parseFloat(r.OT_Amnt || 0) + parseFloat(r.incentives || 0) + parseFloat(r.leaveCredits || 0) + parseFloat(r.holPay || 0);
            // actualGross formula: Basic Pay - Tardiness + Additional Pay (including Holidays)
            const actualGross = parseFloat(r.basicPay || 0) - parseFloat(r.tardiness_Amnt || 0) + addPay;
            const basicPayAfterTard = parseFloat(r.basicPay || 0) - parseFloat(r.tardiness_Amnt || 0);
            return `
            <tr>
              <td>${formatEmpId(r.user_Id)}</td><td>${formatShortName(r.user_LastName, r.user_FirstName)}</td>
              <td class="center">${r.taxStatus || 'S'}</td>
              <td class="center">${r.totalMins}</td><td class="amt">${peso(r.absTardDisplay)}</td>
              <td class="amt bold">${peso(r.absTardDisplay)}</td>
              <td class="center">${r.OT_Hrs_Formatted}</td><td class="amt">${peso(r.OT_Amnt)}</td>
              <td class="amt">${peso(r.incentives)}</td>
              <td class="amt">${peso(r.leaveCredits)}</td>
              <td class="amt bold">${peso(addPay)}</td>
              <td class="amt bold" style="color:#1e3a8a">${peso(actualGross)}</td>
              <td class="amt bold">${peso(basicPayAfterTard)}</td>
            </tr>`;
          }).join('')}
          <tr class="totals-row">
            <td colspan="3">TOTAL</td>
            <td class="center">${sum(payrollRows, "totalMins")}</td>
            <td class="amt">${peso(totals.totalAbsTardDisplay)}</td>
            <td class="amt">${peso(totals.totalAbsTardDisplay)}</td>
            <td class="center">${formatDuration(sum(payrollRows, "OT_Hrs"))}</td><td class="amt">${peso(totals.OT_Amnt)}</td>
            <td class="amt">${peso(totals.incentives)}</td>
            <td class="amt">${peso(sum(payrollRows, "leaveCredits"))}</td>
            <td class="amt bold">${peso(totals.totalAdditionalPay)}</td>
            <td class="amt bold" style="color:#1e3a8a">${peso(totals.totalGrossPay)}</td>
            <td class="amt bold">${peso(totals.basicPay - totals.totalAbsenceTardiness)}</td>
          </tr>
        </tbody>
      </table>
      ${pageNum(3)}
    </div>
  `;

  // Page 4: Govt & Other Deductions
  const page4 = `
    <div class="page">
      ${commonHeader}
      <div class="doc-title">Deductions Summary (Page 4)</div>
      <table>
        <thead>
          <tr class="group-header">
            <th rowspan="2">EMP#</th>
            <th rowspan="2">NAME</th>
            <th rowspan="2">TAX STATUS</th>
            <th colspan="3">Governmental Deductions</th>
            <th rowspan="2">Total Govt<br/>Deduction</th>
            <th rowspan="2">Taxable Income</th>
            <th colspan="6">Other Deductions</th>
            <th rowspan="2">Total Other<br/>Deductions</th>
          </tr>
          <tr class="sub-header">
            <th>SSS</th><th>PHILHEALTH</th><th>HDMF</th>
            <th>TAX</th><th>MAXICARE</th><th>SSS LOAN</th><th>HDMF LOAN</th><th>MultiPurpose<br> SAVINGS</th><th>ADVANCES</th>
          </tr>
        </thead>
        <tbody>
          ${payrollRows.map(r => {
            const addPay = parseFloat(r.OT_Amnt || 0) + parseFloat(r.incentives || 0) + parseFloat(r.leaveCredits || 0) + parseFloat(r.holPay || 0);
            const gross = parseFloat(r.basicPay || 0) - parseFloat(r.tardiness_Amnt || 0) + addPay;
            const govt = parseFloat(r.SSS_Ded || 0) + parseFloat(r.Philhealth_Ded || 0) + parseFloat(r.HDMF_Ded || 0);
            const totalIncome = gross - govt;
            const other = parseFloat(r.Tax_Ded || 0) + parseFloat(r.healthCard_Amnt || 0) + parseFloat(r.SSS_Loan || 0) + parseFloat(r.HDMF_Loan || 0) + parseFloat(r.multiPurposeSavings || 0) + parseFloat(r.advances_Amnt || 0);
            return `
            <tr>
              <td>${formatEmpId(r.user_Id)}</td><td>${formatShortName(r.user_LastName, r.user_FirstName)}</td>
              <td class="center">${r.taxStatus || 'S'}</td>
              <td class="amt">${peso(r.SSS_Ded)}</td><td class="amt">${peso(r.Philhealth_Ded)}</td>
              <td class="amt">${peso(r.HDMF_Ded)}</td>
              <td class="amt bold">${peso(govt)}</td>
              <td class="amt bold">${peso(totalIncome)}</td>
              <td class="amt">${peso(r.Tax_Ded)}</td><td class="amt">${peso(r.healthCard_Amnt)}</td>
              <td class="amt">${peso(r.SSS_Loan)}</td><td class="amt">${peso(r.HDMF_Loan)}</td>
              <td class="amt">${peso(r.multiPurposeSavings)}</td><td class="amt">${peso(r.advances_Amnt)}</td>
              <td class="amt bold">${peso(other)}</td>
            </tr>`;
          }).join('')}
          <tr class="totals-row">
            <td colspan="3">TOTAL</td>
            <td class="amt">${peso(totals.SSS_Ded)}</td><td class="amt">${peso(totals.Philhealth_Ded)}</td><td class="amt">${peso(totals.HDMF_Ded)}</td>
            <td class="amt">${peso(totals.totalGovtDed)}</td>
            <td class="amt bold">${peso(totals.totalIncome)}</td>
            <td class="amt">${peso(totals.Tax_Ded)}</td><td class="amt">${peso(totals.healthCard)}</td>
            <td class="amt">${peso(totals.SSS_Loan)}</td><td class="amt">${peso(totals.HDMF_Loan)}</td>
            <td class="amt">${peso(totals.mpSavings)}</td><td class="amt">${peso(totals.advances)}</td>
            <td class="amt bold">${peso(totals.totalOtherDed)}</td>
            </tr>
            </tbody>
      </table>
      ${pageNum(4)}
    </div>
  `;

  // Page 5: Net Pay Summary
  const page5 = `
    <div class="page">
      ${commonHeader}
      <div class="doc-title">Net Pay & Bank Deposit Summary (Page 5)</div>
      <table>
        <thead>
          <tr>
            <th>EMP#</th><th>NAME</th><th>TAX STATUS</th>
            <th>ALLOWANCES</th><th>NET PAY</th>
            <th>Deduction<br/>EASTWEST Loan</th>
            <th>FOR DEPOSIT</th>
          </tr>
        </thead>
        <tbody>
          ${payrollRows.map(r => {
            const addPay = parseFloat(r.OT_Amnt || 0) + parseFloat(r.incentives || 0) + parseFloat(r.leaveCredits || 0) + parseFloat(r.holPay || 0);
            const gross = parseFloat(r.basicPay || 0) - parseFloat(r.tardiness_Amnt || 0) + addPay;
            const govt = parseFloat(r.SSS_Ded || 0) + parseFloat(r.Philhealth_Ded || 0) + parseFloat(r.HDMF_Ded || 0);
            const taxableIncome = gross - govt;
            const other = parseFloat(r.Tax_Ded || 0) + parseFloat(r.healthCard_Amnt || 0) + parseFloat(r.SSS_Loan || 0) + parseFloat(r.HDMF_Loan || 0) + parseFloat(r.multiPurposeSavings || 0) + parseFloat(r.advances_Amnt || 0);
            const formulaNetPay = taxableIncome - other + parseFloat(r.allowance || 0);
            
            // FOR DEPOSIT: Net Pay - EastWest
            const forDeposit = formulaNetPay - parseFloat(r.eastwest_Loan || 0);

            return `
            <tr>
              <td>${formatEmpId(r.user_Id)}</td><td>${formatShortName(r.user_LastName, r.user_FirstName)}</td>
              <td class="center">${r.taxStatus || 'S'}</td>
              <td class="amt">${peso(r.allowance)}</td>
              <td class="amt bold">${peso(formulaNetPay)}</td>
              <td class="amt">${peso(r.eastwest_Loan)}</td>
              <td class="amt bold" style="color:#166534">${peso(forDeposit)}</td>
            </tr>`}).join('')}
          <tr class="totals-row">
            <td colspan="3">TOTAL</td>
            <td class="amt">${peso(totals.allowance)}</td>
            <td class="amt">${peso(totals.totalNetPay)}</td>
            <td class="amt">${peso(totals.eastwest)}</td>
            <td class="amt">${peso(totals.totalNetPay - totals.eastwest)}</td>
          </tr>
        </tbody>
      </table>
      ${pageNum(5)}
    </div>
  `;

  // Page 6: ER Share
  const page6 = `
    <div class="page">
      ${commonHeader}
      <div class="doc-title">Employer Contributions & Remittances (Page 6)</div>
      <table>
        <thead>
          <tr class="group-header">
            <th rowspan="2">EMP#</th><th rowspan="2">NAME</th><th rowspan="2">TAX</th>
            <th colspan="3">EMPLOYER SHARE</th>
            <th rowspan="2">Total ER share</th>
            <th colspan="3">TOTAL REMITTANCE (EE+ER)</th>
            <th rowspan="2">Total Remittances</th>
            <th rowspan="2">Monthly Rate <br/>Computation</th>
          </tr>
          <tr class="sub-header">
            <th>SSS</th><th>PH</th><th>HDMF</th>
            <th>SSS</th><th>PH</th><th>HDMF</th>
          </tr>
        </thead>
        <tbody>
          ${payrollRows.map(r => {
            const erSSS = parseFloat(r.SSS_Ded_ER || 0);
            const erPH = parseFloat(r.Philhealth_Ded_ER || 0);
            const erHDMF = parseFloat(r.HDMF_Ded_ER || 0);
            const eeSSS = parseFloat(r.SSS_Ded || 0);
            const eePH = parseFloat(r.Philhealth_Ded || 0);
            const eeHDMF = parseFloat(r.HDMF_Ded || 0);

            const totalER = erSSS + erPH + erHDMF;
            const remSSS = eeSSS + erSSS;
            const remPH = eePH + erPH;
            const remHDMF = eeHDMF + erHDMF;
            const totalRemit = remSSS + remPH + remHDMF;
            const monthlyRate = parseFloat(r.dailyRate || 0) * 26;

            return `
            <tr>
              <td>${formatEmpId(r.user_Id)}</td><td>${formatShortName(r.user_LastName, r.user_FirstName)}</td>
              <td class="center">${r.taxStatus || 'S'}</td>
              <td class="amt">${peso(erSSS)}</td><td class="amt">${peso(erPH)}</td><td class="amt">${peso(erHDMF)}</td>
              <td class="amt bold">${peso(totalER)}</td>
              <td class="amt">${peso(remSSS)}</td><td class="amt">${peso(remPH)}</td><td class="amt">${peso(remHDMF)}</td>
              <td class="amt bold">${peso(totalRemit)}</td>
              <td class="amt bold">${peso(monthlyRate)}</td>
            </tr>`;
          }).join('')}
          <tr class="totals-row">
            <td colspan="3">TOTAL</td>
            <td class="amt">${peso(totals.ER_SSS)}</td><td class="amt">${peso(totals.ER_PH)}</td><td class="amt">${peso(totals.ER_HDMF)}</td>
            <td class="amt bold">${peso(totals.totalERShare)}</td>
            <td class="amt">${peso(totals.remitSSS)}</td><td class="amt">${peso(totals.remitPH)}</td><td class="amt">${peso(totals.remitHDMF)}</td>
            <td class="amt bold">${peso(totals.totalRemittance)}</td>
            <td class="amt bold">${peso(totals.totalMonthlyRate)}</td>
          </tr>
        </tbody>
      </table>
      ${pageNum(6)}
    </div>
  `;

  // Page 7: Journal Entry
  const page7 = `
    <div class="page">
      ${commonHeader}
      <div class="doc-title">Journal Entry Summary (Page 7)</div>
      <div class="journal-box">
        <table>
          <tr class="j-header"><th>Account Description</th><th class="amt">Debit</th><th class="amt">Credit</th></tr>
          <tr><td>Salaries & allowances</td><td class="amt">${peso(totals.totalGrossPay + totals.allowance)}</td><td></td></tr>
          <tr><td>SSS, Philhealth & HDMF contr</td><td class="amt">${peso(totals.totalERShare)}</td><td></td></tr>
          
          <tr><td>SSS contribution payable (EE+ER)</td><td></td><td class="amt">${peso(totals.remitSSS)}</td></tr>
          <tr><td>Philhealth contribution payable (EE+ER)</td><td></td><td class="amt">${peso(totals.remitPH)}</td></tr>
          <tr><td>HDMF contribution payable (EE+ER)</td><td></td><td class="amt">${peso(totals.remitHDMF)}</td></tr>
          <tr><td>Tax</td><td></td><td class="amt">${peso(totals.Tax_Ded)}</td></tr>
          <tr><td>HDMF Saving</td><td></td><td class="amt">${peso(totals.mpSavings)}</td></tr>
          <tr><td>HDMF loan payable</td><td></td><td class="amt">${peso(totals.HDMF_Loan)}</td></tr>
          <tr><td>SSS Loan payable</td><td></td><td class="amt">${peso(totals.SSS_Loan)}</td></tr>
          <tr><td>Healthcard-Maxicare</td><td></td><td class="amt">${peso(totals.healthCard)}</td></tr>
          <tr><td>Advances to employees</td><td></td><td class="amt">${peso(totals.advances)}</td></tr>
          
          <tr class="total-line"><td><strong>Cash in bank-BDO</strong></td><td></td><td class="amt"><strong>${peso(totals.totalNetPay)}</strong></td></tr>
          
          <tr class="final-row">
            <td><strong>TOTAL</strong></td>
            <td class="amt"><strong>${peso(totals.totalGrossPay + totals.allowance + totals.totalERShare)}</strong></td>
            <td class="amt"><strong>${peso(totals.remitSSS + totals.remitPH + totals.remitHDMF + totals.Tax_Ded + totals.mpSavings + totals.HDMF_Loan + totals.SSS_Loan + totals.healthCard + totals.advances + totals.totalNetPay)}</strong></td>
          </tr>
        </table>
      </div>
      ${footerSigsPage7}
      ${pageNum(7)}
    </div>
  `;

  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; background: #fff; padding: 0; }
  
  /* Page Styling */
  .page { 
    page-break-after: always; 
    padding: 12mm 10mm; 
    width: 297mm; 
    background: white; 
    margin: 0 auto; 
    position: relative;
  }
  
  /* Print Overrides */
  @media print {
    body { background: white; padding: 0; }
    .page { margin: 0; width: 100%; }
    .page-divider { display: none; }
  }

  .page-divider {
    border: none;
    height: 1px;
    background: #eee;
    width: 100%;
    margin: 0;
  }

  .company-header { text-align: center; margin-bottom: 20px; }
  .company-header h1 { font-size: 20px; color: #1a3a6e; margin: 0; letter-spacing: 1px; }
  .company-header p { margin: 4px 0; color: #666; font-size: 12px; }
  .period-label { font-weight: bold; color: #166534; font-size: 13px; margin-top: 6px; }
  .doc-title { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 20px; background: #f0f4ff; padding: 8px; border: 1px solid #1a3a6e; text-transform: uppercase; }
  
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: auto; }
  th, td { border: 1px solid #aaa; padding: 4px 6px; font-size: 10px; word-wrap: break-word; }
  th { background: #1a3a6e; color: #fff; text-transform: uppercase; }
  tr.group-header th { background: #0d2550; }
  tr.sub-header th { background: #dce6f1; color: #333; }
  
  .amt { text-align: right; font-family: 'Courier New', monospace; font-size: 10.5px; white-space: nowrap; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  
  .totals-row td { background: #eee; font-weight: bold; border-top: 2px solid #333; font-size: 11.5px; }
  
  .journal-box { width: 90%; margin: 30px auto; border: 1px solid #1a3a6e; }
  .j-header th { background: #eee; color: #333; border-bottom: 2px solid #1a3a6e; font-size: 12px; padding: 10px; }
  .journal-box td { padding: 10px; font-size: 12px; }
  .total-line td { border-top: 2px solid #1a3a6e; background: #f0fdf4; font-weight: bold; }
  .final-row td { background: #1a3a6e; color: #fff; font-weight: bold; font-size: 13px; }
  
  .signature-area { margin-top: 50px; display: flex; justify-content: space-around; text-align: center; }
  .sig-block { width: 220px; }
  .sig-line { border-bottom: 1px solid #333; margin-bottom: 8px; height: 40px; }
  .sig-name { font-weight: bold; font-size: 12px; color: #1a3a6e; }
  .sig-label { font-size: 10px; color: #666; text-transform: uppercase; }
  
  .page-num {
    position: absolute;
    bottom: 8mm;
    right: 10mm;
    font-size: 11px;
    color: #999;
    font-weight: bold;
    font-style: italic;
    border-top: 1px solid #eee;
    padding-top: 4px;
  }
</style>
</head>
<body>
  ${page1} <div class="page-divider"></div>
  ${page2} <div class="page-divider"></div>
  ${page3} <div class="page-divider"></div>
  ${page4} <div class="page-divider"></div>
  ${page5} <div class="page-divider"></div>
  ${page6} <div class="page-divider"></div>
  ${page7}
</body>
</html>`;
};

const { getSharedBrowser } = require("./dtrGenerator");

exports.generatePayrollSummaryPDF = async (payrollRows, periodLabel, signatures = {}) => {
  const html = buildReportHTML(payrollRows, periodLabel, signatures);
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    // Use A4 landscape for each page
    return await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" }
    });
  } finally {
    try {
      await page.close();
    } catch (e) {}
  }
};

exports.build8PageReportHTML = buildReportHTML;
