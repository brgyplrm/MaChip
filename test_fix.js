const govtDeductions = require("./backend/src/utils/govtDeductions");

const dailyRate = 35000.03 / 26; // approx daily rate for Rodrigo

const problematicMatrix = {
  sss: {
    employee_rate: 0.14
  },
  hdmf: {
    er_rate: 0.02,
    ee_rate_high: 0.02
  },
  philhealth: {
    rate: 0.05
  }
};

console.log("Testing with problematic matrix...");
const results = govtDeductions.computeMonthlyShares(dailyRate, problematicMatrix);
console.log("Results:", JSON.stringify(results, null, 2));

const hasNaN = Object.values(results).some(val => isNaN(val));
if (hasNaN) {
  console.error("FAIL: Result contains NaN");
} else {
  console.log("SUCCESS: No NaN values found");
}
