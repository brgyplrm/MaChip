const { sequelize } = require("./src/config/sequelize.js");
const { QueryTypes } = require("sequelize");

async function fixRequest16() {
  try {
    console.log("Migrating Request #16 to the new 'SSS Calamity' category...");

    // 1. Update the master Loan_Deductions record
    const [res] = await sequelize.query(
      `UPDATE "Loan_Deductions" 
       SET "deductionType" = 'calamity'
       WHERE "notes" LIKE '%Request #16%' AND "deductionType" = 'sss_loan'`,
      { type: QueryTypes.UPDATE }
    );
    
    // 2. Update the ledger records in Payroll_GovernmentLoans
    // We only want to update the records that belong to the Calamity loan
    // Since they collided, both loans might have generated overlapping dates
    // For safety, we will just delete the overlapping future SSS records and regenerate the Calamity ones
    
    const userId = 3; 
    const now = new Date().toISOString();

    // The Calamity Loan was 20,000 / 24 months = ~833.33 / 2 = 416.66 per cutoff (or whatever the user approved)
    // We will fetch the actual perCutoff from the Loan_Deductions table
    const loans = await sequelize.query(
      `SELECT "id", "deductionPerCutoff", "contractDate", "monthsToPay" FROM "Loan_Deductions" WHERE "notes" LIKE '%Request #16%'`,
      { type: QueryTypes.SELECT }
    );

    if (loans.length > 0) {
      const calamityLoan = loans[0];
      const perCutoff = calamityLoan.deductionPerCutoff;
      const months = calamityLoan.monthsToPay;
      
      // Parse the start date
      const contractDate = new Date(calamityLoan.contractDate);
      const startYear = contractDate.getFullYear();
      const startMonth = contractDate.getMonth();

      // Clear ONLY the Calamity-specific amount from the SSS ledger if it was added?
      // Since it was an ON CONFLICT DO NOTHING, the Calamity ledger inserts actually FAILED to overwrite the Salary loan inserts.
      // This means the Calamity ledger records DO NOT EXIST YET in the database!
      // We just need to insert them under the correct 'SSS Calamity' government_type.
      
      for (let i = 0; i < months; i++) {
        const loopDate = new Date(startYear, startMonth + i, 1);
        const year = loopDate.getFullYear();
        const month = loopDate.getMonth();

        const dates = [
          `${year}-${String(month + 1).padStart(2, '0')}-15`,
          `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`
        ];

        for (const d of dates) {
          await sequelize.query(
            `INSERT INTO "Payroll_GovernmentLoans" ("user_Id", "government_type", "date", "amount", "createdAt", "updatedAt")
             VALUES (:userId, 'SSS Calamity', :date, :amount, :now, :now)
             ON CONFLICT ("user_Id", "date", "government_type") DO UPDATE SET "amount" = EXCLUDED."amount"`,
            { replacements: { userId, date: d, amount: perCutoff, now } }
          );
        }
      }
      console.log("Successfully migrated Request #16 to the SSS Calamity ledger!");
    } else {
      console.log("Could not find Request #16 in Loan_Deductions.");
    }
    
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
}

fixRequest16();
