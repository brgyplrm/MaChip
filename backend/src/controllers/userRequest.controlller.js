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
    StartDate,
    EndDate,
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
        ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "createdAt", "updatedAt")
        VALUES
        (:userId, :emp_reqTypeId, 1, :date_Filed, :remarks, NOW(), NOW())
        RETURNING *`,
      {
        replacements: {
          userId: finalUserId,
          emp_reqTypeId,
          date_Filed: todayStr,
          remarks: reason || purpose || null,
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

      // Onfield Work
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

      // Leave Request
    } else if (emp_reqTypeId === 3) {
      if (!StartDate || !EndDate || !NoDays || !purpose) {
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
        ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "purpose", "isWithPay")
        VALUES (:emp_reqId, :userId, :StartDate, :EndDate, :NoDays, :purpose, :isWithPay)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            StartDate,
            EndDate,
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
      if (!StartDate || !EndDate || !NoDays) {
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
        ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "proof_File", "isWithPay")
        VALUES (:emp_reqId, :userId, :StartDate, :EndDate, :NoDays, :proof_File, :isWithPay)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            StartDate,
            EndDate,
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

exports.GetUserRequests = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "User Id is required" });
  }

  try {
    const requests = await sequelize.query(
      `SELECT 
        er."emp_reqId",
        er."user_Id",
        er."emp_reqTypeId",
        rt."reqTypeName",
        er."emp_reqStatusId",
        rs."reqStatName" as "status",
        er."date_Filed",
        er."date_Processed",
        er.remarks,
        er.admin_remarks,
        ot."OT_DateOf",
        ot."HrFrom",
        ot."HrTo",
        ot."Total_Hrs",
        vl."StartDate" as "VL_StartDate",
        vl."EndDate" as "VL_EndDate",
        vl."NoDays" as "VL_NoDays",
        sl."StartDate" as "SL_StartDate",
        sl."EndDate" as "SL_EndDate",
        sl."NoDays" as "SL_NoDays",
        ow."DateonField",
        ow."NoDays" as "OW_NoDays",
        ow."NoHrs" as "OW_NoHrs"
      FROM "emp_Request" er
      LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
      LEFT JOIN "request_Status" rs ON er."emp_reqStatusId" = rs."reqStatId"
      LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
      LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
      LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      WHERE er."user_Id" = :userId
      ORDER BY er."date_Filed" DESC`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    );

    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.GetAllRequests = async (req, res) => {
  console.log("[DEBUG] Fetching all requests for admin...");
  try {
    const requests = await sequelize.query(
      `SELECT 
        er."emp_reqId",
        er."user_Id",
        u."user_FirstName" || ' ' || u."user_LastName" as "userName",
        er."emp_reqTypeId",
        rt."reqTypeName",
        er."emp_reqStatusId",
        rs."reqStatName" as "status",
        er."date_Filed",
        er."date_Processed",
        er.remarks,
        er.admin_remarks,
        ot."OT_DateOf",
        ot."HrFrom",
        ot."HrTo",
        ot."Total_Hrs",
        vl."StartDate" as "VL_StartDate",
        vl."EndDate" as "VL_EndDate",
        vl."NoDays" as "VL_NoDays",
        vl."isWithPay" as "VL_isWithPay",
        sl."StartDate" as "SL_StartDate",
        sl."EndDate" as "SL_EndDate",
        sl."NoDays" as "SL_NoDays",
        sl."proof_File" as "SL_proof_File",
        sl."isWithPay" as "SL_isWithPay",
        ow."DateonField",
        ow."NoDays" as "OW_NoDays",
        ow."NoHrs" as "OW_NoHrs",
        ow."destination",
        ow."proof_File" as "OW_proof_File"
      FROM "emp_Request" er
      INNER JOIN "User" u ON er."user_Id" = u."user_Id"
      LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
      LEFT JOIN "request_Status" rs ON er."emp_reqStatusId" = rs."reqStatId"
      LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
      LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
      LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      ORDER BY er."date_Filed" DESC`,
      {
        type: QueryTypes.SELECT,
      }
    );
    console.log(`[DEBUG] Found ${requests.length} requests.`);
    res.status(200).json(requests);
  } catch (error) {
    console.error("[DEBUG] Error fetching all requests:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.UpdateStatusRequest = async (req, res) => {
  const { emp_reqId, emp_reqStatusId, processedBy, remarks } = req.body;

  if (!emp_reqId || !emp_reqStatusId || !processedBy) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await sequelize.query(
      `UPDATE "emp_Request" 
       SET "emp_reqStatusId" = :emp_reqStatusId, 
           "processedBy" = :processedBy, 
           "date_Processed" = NOW(),
           "admin_remarks" = :admin_remarks
       WHERE "emp_reqId" = :emp_reqId`,
      {
        replacements: { emp_reqId, emp_reqStatusId, processedBy, admin_remarks: remarks || null },
        type: QueryTypes.UPDATE,
      }
    );

    res.status(200).json({ message: "Request status updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
