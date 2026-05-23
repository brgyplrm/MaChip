const { sequelize } = require("../config/sequelize");
const { QueryTypes } = require("sequelize");
const { getSystemTime } = require("./systemTime");

/**
 * Initializes or resets leave balances for all active users for the current year.
 * This ensures that every employee (and specifically Solo Parents) gets their 
 * annual credits on January 1st or upon system startup if missing.
 * Solo Parent Leave: 7 days, non-convertible, resets annually.
 * Vacation Leave: 7 days default (per project context).
 * Sick Leave: 7 days default (per project context).
 */
const initializeAnnualLeaveBalances = async () => {
  const t = await sequelize.transaction();
  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();

    console.log(`[LEAVE-SYNC] Verifying annual leave balances for ${currentYear}...`);

    // 1. Fetch all active users who don't have a balance record for the current year
    const usersWithoutBalance = await sequelize.query(
      `SELECT u."user_Id", u."is_solo_parent" 
       FROM "User" u
       LEFT JOIN "Leave_Balance" lb ON u."user_Id" = lb."user_Id" AND lb."year" = :currentYear
       WHERE u."deletedAt" IS NULL AND lb."lb_Id" IS NULL`,
      {
        replacements: { currentYear },
        type: QueryTypes.SELECT,
        transaction: t
      }
    );

    if (usersWithoutBalance.length === 0) {
      console.log(`[LEAVE-SYNC] All active users already have balance records for ${currentYear}.`);
      await t.rollback();
      return;
    }

    console.log(`[LEAVE-SYNC] Initializing balances for ${usersWithoutBalance.length} users...`);

    for (const user of usersWithoutBalance) {
      // Default credits: VL=7, SL=7, SoloParent=7 if eligible, else 0
      const soloParentCredit = user.is_solo_parent ? 7 : 0;
      
      await sequelize.query(
        `INSERT INTO "Leave_Balance" 
         ("user_Id", "year", "VL_balance", "SL_balance", "SoloParent_balance", "VL_used", "SL_used", "SoloParent_used", "createdAt", "updatedAt")
         VALUES (:userId, :year, 7, 7, :soloParentCredit, 0, 0, 0, NOW(), NOW())`,
        {
          replacements: { 
            userId: user.user_Id, 
            year: currentYear, 
            soloParentCredit 
          },
          type: QueryTypes.INSERT,
          transaction: t
        }
      );
    }

    await t.commit();
    console.log(`[LEAVE-SYNC] Successfully initialized leave balances for ${currentYear}.`);
  } catch (error) {
    if (t) await t.rollback();
    console.error("[LEAVE-SYNC ERROR]:", error.message);
  }
};

module.exports = { initializeAnnualLeaveBalances };
