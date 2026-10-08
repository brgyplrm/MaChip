/**
 * financialHelper.js
 * High-precision monetary utilities and loan amortization logic.
 * Enforces integer-centavo arithmetic to prevent IEEE-754 floating-point drift in payroll.
 */

/**
 * Converts a monetary value (number or formatted string) to integer centavos.
 * Handles commas, whitespace, null/undefined, and strings cleanly.
 * @param {number|string} amount
 * @returns {number} Integer centavos
 */
const toCents = (amount) => {
  if (amount === null || amount === undefined || amount === "") return 0;
  if (typeof amount === "number") {
    if (isNaN(amount) || !isFinite(amount)) return 0;
    return Math.round(amount * 100);
  }
  const cleanStr = String(amount).replace(/,/g, "").trim();
  const num = parseFloat(cleanStr);
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num * 100);
};

/**
 * Converts integer centavos back to two-decimal precision.
 * @param {number} cents
 * @param {boolean} asString - When true, returns "123.45"; when false, returns 123.45
 * @returns {number|string}
 */
const fromCents = (cents, asString = false) => {
  if (cents === null || cents === undefined || isNaN(cents)) cents = 0;
  const fixed = (cents / 100).toFixed(2);
  return asString ? fixed : parseFloat(fixed);
};

/**
 * Exact monetary rounding to 2 decimal places.
 * @param {number|string} amount
 * @returns {number}
 */
const roundMoney = (amount) => fromCents(toCents(amount));

/**
 * Exact monetary addition across any number of operands without float drift.
 * @param  {...(number|string)} amounts
 * @returns {number}
 */
const addMoney = (...amounts) => {
  const totalCents = amounts.reduce((acc, curr) => acc + toCents(curr), 0);
  return fromCents(totalCents);
};

/**
 * Exact monetary subtraction: (initial - deduction1 - deduction2 - ...)
 * @param {number|string} initial
 * @param {...(number|string)} deductions
 * @returns {number}
 */
const subtractMoney = (initial, ...deductions) => {
  const initCents = toCents(initial);
  const totalDedCents = deductions.reduce((acc, curr) => acc + toCents(curr), 0);
  return fromCents(initCents - totalDedCents);
};

/**
 * Exact monetary multiplication: amount * multiplier rounded to nearest centavo.
 * @param {number|string} amount
 * @param {number} multiplier
 * @returns {number}
 */
const multiplyMoney = (amount, multiplier) => {
  if (!multiplier || isNaN(multiplier)) return 0;
  const cents = toCents(amount);
  const resultCents = Math.round(cents * multiplier);
  return fromCents(resultCents);
};

/**
 * Exact monetary division: amount / divisor rounded to nearest centavo.
 * @param {number|string} amount
 * @param {number} divisor
 * @returns {number}
 */
const divideMoney = (amount, divisor) => {
  if (!divisor || divisor === 0 || isNaN(divisor)) return 0;
  const cents = toCents(amount);
  const resultCents = Math.round(cents / divisor);
  return fromCents(resultCents);
};

/**
 * Calculates fixed monthly amortization using the Diminishing Balance Method.
 * Formula: M = P [ i(1 + i)^n ] / [ (1 + i)^n – 1 ]
 * @param {number} P - Principal (Loan Amount)
 * @param {number} annualRate - Annual Interest Rate (e.g., 0.10 for 10%)
 * @param {number} n - Term in months (e.g., 24)
 * @returns {number}
 */
const calculateAmortization = (P, annualRate, n) => {
  const principalCents = toCents(P);
  if (principalCents <= 0 || !n || n <= 0) return 0;

  if (!annualRate || annualRate === 0) {
    return divideMoney(P, n);
  }
  const i = annualRate / 12; // Monthly interest rate
  const factor = Math.pow(1 + i, n);
  const monthlyAmort = (principalCents / 100) * (i * factor) / (factor - 1);
  return fromCents(Math.round(monthlyAmort * 100));
};

/**
 * Generates a full amortization schedule split by interest and principal.
 */
const generateSchedule = (P, annualRate, n) => {
  const i = annualRate / 12;
  const M = calculateAmortization(P, annualRate, n);
  let balanceCents = toCents(P);
  const mCents = toCents(M);
  const schedule = [];

  for (let month = 1; month <= n; month++) {
    const interestCents = Math.round((balanceCents / 100) * i * 100);
    let principalCents = mCents - interestCents;
    if (principalCents > balanceCents || month === n) {
      principalCents = balanceCents;
    }
    balanceCents = Math.max(0, balanceCents - principalCents);

    schedule.push({
      month,
      totalPayment: fromCents(principalCents + interestCents),
      interestPortion: fromCents(interestCents),
      principalPortion: fromCents(principalCents),
      remainingBalance: fromCents(balanceCents)
    });
  }

  return schedule;
};

/**
 * SSS Pro-rated interest calculation.
 * Formula: Loan Amount * Rate * (Days / 365)
 */
const calculateSSSRatedInterest = (amount, rate, grantDate) => {
  const date = new Date(grantDate);
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const daysRemaining = lastDayOfMonth - date.getDate();
  
  const proRated = (toCents(amount) / 100 * rate * daysRemaining) / 365;
  return fromCents(Math.round(proRated * 100));
};

module.exports = {
  toCents,
  fromCents,
  roundMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  calculateAmortization,
  generateSchedule,
  calculateSSSRatedInterest
};

