const { sequelize } = require("../config/sequelize");
const { QueryTypes } = require("sequelize");

exports.UserCreateRequest = async (req, res) => {
  const {
    userId,
    user_Id,
    emp_reqTypeId,
    OT_Dateof,
    OT_DateOf,
    HrFrom,
    HrTo,
    Total_Hrs,
    reason,
    LeaveDate,
    NoDays,
    purpose,
    isWithPay,
    IsWithPay,
    proof_File,
    DateonField,
    DateOnField,
    NoHrs,
    destination,
  } = req.body || {};

  const finalUserId = userId || user_Id;
  const finalOTDate = OT_Dateof || OT_DateOf;
  const finalIsWithPay = isWithPay ?? IsWithPay ?? true;
  const finalDateOnField = DateonField || DateOnField;

  if (!finalUserId || !emp_reqTypeId) {
    return res
      .status(400)
      .json({ error: "User Id and Request Type are required" });
  }

  const todayStr = new Date().toISOString().split("T")[0];

  try {
    const parentResult = await sequelize.query(
      `INSERT INTO "emp_Request"
        ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "createdAt", "updatedAt")
        VALUES
        (:userId, :emp_reqTypeId, 1, :date_Filed, NOW(), NOW())
        RETURNING *`,
      {
        replacements: {
          userId: finalUserId,
          emp_reqTypeId,
          date_Filed: todayStr,
        },
        type: QueryTypes.INSERT,
      },
    );

    const newRequest = parentResult[0][0];
    const emp_reqId = newRequest.emp_reqId;

    let childData = null;

    // Overtime = 1
    if (emp_reqTypeId === 1) {
      if (!finalOTDate || !HrFrom || !HrTo || !Total_Hrs || !reason) {
        return res.status(400).json({ error: "Overtime fields are required" });
      }
      const otResult = await sequelize.query(
        `INSERT INTO "Overtime_Request" ("emp_reqId", "user_Id", "OT_DateOf", "HrFrom", "HrTo", "Total_Hrs", "reason") VALUES (:emp_reqId, :userId, :OT_DateOf, :HrFrom, :HrTo, :Total_Hrs, :reason) RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            OT_DateOf: finalOTDate,
            HrFrom,
            HrTo,
            Total_Hrs,
            reason,
          },
          type: QueryTypes.INSERT,
        },
      );

      childData = otResult[0][0];
    } else if (emp_reqTypeId === 2) {
      if (!finalDateOnField || !NoDays || !NoHrs) {
        return res
          .status(400)
          .json({ error: "Onfield Work fields are required" });
      }

      const onfieldResult = await sequelize.query(
        `INSERT INTO "Onfield_Work"
        ("emp_reqId", "user_Id", "DateonField", "NoDays", "NoHrs", "destination" , "proof_File")
        VALUES (:emp_reqId, :userId, :DateonField, :NoDays, :NoHrs, :destination, :proof_File)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            DateonField: finalDateOnField,
            NoDays,
            NoHrs,
            destination: destination || null,
            proof_File: proof_File || null,
          },
          type: QueryTypes.INSERT,
        },
      );
      childData = onfieldResult[0][0];
    } else if (emp_reqTypeId === 3) {
      if (!LeaveDate || !NoDays || !purpose) {
        return res.status(400).json({ error: "Leave fields are required" });
      }

      const currentYear = new Date().getFullYear();

      // Check if balance exists for the current year
      let balanceResult = await sequelize.query(
        `SELECT * FROM "Leave_Balance" WHERE "user_Id" = :userId and "year" = :year`,
        {
          replacements: { userId: finalUserId, year: currentYear },
          type: QueryTypes.SELECT,
        },
      );

      // If no balance exists for this year, initialize it with default (7)
      if (balanceResult.length === 0) {
        await sequelize.query(
          `INSERT INTO "Leave_Balance" ("user_Id", "year", "VL_balance", "SL_balance", "VL_used", "SL_used")
           VALUES (:userId, :year, 7, 7, 0, 0)`,
          {
            replacements: { userId: finalUserId, year: currentYear },
            type: QueryTypes.INSERT,
          },
        );
        // Re-fetch
        balanceResult = await sequelize.query(
          `SELECT * FROM "Leave_Balance" WHERE "user_Id" = :userId and "year" = :year`,
          {
            replacements: { userId: finalUserId, year: currentYear },
            type: QueryTypes.SELECT,
          },
        );
      }

      const balance = balanceResult[0];

      if (balance.VL_balance < NoDays) {
        return res.status(400).json({ error: "Insufficient leave balance" });
      }

      const vlResult = await sequelize.query(
        `INSERT INTO "Vacation_Leave"
        ("emp_reqId", "user_Id", "LeaveDate", "NoDays", "purpose", "isWithPay")
        VALUES (:emp_reqId, :userId, :LeaveDate, :NoDays, :purpose, :isWithPay)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            LeaveDate,
            NoDays,
            purpose,
            isWithPay: finalIsWithPay,
          },
          type: QueryTypes.INSERT,
        },
      );
      childData = vlResult[0][0];

      // Update Leave Balance for VL
      await sequelize.query(
        `UPDATE "Leave_Balance"
         SET "VL_balance" = "VL_balance" - :NoDays,
             "VL_used" = "VL_used" + :NoDays
         WHERE "user_Id" = :userId AND "year" = :year`,
        {
          replacements: {
            NoDays,
            userId: finalUserId,
            year: currentYear,
          },
          type: QueryTypes.UPDATE,
        },
      );
    } else if (emp_reqTypeId === 4) {
      if (!LeaveDate || !NoDays) {
        return res.status(400).json({ error: "Leave fields are required" });
      }

      const currentYear = new Date().getFullYear();

      // Check if balance exists for the current year
      let balanceResult = await sequelize.query(
        `SELECT * FROM "Leave_Balance" WHERE "user_Id" = :userId and "year" = :year`,
        {
          replacements: { userId: finalUserId, year: currentYear },
          type: QueryTypes.SELECT,
        },
      );

      // If no balance exists for this year, initialize it with default (7)
      if (balanceResult.length === 0) {
        await sequelize.query(
          `INSERT INTO "Leave_Balance" ("user_Id", "year", "VL_balance", "SL_balance", "VL_used", "SL_used")
           VALUES (:userId, :year, 7, 7, 0, 0)`,
          {
            replacements: { userId: finalUserId, year: currentYear },
            type: QueryTypes.INSERT,
          },
        );
        // Re-fetch
        balanceResult = await sequelize.query(
          `SELECT * FROM "Leave_Balance" WHERE "user_Id" = :userId and "year" = :year`,
          {
            replacements: { userId: finalUserId, year: currentYear },
            type: QueryTypes.SELECT,
          },
        );
      }

      const balance = balanceResult[0];

      if (balance.SL_balance < NoDays) {
        return res
          .status(400)
          .json({ error: "Insufficient Sick leave balance" });
      }

      const slResult = await sequelize.query(
        `INSERT INTO "Sick_Leave"
        ("emp_reqId", "user_Id", "LeaveDate", "NoDays", "proof_File", "isWithPay")
        VALUES (:emp_reqId, :userId, :LeaveDate, :NoDays, :proof_File, :isWithPay)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            LeaveDate,
            NoDays,
            proof_File: proof_File || null,
            isWithPay: finalIsWithPay,
          },
          type: QueryTypes.INSERT,
        },
      );
      childData = slResult[0][0];

      // Update Leave Balance for SL
      await sequelize.query(
        `UPDATE "Leave_Balance"
         SET "SL_balance" = "SL_balance" - :NoDays,
             "SL_used" = "SL_used" + :NoDays
         WHERE "user_Id" = :userId AND "year" = :year`,
        {
          replacements: {
            NoDays,
            userId: finalUserId,
            year: currentYear,
          },
          type: QueryTypes.UPDATE,
        },
      );
    } else {
      return res.status(400).json({ error: "Invalid Request Type" });
    }

    return res.status(200).json({
      message: "Request created successfully",
      data: {
        request: newRequest,
        details: childData,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
