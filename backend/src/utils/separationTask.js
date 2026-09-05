const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatDateLocal } = require("./systemTime.js");
const { logTransaction } = require("./logger");

/**
 * Checks for separations whose effective date has arrived and processes them.
 */
async function processAutoSeparations() {
  const now = await getSystemTime();
  const todayStr = formatDateLocal(now);
  const nowStr = now.toISOString().replace('T', ' ').substring(0, 19);

  try {
    // 1. Find Separations that are Draft or Notice Served and have reached their date
    const pendingSeparations = await sequelize.query(
      `SELECT s."separationId", s."user_Id", s."separationDate", s."status"
       FROM "Payroll_Separation" s
       WHERE s."status" IN ('Draft', 'Notice Served')
         AND s."separationDate" <= :todayStr`,
      { replacements: { todayStr }, type: QueryTypes.SELECT }
    );

    if (pendingSeparations.length === 0) return;

    console.log(`[SEPARATION-TASK] Processing ${pendingSeparations.length} auto-separations...`);

    for (const sep of pendingSeparations) {
      const t = await sequelize.transaction();
      try {
        const { separationId, user_Id } = sep;

        // 1. Update Separation Record
        await sequelize.query(
          `UPDATE "Payroll_Separation" 
           SET "status" = 'Released', "releasedAt" = :now, "updatedAt" = :now 
           WHERE "separationId" = :separationId`,
          { replacements: { separationId, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
        );

        // 2. Update User Status to 'Separated' (5)
        await sequelize.query(
          `UPDATE "User" SET "user_EmploymentStatusId" = 5, "updatedAt" = :now WHERE "user_Id" = :user_Id`,
          { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
        );

        // 3. Soft Delete User (Paranoid)
        await sequelize.query(
          `UPDATE "User" SET "deletedAt" = :now WHERE "user_Id" = :user_Id`,
          { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
        );

        // 4. Settle Outstanding Loans (Mandatory per SSS rules)
        await sequelize.query(
          `UPDATE "Loan_Deductions" 
           SET "status" = 'completed', 
               "remainingBalance" = 0, 
               "notes" = CONCAT("notes", ' | Settled in full via Auto-Separation on ', :now),
               "updatedAt" = :now 
           WHERE "userId" = :user_Id AND "status" = 'active'`,
          { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
        );

        // 5. Void all Pending (1) or Recommended (4) requests
        await sequelize.query(
          `UPDATE "emp_Request" 
           SET "emp_reqStatusId" = 3, 
               "admin_remarks" = 'Voided automatically due to employee auto-separation.',
               "date_Processed" = :now,
               "updatedAt" = :now
           WHERE "user_Id" = :user_Id AND "emp_reqStatusId" IN (1, 4)`,
          { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
        );

        await t.commit();
        console.log(`[SEPARATION-TASK] Auto-released separation #${separationId} for user ${user_Id}`);
        
        // Log the transaction (System initiated)
        await logTransaction(null, 1, "SEPARATION_AUTO_RELEASE", 
          `System automatically released separation pay and archived user ${user_Id} on separation date ${sep.separationDate}`, 
          { separationId, user_Id });

      } catch (err) {
        await t.rollback();
        console.error(`[SEPARATION-TASK ERROR] Failed to auto-release separation #${sep.separationId}:`, err.message);
      }
    }

    // 2. Find Retirements that are Draft and have reached their date
    const pendingRetirements = await sequelize.query(
      `SELECT r."retirementId", r."user_Id", r."retirementDate", r."status"
       FROM "Payroll_Retirement" r
       WHERE r."status" = 'Draft'
         AND r."retirementDate" <= :todayStr`,
      { replacements: { todayStr }, type: QueryTypes.SELECT }
    );

    for (const ret of pendingRetirements) {
      const t = await sequelize.transaction();
      try {
        const { retirementId, user_Id } = ret;

        // 1. Update Retirement Record
        await sequelize.query(
          `UPDATE "Payroll_Retirement" 
           SET "status" = 'Released', "releasedAt" = :now, "updatedAt" = :now 
           WHERE "retirementId" = :retirementId`,
          { replacements: { retirementId, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
        );

        // 2. Update User Status to 'Retired' (6)
        await sequelize.query(
          `UPDATE "User" SET "user_EmploymentStatusId" = 6, "deletedAt" = :now, "updatedAt" = :now WHERE "user_Id" = :user_Id`,
          { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
        );

        await t.commit();
        console.log(`[SEPARATION-TASK] Auto-released retirement #${retirementId} for user ${user_Id}`);
        
        // Log the transaction
        await logTransaction(null, 1, "RETIREMENT_AUTO_RELEASE", 
          `System automatically released retirement pay and archived user ${user_Id} on retirement date ${ret.retirementDate}`, 
          { retirementId, user_Id });

      } catch (err) {
        await t.rollback();
        console.error(`[SEPARATION-TASK ERROR] Failed to auto-release retirement #${ret.retirementId}:`, err.message);
      }
    }

  } catch (error) {
    console.error("[SEPARATION-TASK CRITICAL ERROR]:", error.message);
  }
}

module.exports = { processAutoSeparations };
