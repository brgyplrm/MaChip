import React, { useState, useEffect } from "react";
import "./createPayroll.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { useNavigate } from "react-router-dom";

const CreatePayroll = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    employeeName: "",
    userId: 0,
    periodStart: "",
    periodEnd: "",
    daysWorked: 0,
    hoursWorked: 0,
    ratePerHour: 0,
    status: "Draft",
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

  const [summary, setSummary] = useState({
    basicPay: 0,
    totalEarnings: 0,
    totalDeductions: 0,
    netPay: 0
  });

  // Automatic Calculation Logic
  useEffect(() => {
    const basic = formData.hoursWorked * formData.ratePerHour;
    const earnings = 
        Number(formData.otAmount) + Number(formData.restDayOtAmount) + 
        Number(formData.nightDiffAmount) + Number(formData.restDayAmount) + 
        Number(formData.specialHolidayAmount) + Number(formData.legalHolidayAmount) + 
        Number(formData.incentives) + Number(formData.allowance) + Number(formData.leaveCredits);
    
    const deductions = 
        Number(formData.absenceAmount) + Number(formData.tardinessAmount) + 
        Number(formData.unpaidLeaveAmount);

    setSummary({
      basicPay: basic,
      totalEarnings: earnings,
      totalDeductions: deductions,
      netPay: (basic + earnings) - deductions
    });
  }, [formData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

          <form className="payrollForm">
            {/* Basic Information Section */}
            <div className="formSection">
              <h3>Basic Information</h3>
              <div className="inputGrid">
                <div className="inputGroup">
                  <label>Employee Name</label>
                  <input type="text" name="employeeName" onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>User ID</label>
                  <input type="number" name="userId" onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Period Start</label>
                  <input type="date" name="periodStart" onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Period End</label>
                  <input type="date" name="periodEnd" onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Hours Worked</label>
                  <input type="number" name="hoursWorked" onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Rate Per Hour (₱)</label>
                  <input type="number" name="ratePerHour" onChange={handleInputChange} />
                </div>
              </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="formSection">
              <h3>Earnings Breakdown</h3>
              <div className="inputGrid">
                <div className="inputGroup">
                  <label>OT Amount (₱)</label>
                  <input type="number" name="otAmount" onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Night Diff Amount (₱)</label>
                  <input type="number" name="nightDiffAmount" onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Incentives (₱)</label>
                  <input type="number" name="incentives" onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Allowance (₱)</label>
                  <input type="number" name="allowance" onChange={handleInputChange} />
                </div>
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="formSection">
              <h3>Deductions Breakdown</h3>
              <div className="inputGrid">
                <div className="inputGroup">
                  <label>Absence Amount (₱)</label>
                  <input type="number" name="absenceAmount" onChange={handleInputChange} />
                </div>
                <div className="inputGroup">
                  <label>Tardiness Amount (₱)</label>
                  <input type="number" name="tardinessAmount" onChange={handleInputChange} />
                </div>
              </div>
            </div>

            {/* Summary Card */}
            <div className="formSection summaryCard">
              <h3>Summary</h3>
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

export default CreatePayroll;