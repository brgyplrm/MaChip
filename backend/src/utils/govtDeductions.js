/**
 * Government Deductions Logic for Philippines (2025/2026)
 * Replicates the Mac-J Excel Format and RA Mandates.
 */

const SSS_EMPLOYER_RATE = 0.10; // 10%
const SSS_EMPLOYEE_RATE = 0.05; // 5%

/**
 * Computes SSS shares based on Monthly Salary Credit (MSC).
 * Formula: 
 *   EE = MSC * 5%
 *   ER = (MSC * 10%) + EC (10 or 30)
 *   Example: MACJ-001 with MSC 35,000 => ER = (35,000 * 0.10) + 30 = 3,530.00
 */
exports.computeSSS = (dailyRate) => {
  const monthly = dailyRate * 26;
  const msc = Math.min(Math.max(Math.round(monthly / 500) * 500, 5000), 35000);

  // SSS EC is 10 for MSC < 15000, and 30 for MSC >= 15000
  const ec = msc >= 15000 ? 30 : 10;

  const ee = Math.round(msc * SSS_EMPLOYEE_RATE * 100) / 100;
  const er = Math.round((msc * SSS_EMPLOYER_RATE + ec) * 100) / 100;

  return {
    msc,
    employee: ee,
    employer: er,
    total: Math.round((ee + er) * 100) / 100
  };
};

/**
 * Computes PhilHealth shares (5% total split 50/50).
 */
exports.computePhilHealth = (dailyRate) => {
  const monthly = dailyRate * 26;
  const clamped = Math.min(Math.max(monthly, 10000), 100000);
  const total = clamped * 0.05;
  const share = total / 2;

  return {
    employee: Math.round(share * 100) / 100,
    employer: Math.round(share * 100) / 100,
    total: Math.round(total * 100) / 100
  };
};

/**
 * Computes HDMF shares.
 * 2024-2026 Mandate: 2% of Monthly Fund Salary (capped at 10,000 MFS)
 * EE: 200 max, ER: 200 max (for income > 1,500)
 */
exports.computeHDMF = (dailyRate) => {
  const monthly = dailyRate ? dailyRate * 26 : 10001; // Default to above cap if not provided
  
  let eeRate = 0.02;
  let erRate = 0.02;
  
  if (monthly <= 1500) {
    eeRate = 0.01; // 1% for 1,500 and below
  }
  
  const mfs = Math.min(monthly, 10000);
  
  return {
    employee: Math.round(mfs * eeRate),
    employer: Math.round(mfs * erRate),
    total: Math.round(mfs * (eeRate + erRate))
  };
};

/**
 * Aggregates all monthly shares for user rate updates.
 */
exports.computeMonthlyShares = (dailyRate) => {
  const sss = exports.computeSSS(dailyRate);
  const ph = exports.computePhilHealth(dailyRate);
  const hdmf = exports.computeHDMF(dailyRate);

  return {
    sss_Share: sss.employee,
    philhealth_Share: ph.employee,
    hdmf_Share: hdmf.employee,
    employer_sss: sss.employer,
    employer_ph: ph.employer,
    employer_hdmf: hdmf.employer,
    msc: sss.msc
  };
};

/**
 * Computes Withholding Tax.
 */
exports.computePeriodTax = (grossPay, govtDeductionsTotal) => {
  const taxableIncome = grossPay - govtDeductionsTotal;
  let tax = 0;
  if (taxableIncome > 10417) {
    tax = (taxableIncome - 10417) * 0.15;
  }
  return Math.round(tax * 100) / 100;
};
