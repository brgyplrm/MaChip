import React, { useState, useEffect } from "react";
import "./editPayroll.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import { useNavigate, useParams } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";

const EditPayroll = () => {
  const navigate = useNavigate();
  const { payrollId } = useParams();

  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    employeeName: "",
    userId: "",
    user_MachipId: "",
    periodStart: "",
    periodEnd: "",
    daysWorked: 0,
    hoursWorked: 0,
    dailyRate: 0,
    ratePerHour: 0,
    status: 1, // Using ID for status
    otHrs: 0,
    otAmount: 0,
    incentives: 0,
    allowance: 0,
    absenceAmount: 0,
    tardinessAmount: 0,
    unpaidLeaveAmount: 0,
    tardinessMins: 0,
    absenceDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    totalScheduledDays: 0,
  });

  const [summary, setSummary] = useState({
    basicPay: 0,
    totalEarnings: 0,
    totalDeductions: 0,
    netPay: 0,
  });

  // Fetch Payroll Data
  useEffect(() => {
    const fetchPayroll = async () => {
      try {
        const response = await fetch(
          `http://localhost:4000/api/payroll/${payrollId}`,
        );
        const data = await response.json();
        if (response.ok) {
          // Calculate total scheduled days from period if possible
          const start = new Date(data.period_Start);
          const end = new Date(data.period_End);
          let count = 0;
          let current = new Date(start);
          while (current <= end) {
            if (current.getDay() !== 0) count++;
            current.setDate(current.getDate() + 1);
          }

          setFormData({
            employeeName: `${data.user_FirstName} ${data.user_LastName}`,
            userId: data.user_Id,
            user_MachipId: data.user_MachipId || "",
            periodStart: data.period_Start,
            periodEnd: data.period_End,
            daysWorked: data.NoDays_Worked,
            hoursWorked: data.NoHrs_Worked,
            dailyRate: data.dailyRate,
            ratePerHour: data.ratePerHr,
            status: data.status,
            otHrs: data.OT_Hrs || 0,
            otAmount: data.OT_Amnt || 0,
            incentives: data.incentives || 0,
            allowance: data.allowance || 0,
            absenceAmount: data.absence_Amnt || 0,
            tardinessAmount: data.tardiness_Amnt || 0,
            unpaidLeaveAmount: data.unpaidLeave_Amnt || 0,
            tardinessMins: data.tardiness_Mins || 0,
            absenceDays: (data.absence_Hrs || 0) / 8,
            paidLeaveDays: data.paidLeave_Days || 0,
            unpaidLeaveDays: data.unpaidLeave_Days || 0,
            totalScheduledDays: count,
          });
        } else {
          alert("Error: " + data.error);
        }
      } catch (error) {
        console.error("Error fetching payroll:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPayroll();
  }, [payrollId]);

  // Automatic Calculation Logic
  useEffect(() => {
    if (loading) return;

    const dailyRate = parseFloat(formData.dailyRate) || 0;
    const ratePerHour = parseFloat(formData.ratePerHour) || 0;

    // Logic: Paid Days = Total Scheduled - Absences - Unpaid Leaves
    // (Paid Leaves are included in Paid Days)
    const totalScheduled = parseFloat(formData.totalScheduledDays) || 0;
    const absences = parseFloat(formData.absenceDays) || 0;

    // Net Days is strictly Total Scheduled - Absence Days
    const daysWorked = totalScheduled - absences;
    const hoursWorked = daysWorked * 8;

    const otAmount = (parseFloat(formData.otHrs) * ratePerHour).toFixed(2);
    const basic = (daysWorked * dailyRate).toFixed(2);

    const calcAbsenceAmount = (absences * dailyRate).toFixed(2);

    const earnings =
      parseFloat(basic) +
      parseFloat(otAmount) +
      parseFloat(formData.incentives) +
      parseFloat(formData.allowance);
    const totalAbsenceDeduction = parseFloat(calcAbsenceAmount);
    const deductions =
      totalAbsenceDeduction + parseFloat(formData.tardinessAmount);

    setSummary({
      basicPay: parseFloat(basic),
      totalEarnings: earnings,
      totalDeductions: deductions,
      netPay: earnings - deductions,
    });

    if (
      formData.daysWorked !== daysWorked ||
      formData.absenceAmount !== totalAbsenceDeduction
    ) {
      setFormData((prev) => ({
        ...prev,
        daysWorked: daysWorked,
        hoursWorked: hoursWorked,
        absenceAmount: totalAbsenceDeduction,
      }));
    }
  }, [
    formData.dailyRate,
    formData.ratePerHour,
    formData.absenceDays,
    formData.unpaidLeaveDays,
    formData.totalScheduledDays,
    formData.otHrs,
    formData.incentives,
    formData.allowance,
    formData.tardinessAmount,
    loading,
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `http://localhost:4000/api/payroll/update/${payrollId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dailyRate: formData.dailyRate,
            ratePerHr: formData.ratePerHour,
            NoDays_Worked: formData.daysWorked,
            NoHrs_Worked: formData.hoursWorked,
            basicPay: summary.basicPay,
            totalEarnings: summary.totalEarnings,
            totalDeductions: summary.totalDeductions,
            netPay: summary.netPay,
            status: formData.status,
            OT_Hrs: formData.otHrs,
            OT_Amnt: formData.otAmount,
            absence_Amnt: formData.absenceAmount,
            tardiness_Amnt: formData.tardinessAmount,
            unpaidLeave_Amnt: 0, 
            absence_Days: formData.absenceDays, 
            paidLeave_Days: formData.paidLeaveDays,
            unpaidLeave_Days: formData.unpaidLeaveDays,
          }),
        },
      );

      if (response.ok) {
        alert("Payroll updated successfully!");
        navigate("/payroll");
      } else {
        const data = await response.json();
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error("Error updating payroll:", error);
      alert("Error connecting to server.");
    }
  };

  if (loading) return <div className="loading">Loading Payroll Data...</div>;

  return (
    <div className="home editPayroll">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="editWrapper">
          <div className="pageHeader">
            <ArrowBackIcon className="backIcon" onClick={() => navigate(-1)} />
            <div className="titleText">
              <h1>Edit Payroll</h1>
              <span>
                Update payroll information for {formData.employeeName}
              </span>
            </div>
          </div>

          <form className="payrollForm" onSubmit={handleSubmit}>
            {/* Basic Information Section */}
            <div className="formSection">
              <h3>Basic Information</h3>
              <div className="inputGrid">
                <div className="inputGroup">
                  <label>Employee</label>
                  <input
                    type="text"
                    value={formData.employeeName}
                    readOnly
                    className="readOnlyInput"
                  />
                </div>
                <div className="inputGroup">
                  <label>User ID</label>
                  <input
                    type="text"
                    value={formatUserId(formData.userId)}
                    readOnly
                    className="readOnlyInput"
                  />
                </div>
                <div className="inputGroup">
                  <label>Period Start</label>
                  <input
                    type="date"
                    value={formData.periodStart}
                    readOnly
                    className="readOnlyInput"
                  />
                </div>
                <div className="inputGroup">
                  <label>Period End</label>
                  <input
                    type="date"
                    value={formData.periodEnd}
                    readOnly
                    className="readOnlyInput"
                  />
                </div>
                <div className="inputGroup">
                  <label>Daily Rate (₱)</label>
                  <input
                    type="number"
                    name="dailyRate"
                    value={formData.dailyRate}
                    onChange={handleInputChange}
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
                <div className="inputGroup">
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value={1}>Processing</option>
                    <option value={2}>Released</option>
                  </select>
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
                  />
                </div>
                <div className="inputGroup">
                  <label>Paid Leave (Days)</label>
                  <input
                    type="number"
                    name="paidLeaveDays"
                    value={formData.paidLeaveDays}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="inputGroup">
                  <label>Unpaid Leave (Days)</label>
                  <input
                    type="number"
                    name="unpaidLeaveDays"
                    value={formData.unpaidLeaveDays}
                    onChange={handleInputChange}
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
                    value={formData.hoursWorked}
                    readOnly
                    className="readOnlyInput"
                  />
                </div>
                <div className="inputGroup">
                  <label>OT Hours</label>
                  <input
                    type="number"
                    name="otHrs"
                    value={formData.otHrs}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>

            {/* Financial Adjustments */}
            <div className="formSection">
              <h3>Manual Adjustments</h3>
              <div className="inputGrid">
                <div className="inputGroup">
                  <label>Incentives (₱)</label>
                  <input
                    type="number"
                    name="incentives"
                    value={formData.incentives}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="inputGroup">
                  <label>Allowance (₱)</label>
                  <input
                    type="number"
                    name="allowance"
                    value={formData.allowance}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="inputGroup">
                  <label>Absence Deduction (₱)</label>
                  <input
                    type="number"
                    name="absenceAmount"
                    value={formData.absenceAmount}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="inputGroup">
                  <label>Tardiness Deduction (₱)</label>
                  <input
                    type="number"
                    name="tardinessAmount"
                    value={formData.tardinessAmount}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>

            {/* Summary Card */}
            <div className="formSection summaryCard">
              <div className="summaryGrid">
                <div className="sumItem">
                  <span>Basic Pay</span>
                  <p>₱{summary.basicPay.toFixed(2)}</p>
                </div>
                <div className="sumItem">
                  <span>Total Payable</span>
                  <p className="pos">₱{summary.totalEarnings.toFixed(2)}</p>
                </div>
                <div className="sumItem">
                  <span>Total Deductions</span>
                  <p className="neg">₱{summary.totalDeductions.toFixed(2)}</p>
                </div>
                <div className="sumItem">
                  <span>Net Pay</span>
                  <p className="bold">₱{summary.netPay.toFixed(2)}</p>
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
                <SaveIcon /> Update Payroll
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditPayroll;
