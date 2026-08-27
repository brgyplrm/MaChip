/**
 * Government Deductions Logic for Philippines (Dynamic DB-driven)
 * Replicates the Mac-J Excel Format and RA Mandates.
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

const getCutoffDateStr = (dateVal) => {
  if (!dateVal) return new Date().toISOString().split("T")[0];
  if (dateVal instanceof Date) {
    // Offset local timezone to prevent date shifts
    const offset = dateVal.getTimezoneOffset();
    const localDate = new Date(dateVal.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split("T")[0];
  }
  return String(dateVal).split(" ")[0].split("T")[0];
};

/**
 * Computes SSS shares dynamically from DB or fallback.
 */
exports.computeSSSAsync = async (dailyRate, periodEndDate = null) => {
  const dateStr = getCutoffDateStr(periodEndDate);
  const monthly = dailyRate * 26;

  try {
    const { SSS_ContributionTable } = require("../config/sequelize.js");
    const { Op } = require("sequelize");

    // Fetch SSS brackets for the effective date
    const brackets = await SSS_ContributionTable.findAll({
      where: {
        effectiveDate: { [Op.lte]: dateStr },
        isActive: true
      },
      order: [["effectiveDate", "DESC"], ["range_Min", "ASC"]]
    });

    if (brackets && brackets.length > 0) {
      // Group brackets by their latest effectiveDate
      const latestEffectiveDate = brackets[0].effectiveDate;
      const activeBrackets = brackets.filter(b => b.effectiveDate === latestEffectiveDate);

      // Find matching bracket
      let match = activeBrackets.find(b => monthly >= b.range_Min && monthly <= b.range_Max);
      if (!match) {
        // Fallback to highest bracket if monthly exceeds all limits
        match = activeBrackets[activeBrackets.length - 1];
      }

      return {
        msc: match.monthlySalaryCredit,
        employee: match.ee_SS + match.ee_Provident,
        employer: match.er_SS + match.er_Provident + match.er_EC,
        total: Math.round((match.ee_SS + match.ee_Provident + match.er_SS + match.er_Provident + match.er_EC) * 100) / 100
      };
    }
  } catch (err) {
    console.warn("[DEDUCTIONS] Failed to compute SSS from DB, using fallback:", err.message);
  }

  // Fallback calculations
  const conf = FALLBACK_CONFIG.sss;
  const msc = Math.min(Math.max(Math.round(monthly / 500) * 500, conf.msc_floor), conf.msc_ceiling);
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
 * Computes PhilHealth shares dynamically from DB or fallback.
 */
exports.computePhilHealthAsync = async (dailyRate, periodEndDate = null) => {
  const dateStr = getCutoffDateStr(periodEndDate);
  const monthly = dailyRate * 26;

  try {
    const { Philhealth_ContributionTable } = require("../config/sequelize.js");
    const { Op } = require("sequelize");

    // Fetch the active PhilHealth table configuration
    const brackets = await Philhealth_ContributionTable.findAll({
      where: {
        effectiveDate: { [Op.lte]: dateStr },
        isActive: true
      },
      order: [["effectiveDate", "DESC"], ["range_Min", "ASC"]]
    });

    if (brackets && brackets.length > 0) {
      // Group brackets by their latest effectiveDate
      const latestEffectiveDate = brackets[0].effectiveDate;
      const activeBrackets = brackets.filter(b => b.effectiveDate === latestEffectiveDate);

      let clamped = monthly;
      let match;

      if (activeBrackets.length === 1) {
        // Single row config (floor/ceiling bounds in one row)
        const conf = activeBrackets[0];
        clamped = Math.min(Math.max(monthly, conf.range_Min), conf.range_Max);
        match = conf;
      } else {
        // Multi-row bracket schedule matching official format
        match = activeBrackets.find(b => monthly >= b.range_Min && monthly <= b.range_Max);
        if (!match) {
          match = activeBrackets[activeBrackets.length - 1];
        }

        if (match === activeBrackets[0]) {
          clamped = match.range_Max; // Floor value (e.g. 10000)
        } else if (match === activeBrackets[activeBrackets.length - 1]) {
          clamped = match.range_Min; // Ceiling value (e.g. 100000)
        } else {
          clamped = monthly; // Actual salary in middle range
        }
      }

      const total = clamped * match.rate;
      const eeShare = total * match.employeeShareRatio;
      const erShare = total - eeShare;

      return {
        employee: Math.round(eeShare * 100) / 100,
        employer: Math.round(erShare * 100) / 100,
        total: Math.round(total * 100) / 100
      };
    }
  } catch (err) {
    console.warn("[DEDUCTIONS] Failed to compute PhilHealth from DB, using fallback:", err.message);
  }

  // Fallback calculation
  const conf = FALLBACK_CONFIG.philhealth;
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
 * Computes HDMF (Pag-IBIG) shares dynamically from DB or fallback.
 */
exports.computeHDMFAsync = async (dailyRate, periodEndDate = null) => {
  const dateStr = getCutoffDateStr(periodEndDate);
  const monthly = dailyRate * 26;

  try {
    const { PagIBIG_ContributionTable } = require("../config/sequelize.js");
    const { Op } = require("sequelize");

    // Fetch active Pag-IBIG brackets
    const brackets = await PagIBIG_ContributionTable.findAll({
      where: {
        effectiveDate: { [Op.lte]: dateStr },
        isActive: true
      },
      order: [["effectiveDate", "DESC"], ["range_Min", "ASC"]]
    });

    if (brackets && brackets.length > 0) {
      const latestEffectiveDate = brackets[0].effectiveDate;
      const activeBrackets = brackets.filter(b => b.effectiveDate === latestEffectiveDate);

      let match = activeBrackets.find(b => monthly >= b.range_Min && monthly <= b.range_Max);
      if (!match) {
        match = activeBrackets[activeBrackets.length - 1];
      }

      const mfs = Math.min(monthly, match.contributionCeiling);
      return {
        employee: Math.round(mfs * match.ee_Rate * 100) / 100,
        employer: Math.round(mfs * match.er_Rate * 100) / 100,
        total: Math.round(mfs * (match.ee_Rate + match.er_Rate) * 100) / 100
      };
    }
  } catch (err) {
    console.warn("[DEDUCTIONS] Failed to compute HDMF from DB, using fallback:", err.message);
  }

  // Fallback calculation
  const conf = FALLBACK_CONFIG.hdmf;
  let eeRate = monthly <= conf.threshold ? conf.ee_rate_low : conf.ee_rate_high;
  const mfs = Math.min(monthly, conf.ceiling);

  return {
    employee: Math.round(mfs * eeRate),
    employer: Math.round(mfs * conf.er_rate),
    total: Math.round(mfs * (eeRate + conf.er_rate))
  };
};

/**
 * Aggregates all monthly shares dynamically based on the cutoff date.
 */
exports.computeMonthlySharesAsync = async (dailyRate, periodEndDate = null) => {
  const sss = await exports.computeSSSAsync(dailyRate, periodEndDate);
  const ph = await exports.computePhilHealthAsync(dailyRate, periodEndDate);
  const hdmf = await exports.computeHDMFAsync(dailyRate, periodEndDate);

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

exports.computeMonthlyShares = async (dailyRate, periodEndDate = null) => {
  return await exports.computeMonthlySharesAsync(dailyRate, periodEndDate);
};

/**
 * Computes Withholding Tax dynamically based on the BIR Monthly Tax Table.
 * Supports both standard BIR Annualization Projection (Mode 1) and Direct Cutoff Evaluation (Mode 2).
 * 
 * -----------------------------------------------------------------------------
 * CAPSTONE & CLIENT CONFIRMATION OPTIONS:
 * -----------------------------------------------------------------------------
 * MODE 1 (USE_MONTHLY_PROJECTION = true) [BIR Standard / TRAIN Law Mandate]:
 *   - Projected Monthly Taxable Income = Period Taxable Income * 2
 *   - Evaluated against Official Monthly BIR Tax Brackets.
 *   - Computed Monthly Tax is divided by 2 for each semi-monthly cutoff (15th & 30th/31st).
 *   - Prevents tax evasion and ensures accurate annual withholding tax equalization.
 * 
 * MODE 2 (USE_MONTHLY_PROJECTION = false) [Direct Cutoff Evaluation]:
 *   - Period Taxable Income is evaluated directly against Monthly BIR Tax Brackets per cutoff.
 *   - (If client explicitly requests assessing cutoff income directly against monthly limits).
 * -----------------------------------------------------------------------------
 */
const USE_MONTHLY_PROJECTION = false; // Set to false if client confirms Direct Cutoff Evaluation

exports.computePeriodTaxAsync = async (grossPay, govtDeductionsTotal, periodEndDate = null, periodStartDate = null) => {
  const periodTaxableIncome = grossPay - govtDeductionsTotal;
  if (periodTaxableIncome <= 0) return 0;

  const dateStr = getCutoffDateStr(periodEndDate);

  // Determine period frequency (semi-monthly or monthly) from period duration
  let periodType = "semi-monthly";
  if (periodStartDate) {
    const start = new Date(periodStartDate);
    const end = new Date(periodEndDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 20) {
      periodType = "monthly";
    }
  }

  // Monthly Equivalent Taxable Income (Mode 1 vs Mode 2)
  const isSemiMonthly = (periodType === "semi-monthly");
  const monthlyTaxable = (isSemiMonthly && USE_MONTHLY_PROJECTION) 
    ? (periodTaxableIncome * 2) 
    : periodTaxableIncome;

  try {
    const { WithholdingTax_Table } = require("../config/sequelize.js");
    const { Op } = require("sequelize");

    // Fetch active withholding tax brackets (prefers 'monthly' or latest active table)
    let brackets = await WithholdingTax_Table.findAll({
      where: {
        effectiveDate: { [Op.lte]: dateStr },
        isActive: true
      },
      order: [["effectiveDate", "DESC"], ["range_Min", "ASC"]]
    });

    if (brackets && brackets.length > 0) {
      const latestEffectiveDate = brackets[0].effectiveDate;
      let activeBrackets = brackets.filter(b => b.effectiveDate === latestEffectiveDate);
      
      // Filter for monthly periodType if present
      const monthlyBrackets = activeBrackets.filter(b => b.periodType === 'monthly');
      if (monthlyBrackets.length > 0) {
        activeBrackets = monthlyBrackets;
      }

      let match = activeBrackets.find(b => monthlyTaxable >= b.range_Min && monthlyTaxable <= b.range_Max);
      if (!match) {
        match = [...activeBrackets].reverse().find(b => monthlyTaxable >= b.range_Min);
        if (!match) {
          match = activeBrackets[0];
        }
      }

      const calculatedTax = match.baseTax + ((monthlyTaxable - match.excessOver) * match.excessRate);
      const periodTax = (isSemiMonthly && USE_MONTHLY_PROJECTION) ? (calculatedTax / 2) : calculatedTax;

      return Math.round(Math.max(0, periodTax) * 100) / 100;
    }
  } catch (err) {
    console.warn("[DEDUCTIONS] Failed to compute tax from DB, using standard fallback:", err.message);
  }

  // Standard TRAIN Law 2023+ Monthly Fallback calculation:
  // Bracket 1: 0 - 20,833 -> 0
  // Bracket 2: 20,833 - 33,332 -> 20% over 20,833
  // Bracket 3: 33,333 - 66,666 -> 2,500 + 25% over 33,333
  // Bracket 4: 66,667 - 166,666 -> 10,833.33 + 30% over 66,667
  // Bracket 5: 166,667 - 666,666 -> 40,833.33 + 32% over 166,667
  // Bracket 6: 666,667+ -> 200,833.33 + 35% over 666,667
  let calculatedTax = 0;
  if (monthlyTaxable > 666667) {
    calculatedTax = 200833.33 + (monthlyTaxable - 666667) * 0.35;
  } else if (monthlyTaxable > 166667) {
    calculatedTax = 40833.33 + (monthlyTaxable - 166667) * 0.32;
  } else if (monthlyTaxable > 66667) {
    calculatedTax = 10833.33 + (monthlyTaxable - 66667) * 0.30;
  } else if (monthlyTaxable > 33333) {
    calculatedTax = 2500.00 + (monthlyTaxable - 33333) * 0.25;
  } else if (monthlyTaxable > 20833) {
    calculatedTax = (monthlyTaxable - 20833) * 0.20;
  } else {
    calculatedTax = 0;
  }

  const periodTax = (isSemiMonthly && USE_MONTHLY_PROJECTION) ? (calculatedTax / 2) : calculatedTax;
  return Math.round(Math.max(0, periodTax) * 100) / 100;
};
