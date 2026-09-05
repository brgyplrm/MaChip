/**
 * financialHelper.js
 * Standard Amortization Formula and SSS/Pag-IBIG specific loan logic.
 */

/**
 * Calculates fixed monthly amortization using the Diminishing Balance Method.
 * Formula: M = P [ i(1 + i)^n ] / [ (1 + i)^n – 1 ]
 * @param {number} P - Principal (Loan Amount)
 * @param {number} annualRate - Annual Interest Rate (e.g., 0.10 for 10%)
 * @param {number} n - Term in months (e.g., 24)
 */
exports.calculateAmortization = (P, annualRate, n) => {
  if (!annualRate || annualRate === 0) {
    return Math.round((P / n) * 100) / 100;
  }
  const i = annualRate / 12; // Monthly interest rate
  const monthlyAmort = P * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  return Math.round(monthlyAmort * 100) / 100;
};

/**
 * Generates a full amortization schedule split by interest and principal.
 */
exports.generateSchedule = (P, annualRate, n) => {
  const i = annualRate / 12;
  const M = exports.calculateAmortization(P, annualRate, n);
  let balance = P;
  const schedule = [];

  for (let month = 1; month <= n; month++) {
    const interest = Math.round((balance * i) * 100) / 100;
    const principal = Math.round((M - interest) * 100) / 100;
    balance = Math.max(0, Math.round((balance - principal) * 100) / 100);

    schedule.push({
      month,
      totalPayment: M,
      interestPortion: interest,
      principalPortion: principal,
      remainingBalance: balance
    });
  }

  return schedule;
};

/**
 * SSS Pro-rated interest calculation.
 * Formula: Loan Amount * Rate * (Days / 365)
 */
exports.calculateSSSRatedInterest = (amount, rate, grantDate) => {
  const date = new Date(grantDate);
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const daysRemaining = lastDayOfMonth - date.getDate();
  
  const proRated = (amount * rate * daysRemaining) / 365;
  return Math.round(proRated * 100) / 100;
};
