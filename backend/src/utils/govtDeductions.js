/**
 * Government Deductions Logic for Philippines (2025/2026)
 * Replicates the Mac-J Excel Format and RA Mandates.
 * 
 * NOTE: Values here are FALLBACKS. The system primarily uses SystemSettings.payrollRates.statutoryConstants.
 */

const FALLBACK_CONFIG = {
  sss: {
    employer_rate: 0.10,
    employee_rate: 0.05,
    msc_floor: 5000,
    msc_ceiling: 35000,
    ec_threshold: 15000,
    ec_low: 10,
    ec_high: 30
  },
  philhealth: {
    rate: 0.05,
    floor: 10000,
    ceiling: 100000,
    share_ratio: 0.50
  },
  hdmf: {
    ee_rate_low: 0.01,
    ee_rate_high: 0.02,
    er_rate: 0.02,
    ceiling: 10000,
    threshold: 1500
  }
};

/**
 * Helper to get the active configuration from DB or Fallback.
 */
async function getActiveConfig() {
  try {
    const { SystemSettings } = require("../config/sequelize.js");
    const settings = await SystemSettings.findOne();
    
    // Check all possible locations for statutoryConstants
    if (settings?.payroll) {
      return settings.payroll;
    }
    if (settings?.payrollRates?.statutoryConstants) {
      return settings.payrollRates.statutoryConstants;
    }
    if (settings?.statutoryConstants) {
      return settings.statutoryConstants;
    }
  } catch (err) {
    console.warn("[DEDUCTIONS] Failed to fetch DB config, using fallbacks.");
  }
  return FALLBACK_CONFIG;
}

/**
 * Computes SSS shares based on Monthly Salary Credit (MSC).
 */
exports.computeSSS = (dailyRate, matrix = null) => {
  const conf = { ...FALLBACK_CONFIG.sss, ...(matrix?.sss || {}) };
  
  const monthly = dailyRate * 26;
  const msc = Math.min(Math.max(Math.round(monthly / 500) * 500, conf.msc_floor), conf.msc_ceiling);

  // SSS EC logic
  const ec = msc >= conf.ec_threshold ? conf.ec_high : conf.ec_low;

  const ee = Math.round(msc * conf.employee_rate * 100) / 100;
  const er = Math.round((msc * conf.employer_rate + ec) * 100) / 100;

  return {
    msc,
    employee: ee,
    employer: er,
    total: Math.round((ee + er) * 100) / 100
  };
};

/**
 * Computes PhilHealth shares (typically 5% total split 50/50).
 */
exports.computePhilHealth = (dailyRate, matrix = null) => {
  const conf = { ...FALLBACK_CONFIG.philhealth, ...(matrix?.philhealth || {}) };

  const monthly = dailyRate * 26;
  const clamped = Math.min(Math.max(monthly, conf.floor), conf.ceiling);
  const total = clamped * conf.rate;
  const eeShare = total * conf.share_ratio;
  const erShare = total - eeShare;

  return {
    employee: Math.round(eeShare * 100) / 100,
    employer: Math.round(erShare * 100) / 100,
    total: Math.round(total * 100) / 100
  };
};

/**
 * Computes HDMF shares.
 */
exports.computeHDMF = (dailyRate, matrix = null) => {
  const conf = { ...FALLBACK_CONFIG.hdmf, ...(matrix?.hdmf || {}) };
  const monthly = dailyRate ? dailyRate * 26 : (conf.ceiling + 1); 
  
  let eeRate = conf.ee_rate_high;
  if (monthly <= conf.threshold) {
    eeRate = conf.ee_rate_low;
  }
  
  const mfs = Math.min(monthly, conf.ceiling);
  
  return {
    employee: Math.round(mfs * eeRate),
    employer: Math.round(mfs * conf.er_rate),
    total: Math.round(mfs * (eeRate + conf.er_rate))
  };
};

/**
 * Aggregates all monthly shares for user rate updates.
 */
exports.computeMonthlyShares = (dailyRate, matrix = null) => {
  const sss = exports.computeSSS(dailyRate, matrix);
  const ph = exports.computePhilHealth(dailyRate, matrix);
  const hdmf = exports.computeHDMF(dailyRate, matrix);

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
 * Async version for dynamic DB lookup during payroll runs.
 */
exports.computeMonthlySharesAsync = async (dailyRate) => {
  const matrix = await getActiveConfig();
  return exports.computeMonthlyShares(dailyRate, matrix);
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
