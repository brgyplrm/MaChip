import React, { useState, useEffect } from "react";
import "./editPayroll.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { useNavigate, useParams } from "react-router-dom";

const EditPayroll = () => {
  const navigate = useNavigate();
  const { payrollId } = useParams(); // Get ID from URL for database fetching
  
  const [formData, setFormData] = useState({
    employeeName: "Kathleen Pinto", // Pre-filled for example
    userId: 1,
    periodStart: "2026-03-01",
    periodEnd: "2026-03-15",
    daysWorked: 10,
    hoursWorked: 80,
    ratePerHour: 150,
    status: "Paid",
    otAmount: 0,
    incentives: 0,
    allowance: 0,
    absenceAmount: 0,
    tardinessAmount: 0,
    unpaidLeaveAmount: 0,
  });

  const [summary, setSummary] = useState({
    basicPay: 12000,
    totalEarnings: 12000,
    totalDeductions: 0,
    netPay: 12000
  });

  // Re-calculate totals whenever inputs change
  useEffect(() => {
    const basic = Number(formData.hoursWorked) * Number(formData.ratePerHour);
    const earnings = basic + Number(formData.otAmount) + Number(formData.incentives) + Number(formData.allowance);
    const deductions = Number(formData.absenceAmount) + Number(formData.tardinessAmount) + Number(formData.unpaidLeaveAmount);

    setSummary({
      basicPay: basic,
      totalEarnings: earnings,
      totalDeductions: deductions,
      netPay: earnings - deductions
    });
  }, [formData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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
              <span>Enter payroll information</span>
            </div>
          </div>

          <form className="payrollForm">
            {/* Basic Information */}
            <div className="formSection">
              <h3>Basic Information</h3>
              <div className="inputGrid">
                <div className="inputGroup">
                  <label>Employee Name</label>
                  <input type="text" name="employeeName" value={formData.employeeName} onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>User ID</label>
                  <input type="number" name="userId" value={formData.userId} onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Period Start</label>
                  <input type="date" name="periodStart" value={formData.periodStart} onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Period End</label>
                  <input type="date" name="periodEnd" value={formData.periodEnd} onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Rate Per Hour (₱)</label>
                  <input type="number" name="ratePerHour" value={formData.ratePerHour} onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange}>
                    <option value="Draft">Draft</option>
                    <option value="Processed">Processed</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="formSection">
              <h3>Earnings Breakdown</h3>
              <div className="inputGrid">
                <div className="inputGroup">
                  <label>OT Amount (₱)</label>
                  <input type="number" name="otAmount" value={formData.otAmount} onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Incentives (₱)</label>
                  <input type="number" name="incentives" value={formData.incentives} onChange={handleInputChange} />
                </div>
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="formSection">
              <h3>Deductions Breakdown</h3>
              <div className="inputGrid">
                <div className="inputGroup">
                  <label>Absence Amount (₱)</label>
                  <input type="number" name="absenceAmount" value={formData.absenceAmount} onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Tardiness Amount (₱)</label>
                  <input type="number" name="tardinessAmount" value={formData.tardinessAmount} onChange={handleInputChange} />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="formSection summaryCard">
              <div className="summaryGrid">
                <div className="sumItem">
                  <span>Basic Pay</span>
                  <p>₱{summary.basicPay.toLocaleString()}</p>
                </div>
                <div className="sumItem">
                  <span>Total Earnings</span>
                  <p className="pos">₱{summary.totalEarnings.toLocaleString()}</p>
                </div>
                <div className="sumItem">
                  <span>Total Deductions</span>
                  <p className="neg">₱{summary.totalDeductions.toLocaleString()}</p>
                </div>
                <div className="sumItem">
                  <span>Net Pay</span>
                  <p className="bold">₱{summary.netPay.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="formActions">
              <button type="button" className="cancelBtn" onClick={() => navigate(-1)}>Cancel</button>
              <button type="submit" className="saveBtn"><SaveIcon /> Save Payroll</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditPayroll;