const { sequelize } = require("../config/sequelize");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatForSQL } = require("../utils/systemTime");

const { Holiday } = require("../config/sequelize.js");

exports.getCalendarReport = async (req, res) => {
  const { startDate, endDate, user_Id } = req.query;
  try {
    // 1. Fetch Holidays
    const holidays = await sequelize.query(
      `SELECT 'Holiday' as "type", "date", "name", "type" as "details"
       FROM "Holiday"
       WHERE "date" BETWEEN :startDate AND :endDate`,
      { replacements: { startDate, endDate }, type: QueryTypes.SELECT }
    );

    // 2. Fetch Field Work (Onfield_Work)
    let fieldWorkQuery = `
      SELECT 'Field Work' as "type", ow."date", u."user_FirstName" || ' ' || u."user_LastName" as "name", ow."location" || ' - ' || ow."purpose" as "details"
      FROM "Onfield_Work" ow
      JOIN "emp_Request" er ON ow."emp_reqId" = er."emp_reqId"
      JOIN "User" u ON er."user_Id" = u."user_Id"
      WHERE er."emp_reqStatusId" = 2 AND ow."date" BETWEEN :startDate AND :endDate
    `;

    // 3. Fetch Leaves (Vacation and Sick)
    let leavesQuery = `
      SELECT 'Leave' as "type", vl."StartDate" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", 'Vacation Leave' as "details", vl."EndDate"
      FROM "Vacation_Leave" vl
      JOIN "emp_Request" er ON vl."emp_reqId" = er."emp_reqId"
      JOIN "User" u ON er."user_Id" = u."user_Id"
      WHERE er."emp_reqStatusId" = 2 AND (vl."StartDate" BETWEEN :startDate AND :endDate OR vl."EndDate" BETWEEN :startDate AND :endDate)
      UNION ALL
      SELECT 'Leave' as "type", sl."StartDate" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", 'Sick Leave' as "details", sl."EndDate"
      FROM "Sick_Leave" sl
      JOIN "emp_Request" er ON sl."emp_reqId" = er."emp_reqId"
      JOIN "User" u ON er."user_Id" = u."user_Id"
      WHERE er."emp_reqStatusId" = 2 AND (sl."StartDate" BETWEEN :startDate AND :endDate OR sl."EndDate" BETWEEN :startDate AND :endDate)
    `;

    const replacements = { startDate, endDate };
    if (user_Id && user_Id !== "All Employees") {
      fieldWorkQuery += ` AND er."user_Id" = :user_Id`;
      leavesQuery = leavesQuery.replace(/WHERE er."emp_reqStatusId" = 2/g, `WHERE er."emp_reqStatusId" = 2 AND er."user_Id" = :user_Id`);
      replacements.user_Id = user_Id;
    }

    const fieldWorks = await sequelize.query(fieldWorkQuery, { replacements, type: QueryTypes.SELECT });
    const leaves = await sequelize.query(leavesQuery, { replacements, type: QueryTypes.SELECT });

    const allEvents = [...holidays, ...fieldWorks, ...leaves].sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json(allEvents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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
    DateonField,
    DateOnField,
    NoHrs,
    destination,
  } = req.body || {};

  const finalUserId = parseInt(userId || user_Id);
  const finalReqTypeId = parseInt(emp_reqTypeId);
  const finalOTDate = OT_Dateof || OT_DateOf;
  const finalDateOnField = DateonField || DateOnField;
  const finalNoDays = parseInt(NoDays || 0);
  
  // Use the filename from multer if a file was uploaded
  const proof_File = req.file ? req.file.filename : null;

  if (!finalUserId || !finalReqTypeId) {
    return res
      .status(400)
      .json({ error: "User Id and Request Type are required" });
  }

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);
    const todayStr = now.toISOString().split("T")[0];
    const currentYear = now.getFullYear();

    let systemRemarks = [];

    // Check Leave Balances if applicable before creating parent request
    if (finalReqTypeId === 3 || finalReqTypeId === 4) {
      if (!StartDate || !EndDate || !finalNoDays) {
        return res.status(400).json({ error: "Leave fields are required" });
      }

      let balanceResult = await sequelize.query(
        `SELECT * FROM "Leave_Balance" WHERE "user_Id" = :userId and "year" = :year`,
        {
          replacements: { userId: finalUserId, year: currentYear },
          type: QueryTypes.SELECT,
        },
      );

      if (balanceResult.length === 0) {
        await sequelize.query(
          `INSERT INTO "Leave_Balance" ("user_Id", "year", "VL_balance", "SL_balance", "VL_used", "SL_used")
           VALUES (:userId, :year, 7, 7, 0, 0)`,
          {
            replacements: { userId: finalUserId, year: currentYear },
            type: QueryTypes.INSERT,
          },
        );
        balanceResult = await sequelize.query(
          `SELECT * FROM "Leave_Balance" WHERE "user_Id" = :userId and "year" = :year`,
          {
            replacements: { userId: finalUserId, year: currentYear },
            type: QueryTypes.SELECT,
          },
        );
      }

      const balance = balanceResult[0];
      if (finalReqTypeId === 3) {
        // Rule: VL needs 3 days before the start date
        const filingDate = new Date(todayStr);
        const startDateObj = new Date(StartDate);
        const diffTime = startDateObj - filingDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 3) {
          systemRemarks.push(`Filed less than 3 days before start date (Diff: ${diffDays} days)`);
        }

        if (balance.VL_balance < finalNoDays) {
          systemRemarks.push(`Insufficient VL Balance (Current: ${balance.VL_balance})`);
        }
      } else if (finalReqTypeId === 4 && balance.SL_balance < finalNoDays) {
        systemRemarks.push(`Insufficient SL Balance (Current: ${balance.SL_balance})`);
      }
    }

    // Check for overlapping leaves
    if (finalReqTypeId === 3 || finalReqTypeId === 4) {
      const overlapCheck = await sequelize.query(
        `SELECT er."emp_reqId", rt."reqTypeName", vl."StartDate" as "VL_S", vl."EndDate" as "VL_E", sl."StartDate" as "SL_S", sl."EndDate" as "SL_E"
         FROM "emp_Request" er
         LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
         LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
         LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
         WHERE er."user_Id" = :userId 
         AND er."emp_reqStatusId" IN (1, 2)
         AND er."emp_reqTypeId" IN (3, 4)
         AND (
           (vl."StartDate" <= :EndDate AND vl."EndDate" >= :StartDate) OR
           (sl."StartDate" <= :EndDate AND sl."EndDate" >= :StartDate)
         )`,
        {
          replacements: { userId: finalUserId, StartDate, EndDate },
          type: QueryTypes.SELECT,
        },
      );

      if (overlapCheck.length > 0) {
        return res.status(400).json({ 
          error: "You already have a pending or approved leave request for these dates." 
        });
      }
    }

    const parentResult = await sequelize.query(
      `INSERT INTO "emp_Request"
        ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "system_remarks", "createdAt", "updatedAt")
        VALUES
        (:userId, :emp_reqTypeId, 1, :date_Filed, :remarks, :system_remarks, :now, :now)
        RETURNING *`,
      {
        replacements: {
          userId: finalUserId,
          emp_reqTypeId: finalReqTypeId,
          date_Filed: todayStr,
          remarks: reason || purpose || null,
          system_remarks: systemRemarks.length > 0 ? systemRemarks.join(" | ") : null,
          now: nowStr,
        },
        type: QueryTypes.INSERT,
      },
    );

    const newRequest = parentResult[0][0];
    const emp_reqId = newRequest.emp_reqId;

    let childData = null;

    // Overtime = 1
    if (finalReqTypeId === 1) {
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
            Total_Hrs: parseFloat(Total_Hrs),
            reason,
          },
          type: QueryTypes.INSERT,
        },
      );

      childData = otResult[0][0];

      // Onfield Work
    } else if (finalReqTypeId === 2) {
      if (!finalDateOnField || !finalNoDays || !NoHrs) {
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
            NoDays: finalNoDays,
            NoHrs: parseFloat(NoHrs),
            destination: destination || null,
            proof_File: proof_File,
          },
          type: QueryTypes.INSERT,
        },
      );
      childData = onfieldResult[0][0];

      // Leave Request (Vacation Leave)
    } else if (finalReqTypeId === 3) {
      const vlResult = await sequelize.query(
        `INSERT INTO "Vacation_Leave"
        ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "purpose", "WithPayID")
        VALUES (:emp_reqId, :userId, :StartDate, :EndDate, :NoDays, :purpose, :WithPayID)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            StartDate,
            EndDate,
            NoDays: finalNoDays,
            purpose: purpose || reason || null,
            WithPayID: 2, // Default: Leave without Pay
          },
          type: QueryTypes.INSERT,
        },
      );
      childData = vlResult[0][0];

      // Update Leave Balance for VL
      await sequelize.query(
        `UPDATE "Leave_Balance"
         SET "VL_balance" = GREATEST(0, "VL_balance" - :NoDays),
             "VL_used" = "VL_used" + :NoDays
         WHERE "user_Id" = :userId AND "year" = :year`,
        {
          replacements: {
            NoDays: finalNoDays,
            userId: finalUserId,
            year: currentYear,
          },
          type: QueryTypes.UPDATE,
        },
      );
      
    }
    // Sick Leave
    else if (finalReqTypeId === 4) {
      const slResult = await sequelize.query(
        `INSERT INTO "Sick_Leave"
        ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "proof_File", "WithPayID")
        VALUES (:emp_reqId, :userId, :StartDate, :EndDate, :NoDays, :proof_File, :WithPayID)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            StartDate,
            EndDate,
            NoDays: finalNoDays,
            proof_File: proof_File,
            WithPayID: 2, // Default: Leave without Pay
          },
          type: QueryTypes.INSERT,
        },
      );
      childData = slResult[0][0];

      // Update Leave Balance for SL
      await sequelize.query(
        `UPDATE "Leave_Balance"
         SET "SL_balance" = GREATEST(0, "SL_balance" - :NoDays),
             "SL_used" = "SL_used" + :NoDays
         WHERE "user_Id" = :userId AND "year" = :year`,
        {
          replacements: {
            NoDays: finalNoDays,
            userId: finalUserId,
            year: currentYear,
          },
          type: QueryTypes.UPDATE,
        },
      );
    } else {
      return res.status(400).json({ error: "Invalid Request Type" });
    }

    const typeNameMap = { 1: "Overtime", 2: "Onfield Work", 3: "Vacation Leave", 4: "Sick Leave" };
    const typeName = typeNameMap[finalReqTypeId] || "Request";

    await sequelize.query(
      `INSERT INTO "Notification" ("user_Id", "title", "message", "isRead", "createdAt", "updatedAt")
       VALUES (:userId, :title, :message, false, :now, :now)`,
      {
        replacements: {
          userId: finalUserId,
          title: "Request Submitted",
          message: `Your ${typeName} request has been submitted and is currently pending review.`,
          now: nowStr,
        },
        type: QueryTypes.INSERT,
      },
    );

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
        er.system_remarks,
        ot."OT_DateOf",
        ot."HrFrom",
        ot."HrTo",
        ot."Total_Hrs",
        vl."StartDate" as "VL_StartDate",
        vl."EndDate" as "VL_EndDate",
        vl."NoDays" as "VL_NoDays",
        wpvl."withPayName" as "VL_withPayName",
        sl."StartDate" as "SL_StartDate",
        sl."EndDate" as "SL_EndDate",
        sl."NoDays" as "SL_NoDays",
        wpsl."withPayName" as "SL_withPayName",
        ow."DateonField",
        ow."NoDays" as "OW_NoDays",
        ow."NoHrs" as "OW_NoHrs"
      FROM "emp_Request" er
      LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
      LEFT JOIN "request_Status" rs ON er."emp_reqStatusId" = rs."reqStatId"
      LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
      LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
      LEFT JOIN "withPay" wpvl ON vl."WithPayID" = wpvl."withPayId"
      LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
      LEFT JOIN "withPay" wpsl ON sl."WithPayID" = wpsl."withPayId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      WHERE er."user_Id" = :userId
      ORDER BY er."date_Filed" DESC`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      },
    );

    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.GetAllRequests = async (req, res) => {
  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();

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
        er.system_remarks,
        ot."OT_DateOf",
        ot."HrFrom",
        ot."HrTo",
        ot."Total_Hrs",
        vl."StartDate" as "VL_StartDate",
        vl."EndDate" as "VL_EndDate",
        vl."NoDays" as "VL_NoDays",
        wpvl."withPayName" as "VL_withPayName",
        sl."StartDate" as "SL_StartDate",
        sl."EndDate" as "SL_EndDate",
        sl."NoDays" as "SL_NoDays",
        sl."proof_File" as "SL_proof_File",
        wpsl."withPayName" as "SL_withPayName",
        ow."DateonField",
        ow."NoDays" as "OW_NoDays",
        ow."NoHrs" as "OW_NoHrs",
        ow."destination",
        ow."proof_File" as "OW_proof_File",
        lb."VL_balance",
        lb."SL_balance",
        lb."VL_used",
        lb."SL_used"
      FROM "emp_Request" er
      INNER JOIN "User" u ON er."user_Id" = u."user_Id"
      LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
      LEFT JOIN "request_Status" rs ON er."emp_reqStatusId" = rs."reqStatId"
      LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
      LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
      LEFT JOIN "withPay" wpvl ON vl."WithPayID" = wpvl."withPayId"
      LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
      LEFT JOIN "withPay" wpsl ON sl."WithPayID" = wpsl."withPayId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      LEFT JOIN "Leave_Balance" lb ON er."user_Id" = lb."user_Id" AND lb."year" = :currentYear
      ORDER BY er."date_Filed" DESC`,
      {
        replacements: { currentYear },
        type: QueryTypes.SELECT,
      },
    );
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.UpdateStatusRequest = async (req, res) => {
  const { emp_reqId, emp_reqStatusId, processedBy, remarks, withPayId } =
    req.body;

  if (!emp_reqId || !emp_reqStatusId || !processedBy) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    // 1. Update the parent request status
    await sequelize.query(
      `UPDATE "emp_Request"
       SET "emp_reqStatusId" = :emp_reqStatusId,
           "processedBy" = :processedBy,
           "date_Processed" = :now,
           "admin_remarks" = :admin_remarks,
           "updatedAt" = :now
       WHERE "emp_reqId" = :emp_reqId`,
      {
        replacements: {
          emp_reqId,
          emp_reqStatusId,
          processedBy,
          admin_remarks: remarks || null,
          now: nowStr,
        },
        type: QueryTypes.UPDATE,
      },
    );

    // 2. If it's a Leave request and withPayId is provided, update the child table
    if (withPayId) {
      const request = await sequelize.query(
        `SELECT "emp_reqTypeId" FROM "emp_Request" WHERE "emp_reqId" = :emp_reqId`,
        { replacements: { emp_reqId }, type: QueryTypes.SELECT },
      );

      if (request.length > 0) {
        const typeId = request[0].emp_reqTypeId;
        if (typeId === 3) {
          await sequelize.query(
            `UPDATE "Vacation_Leave" SET "WithPayID" = :withPayId WHERE "emp_reqId" = :emp_reqId`,
            { replacements: { withPayId, emp_reqId }, type: QueryTypes.UPDATE },
          );
        } else if (typeId === 4) {
          await sequelize.query(
            `UPDATE "Sick_Leave" SET "WithPayID" = :withPayId WHERE "emp_reqId" = :emp_reqId`,
            { replacements: { withPayId, emp_reqId }, type: QueryTypes.UPDATE },
          );
        }
      }
    }

    // 3. Create notification for the user
    const [requestInfo] = await sequelize.query(
      `SELECT er."user_Id", rt."reqTypeName" 
       FROM "emp_Request" er
       LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
       WHERE er."emp_reqId" = :emp_reqId`,
      { replacements: { emp_reqId }, type: QueryTypes.SELECT }
    );

    if (requestInfo) {
      const statusName = emp_reqStatusId === 2 ? "Approved" : "Rejected";
      await sequelize.query(
        `INSERT INTO "Notification" ("user_Id", "title", "message", "isRead", "createdAt", "updatedAt")
         VALUES (:userId, :title, :message, false, :now, :now)`,
        {
          replacements: {
            userId: requestInfo.user_Id,
            title: `Request ${statusName}`,
            message: `Your ${requestInfo.reqTypeName} request has been ${statusName.toLowerCase()}.`,
            now: nowStr,
          },
          type: QueryTypes.INSERT,
        }
      );
    }

    res.status(200).json({ message: "Request status updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.GetPendingCount = async (req, res) => {
  try {
    const result = await sequelize.query(
      `SELECT COUNT(*) as count FROM "emp_Request" WHERE "emp_reqStatusId" = 1`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json({ count: parseInt(result[0].count) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.GetLeaveBalance = async (req, res) => {
  const { userId } = req.params;

  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();

    const balanceResult = await sequelize.query(
      `SELECT * FROM "Leave_Balance" WHERE "user_Id" = :userId and "year" = :year`,
      {
        replacements: { userId, year: currentYear },
        type: QueryTypes.SELECT,
      },
    );

    if (balanceResult.length === 0) {
      // Return defaults if no balance record yet
      return res.status(200).json({
        VL_total: 7,
        VL_used: 0,
        VL_balance: 7,
        SL_total: 7,
        SL_used: 0,
        SL_balance: 7,
      });
    }

    const balance = balanceResult[0];
    res.status(200).json({
      VL_total: balance.VL_total || 7,
      VL_used: balance.VL_used || 0,
      VL_balance: balance.VL_balance,
      SL_total: balance.SL_total || 7,
      SL_used: balance.SL_used || 0,
      SL_balance: balance.SL_balance,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.GetRequestDetails = async (req, res) => {
  const { requestId } = req.params;

  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();

    const request = await sequelize.query(
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
        er.system_remarks,
        ot."OT_DateOf",
        ot."HrFrom",
        ot."HrTo",
        ot."Total_Hrs",
        vl."StartDate" as "VL_StartDate",
        vl."EndDate" as "VL_EndDate",
        vl."NoDays" as "VL_NoDays",
        wpvl."withPayName" as "VL_withPayName",
        sl."StartDate" as "SL_StartDate",
        sl."EndDate" as "SL_EndDate",
        sl."NoDays" as "SL_NoDays",
        sl."proof_File" as "SL_proof_File",
        wpsl."withPayName" as "SL_withPayName",
        ow."DateonField",
        ow."NoDays" as "OW_NoDays",
        ow."NoHrs" as "OW_NoHrs",
        ow."destination",
        ow."proof_File" as "OW_proof_File",
        lb."VL_balance",
        lb."SL_balance",
        ap."user_FirstName" || ' ' || ap."user_LastName" as "approverName"
      FROM "emp_Request" er
      INNER JOIN "User" u ON er."user_Id" = u."user_Id"
      LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
      LEFT JOIN "request_Status" rs ON er."emp_reqStatusId" = rs."reqStatId"
      LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
      LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
      LEFT JOIN "withPay" wpvl ON vl."WithPayID" = wpvl."withPayId"
      LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
      LEFT JOIN "withPay" wpsl ON sl."WithPayID" = wpsl."withPayId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      LEFT JOIN "Leave_Balance" lb ON er."user_Id" = lb."user_Id" AND lb."year" = :currentYear
      LEFT JOIN "User" ap ON er."processedBy" = ap."user_Id"
      WHERE er."emp_reqId" = CAST(:requestId AS INTEGER)`,
      {
        replacements: { requestId, currentYear },
        type: QueryTypes.SELECT,
      },
    );

    if (request.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.status(200).json(request[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
