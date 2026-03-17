import React, { useState, useEffect } from "react";
import "./createPayroll.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import { useNavigate } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";

const CreatePayroll = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    employeeName: "",
    userId: "",
    periodStart: "",
    periodEnd: "",
    daysWorked: 0,
    hoursWorked: 0,
    dailyRate: 0,
    ratePerHour: 0,
    status: "Processing",
    otHrs: 0,
    tardinessMins: 0,
    absenceDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    totalScheduledDays: 0,
    // Earnings Breakdown
    otAmount: 0,
    restDayOtAmount: 0,
    nightDiffAmount: 0,
    restDayAmount: 0,
    specialHolidayAmount: 0,
    legalHolidayAmount: 0,
    incentives: 0,
    allowance: 0,
    leaveCredits: 0,
    // Deductions Breakdown
    absenceAmount: 0,
    tardinessAmount: 0,
    unpaidLeaveAmount: 0,
  });

  const fetchUsers = async () => {
    try {
      const response = await fetch("http://localhost:4000/api/users/all");
      const data = await response.json();
      if (response.ok) {
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const [summary, setSummary] = useState({
    basicPay: 0,
    totalEarnings: 0,
    totalDeductions: 0,
    netPay: 0,
  });

  // Calculate Number of Days based on Period
  useEffect(() => {
    if (formData.periodStart && formData.periodEnd) {
      const start = new Date(formData.periodStart);
      const end = new Date(formData.periodEnd);

      if (start <= end) {
        let count = 0;
        let current = new Date(start);
        while (current <= end) {
          if (current.getDay() !== 0) {
            // Exclude Sundays
            count++;
          }
          current.setDate(current.getDate() + 1);
        }
        setFormData((prev) => ({ ...prev, totalScheduledDays: count }));
      }
    }
  }, [formData.periodStart, formData.periodEnd]);

  // Fetch Payroll Preview Data
  useEffect(() => {
    const fetchPreview = async () => {
      if (formData.userId && formData.periodStart && formData.periodEnd) {
        try {
          const response = await fetch(
            `http://localhost:4000/api/payroll/preview?user_Id=${formData.userId}&period_Start=${formData.periodStart}&period_End=${formData.periodEnd}`,
          );
          const data = await response.json();
          if (response.ok) {
            // Fetch logic: Combine true absences and unpaid leaves into total absences
            const totalInitialAbsences =
              (data.absence_Days || 0) + (data.unpaidLeave_Days || 0);

            setFormData((prev) => ({
              ...prev,
              absenceDays: totalInitialAbsences,
              paidLeaveDays: data.paidLeave_Days,
              unpaidLeaveDays: data.unpaidLeave_Days,
              tardinessMins: data.tardiness_Mins,
              otHrs: data.OT_Hrs,
            }));
          }
        } catch (error) {
          console.error("Error fetching payroll preview:", error);
        }
      }
    };
    fetchPreview();
  }, [formData.userId, formData.periodStart, formData.periodEnd]);

  // Automatic Calculation Logic
  useEffect(() => {
    const dailyRate = parseFloat(formData.dailyRate) || 0;
    const ratePerHour = parseFloat(formData.ratePerHour) || 0;

    const totalScheduled = parseFloat(formData.totalScheduledDays) || 0;
    const absences = parseFloat(formData.absenceDays) || 0;

    const days = totalScheduled - absences;
    const hours = days * 8;

    // Calculate dependent amounts
    const calcOtAmount = (
      parseFloat(formData.otHrs || 0) *
      ratePerHour *
      1.25
    ).toFixed(2);
    const calcTardinessAmount = (
      parseFloat(formData.tardinessMins || 0) *
      (ratePerHour / 60)
    ).toFixed(2);

    const calcAbsenceAmount = (absences * dailyRate).toFixed(2);
    const totalAbsenceDeduction = parseFloat(calcAbsenceAmount);

    // Basic Pay = Daily Rate * Net Days
    const basic = dailyRate * totalScheduled;

    const earnings =
      basic +
      parseFloat(calcOtAmount) +
      Number(formData.restDayOtAmount || 0) +
      Number(formData.nightDiffAmount || 0) +
      Number(formData.restDayAmount || 0) +
      Number(formData.specialHolidayAmount || 0) +
      Number(formData.legalHolidayAmount || 0) +
      Number(formData.incentives || 0) +
      Number(formData.allowance || 0) +
      Number(formData.leaveCredits || 0);

    const deductions = totalAbsenceDeduction + parseFloat(calcTardinessAmount);

    setSummary({
      basicPay: basic,
      totalEarnings: earnings,
      totalDeductions: deductions,
      netPay: earnings - deductions,
    });

    // Sync calculated fields to state if they differ
    if (
      formData.daysWorked !== days ||
      formData.hoursWorked !== hours ||
      formData.otAmount !== calcOtAmount ||
      formData.tardinessAmount !== calcTardinessAmount ||
      formData.absenceAmount !== totalAbsenceDeduction
    ) {
      setFormData((prev) => ({
        ...prev,
        daysWorked: days,
        hoursWorked: hours,
        otAmount: calcOtAmount,
        tardinessAmount: calcTardinessAmount,
        absenceAmount: totalAbsenceDeduction,
      }));
    }
  }, [
    formData.dailyRate,
    formData.ratePerHour,
    formData.totalScheduledDays,
    formData.absenceDays,
    formData.unpaidLeaveDays,
    formData.otHrs,
    formData.tardinessMins,
    formData.restDayOtAmount,
    formData.nightDiffAmount,
    formData.restDayAmount,
    formData.specialHolidayAmount,
    formData.legalHolidayAmount,
    formData.incentives,
    formData.allowance,
    formData.leaveCredits,
    formData.tardinessAmount,
  ]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "dailyRate") {
        updated.ratePerHour = (parseFloat(value) / 8).toFixed(3);
      }
      // If unpaidLeaveDays is changed, reflect it in absenceDays as well
      if (name === "unpaidLeaveDays") {
        const oldUnpaid = parseFloat(prev.unpaidLeaveDays) || 0;
        const newUnpaid = parseFloat(value) || 0;
        const diff = newUnpaid - oldUnpaid;
        updated.absenceDays = (parseFloat(prev.absenceDays) || 0) + diff;
      }
      return updated;
    });
  };

  const handleUserChange = (e) => {
    const userId = e.target.value;
    const user = users.find((u) => u.user_Id === parseInt(userId));
    if (user) {
      setFormData((prev) => ({
        ...prev,
        userId: user.user_Id,
        employeeName: `${user.user_FirstName} ${user.user_LastName}`,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        userId: "",
        employeeName: "",
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        user_Id: formData.userId,
        period_Start: formData.periodStart,
        period_End: formData.periodEnd,
        dailyRate: formData.dailyRate,
        ratePerHr: formData.ratePerHour,
        NoDays_Worked: formData.daysWorked,
        NoHrs_Worked: formData.hoursWorked,
        basicPay: summary.basicPay,
        totalEarnings: summary.totalEarnings,
        totalDeductions: summary.totalDeductions,
        netPay: summary.netPay,
        OT_Hrs: formData.otHrs,
        OT_Amnt: formData.otAmount,
        absence_Amnt: formData.absenceAmount,
        tardiness_Amnt: formData.tardinessAmount,
        unpaidLeave_Amnt: 0,
        absence_Days: formData.absenceDays,
        paidLeave_Days: formData.paidLeaveDays,
        unpaidLeave_Days: formData.unpaidLeaveDays,
        tardiness_Mins: formData.tardinessMins,
      };

      const response = await fetch(
        "http://localhost:4000/api/payroll/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      if (response.ok) {
        alert("Payroll generated successfully!");
        navigate("/payroll");
      } else {
        alert("Error: " + (data.error || "Failed to generate payroll."));
      }
    } catch (error) {
      console.error("Error submitting payroll:", error);
      alert("Error connecting to the server.");
    }
  };

  return (
    <div className="home createPayroll">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="createWrapper">
          <div className="pageHeader">
            <ArrowBackIcon className="backIcon" onClick={() => navigate(-1)} />
            <div className="titleText">
              <h1>Create Payroll</h1>
              <span>Enter payroll information</span>
            </div>
          </div>

          <form className="payrollForm" onSubmit={handleSubmit}>
            {/* Basic Information Section */}
            <div className="formSection">
              <h3>Basic Information</h3>
              <div className="inputGrid">
                <div className="inputGroup">
                  <label>Select Employee</label>
                  <select
                    name="userId"
                    value={formData.userId}
                    onChange={handleUserChange}
                    required
                  >
                    <option value="">Select an employee...</option>
                    {users.map((u) => (
                      <option key={u.user_Id} value={u.user_Id}>
                        {u.user_FirstName} {u.user_LastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="inputGroup">
                  <label>User ID</label>
                  <input
                    type="text"
                    value={(() => {
                      const u = users.find(
                        (u) => u.user_Id === parseInt(formData.userId),
                      );
                      return u ? formatUserId(u.user_Id) : "";
                    })()}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>
                <div className="inputGroup">
                  <label>Period Start</label>
                  <input
                    type="date"
                    name="periodStart"
                    onChange={handleInputChange}
                  />
                </div>
                <div className="inputGroup">
                  <label>Period End</label>
                  <input
                    type="date"
                    name="periodEnd"
                    onChange={handleInputChange}
                  />
                </div>
                <div className="inputGroup">
                  <label>Daily Rate (₱)</label>
                  <input
                    type="number"
                    name="dailyRate"
                    value={formData.dailyRate}
                    onChange={handleInputChange}
                    placeholder="e.g. 500"
                  />
                </div>
                <div className="inputGroup">
                  <label>Rate Per Hour (₱)</label>
                  <input
                    type="number"
                    name="ratePerHour"
                    value={formData.ratePerHour}
                    readOnly
                    className="readOnlyInput"
                  />
                </div>
              </div>
            </div>

            {/* Work Breakdown Section */}
            <div className="formSection">
              <h3>Work Breakdown</h3>
              <div className="inputGrid">
                <div className="inputGroup">
                  <label>Total Scheduled Days</label>
                  <input
                    type="number"
                    value={formData.totalScheduledDays}
                    readOnly
                    className="readOnlyInput"
                  />
                </div>
                <div className="inputGroup">
                  <label>Absence (Days)</label>
                  <input
                    type="number"
                    name="absenceDays"
                    value={formData.absenceDays}
                    onChange={handleInputChange}
                    placeholder="e.g. 1"
                  />
                </div>
                <div className="inputGroup">
                  <label>Paid Leave (Days)</label>
                  <input
                    type="number"
                    name="paidLeaveDays"
                    value={formData.paidLeaveDays}
                    onChange={handleInputChange}
                    placeholder="e.g. 1"
                  />
                </div>
                <div className="inputGroup">
                  <label>Unpaid Leave (Days)</label>
                  <input
                    type="number"
                    name="unpaidLeaveDays"
                    value={formData.unpaidLeaveDays}
                    onChange={handleInputChange}
                    placeholder="e.g. 1"
                  />
                </div>
                <div className="inputGroup">
                  <label>Net Days Worked</label>
                  <input
                    type="number"
                    value={formData.daysWorked}
                    readOnly
                    className="readOnlyInput"
                  />
                </div>
                <div className="inputGroup">
                  <label>Hours Worked</label>
                  <input
                    type="number"
                    name="hoursWorked"
                    value={formData.hoursWorked}
                    readOnly
                    className="readOnlyInput"
                  />
                </div>
                <div className="inputGroup">
                  <label>OT Hours Worked</label>
                  <input
                    type="number"
                    name="otHrs"
                    value={formData.otHrs}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        otHrs: val,
                      }));
                    }}
                    placeholder="e.g. 5"
                  />
                </div>
                <div className="inputGroup">
                  <label>Tardiness (Mins)</label>
                  <input
                    type="number"
                    name="tardinessMins"
                    value={formData.tardinessMins}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        tardinessMins: val,
                      }));
                    }}
                    placeholder="e.g. 30"
                  />
                </div>
              </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="formSection">
              <h3>Earnings Breakdown</h3>
              <div className="inputGrid">
                <div className="inputGroup">
                  <label>OT Amount (₱)</label>
                  <input
                    type="number"
                    name="otAmount"
                    value={formData.otAmount}
                    readOnly
                    className="readOnlyInput"
                  />
                </div>
                <div className="inputGroup">
                  <label>Night Diff Amount (₱)</label>
                  <input
                    type="number"
                    name="nightDiffAmount"
                    onChange={handleInputChange}
                  />
                </div>
                <div className="inputGroup">
                  <label>Incentives (₱)</label>
                  <input
                    type="number"
                    name="incentives"
                    onChange={handleInputChange}
                  />
                </div>
                <div className="inputGroup">
                  <label>Allowance (₱)</label>
                  <input
                    type="number"
                    name="allowance"
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="formSection">
              <h3>Deductions Breakdown</h3>
              <div className="inputGrid">
                <div className="inputGroup">
                  <label>Absence Amount (₱)</label>
                  <input
                    type="number"
                    name="absenceAmount"
                    value={formData.absenceAmount}
                    readOnly
                    className="readOnlyInput"
                  />
                </div>
                <div className="inputGroup">
                  <label>Tardiness Amount (₱)</label>
                  <input
                    type="number"
                    name="tardinessAmount"
                    value={formData.tardinessAmount}
                    readOnly
                    className="readOnlyInput"
                  />
                </div>
              </div>
            </div>

            {/* Summary Card */}
            <div className="formSection summaryCard">
              <h3>Summary</h3>
              <div className="summaryGrid">
                <div className="sumItem">
                  <span>Basic Pay</span>
                  <p>
                    ₱
                    {summary.basicPay.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="sumItem">
                  <span>Total Payable</span>
                  <p className="pos">
                    ₱
                    {summary.totalEarnings.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="sumItem">
                  <span>Total Deductions</span>
                  <p className="neg">
                    ₱
                    {summary.totalDeductions.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="sumItem">
                  <span>Net Pay</span>
                  <p className="bold">
                    ₱
                    {summary.netPay.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="formActions">
              <button
                type="button"
                className="cancelBtn"
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>
              <button type="submit" className="saveBtn">
                <SaveIcon /> Save Payroll
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreatePayroll;
