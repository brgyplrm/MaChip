import React, { useState, useEffect, useCallback } from "react";
import "./adminReports.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FilterListIcon from "@mui/icons-material/FilterList";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PaymentsIcon from "@mui/icons-material/Payments";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { Link } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import { exportBatchToZip } from "../../utils/payrollExport";

const Reports = () => {
  const [activeReport, setActiveReport] = useState("attendance");
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 15)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmployee, setSelectedEmployee] = useState("All Employees");
  const [selectedPeriod, setSelectedPeriod] = useState("custom");
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  
  const [employees, setEmployees] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [payrollData, setPayrollData] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPayrollPeriods = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:4000/api/system/payroll-periods");
      if (response.ok) {
        const data = await response.json();
        setPayrollPeriods(data);
      }
    } catch (error) {
      console.error("Error fetching payroll periods:", error);
    }
  }, []);

  const handlePeriodChange = (e) => {
    const val = e.target.value;
    setSelectedPeriod(val);
    if (val === "custom") return;

    const period = payrollPeriods.find(p => p.periodId.toString() === val);
    if (period) {
      setStartDate(period.startDate);
      setEndDate(period.endDate);
    }
  };

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:4000/api/users/all");
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, []);

  const fetchAttendanceReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:4000/api/attendance/report?startDate=${startDate}&endDate=${endDate}&user_Id=${selectedEmployee}`);
      if (response.ok) {
        const data = await response.json();
        setAttendanceData(data);
      }
    } catch (error) {
      console.error("Error fetching attendance report:", error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployee]);

  const fetchPayrollReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:4000/api/payroll/report?startDate=${startDate}&endDate=${endDate}&user_Id=${selectedEmployee}`);
      if (response.ok) {
        const data = await response.json();
        setPayrollData(data);
      }
    } catch (error) {
      console.error("Error fetching payroll report:", error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployee]);

  const fetchCalendarReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:4000/api/request/report/calendar?startDate=${startDate}&endDate=${endDate}&user_Id=${selectedEmployee}`);
      if (response.ok) {
        const data = await response.json();
        setCalendarData(data);
      }
    } catch (error) {
      console.error("Error fetching calendar report:", error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployee]);

  useEffect(() => {
    fetchEmployees();
    fetchPayrollPeriods();
  }, [fetchEmployees, fetchPayrollPeriods]);

  useEffect(() => {
    if (activeReport === "attendance") fetchAttendanceReport();
    else if (activeReport === "payroll") fetchPayrollReport();
    else if (activeReport === "calendar") fetchCalendarReport();
  }, [activeReport, fetchAttendanceReport, fetchPayrollReport, fetchCalendarReport]);

  const exportToCSV = () => {
    let dataToExport = [];
    let filename = `${activeReport}_report_${startDate}_to_${endDate}.csv`;
    let headers = [];

    if (activeReport === "attendance") {
      headers = ["Employee MaChip ID", "Employee Name", "Date", "Time In", "Time Out", "Hours Worked", "Status", "Remarks"];
      dataToExport = attendanceData.map(r => [r.machipId, r.userName, r.log_Date, r.time_In, r.time_Out, r.hours_worked, r.status, r.remarks]);
    } else if (activeReport === "payroll") {
      headers = ["Payroll ID", "Employee Name", "Period Start", "Period End", "Days Worked", "Hours Worked", "Net Pay", "Status"];
      dataToExport = payrollData.map(r => [r.payrollId, `${r.user_FirstName} ${r.user_LastName}`, r.period_Start, r.period_End, r.NoDays_Worked, r.NoHrs_Worked, r.netPay, r.statusName]);
    } else if (activeReport === "calendar") {
      headers = ["Type", "Date", "Name/Employee", "Details"];
      dataToExport = calendarData.map(r => [r.type, r.date, r.name, r.details]);
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...dataToExport.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchExport = () => {
    if (payrollData.length === 0) return;
    
    // Determine a label for the export
    let label = "Payroll_Report";
    if (selectedPeriod !== "custom") {
      const period = payrollPeriods.find(p => p.periodId.toString() === selectedPeriod);
      if (period) {
        const [startY, startM, startD] = period.startDate.split('-').map(Number);
        const [endY, endM, endD] = period.endDate.split('-').map(Number);
        const month = new Date(startY, startM - 1, startD).toLocaleString('en-US', { month: 'long' });
        label = `${month}${startD}-${endD}`;
      }
    } else {
      label = `Payroll_${startDate}_to_${endDate}`;
    }
    
    exportBatchToZip(payrollData, label);
  };

  // Helper to calculate stats
  const stats = attendanceData.reduce((acc, curr) => {
    if (curr.status === "On-Time") acc.present++;
    else if (curr.status === "Late") { acc.present++; acc.late++; }
    else if (curr.status === "Absent") acc.absent++;
    acc.totalHours += parseFloat(curr.hoursWorked) || 0;
    return acc;
  }, { present: 0, absent: 0, late: 0, totalHours: 0 });

  return (
    <div className="reports">
      <Sidebar />
      <div className="reportsContainer">
        <Navbar />
        <div className="wrapper">
          <div className="header">
            <div className="text">
              <h1>Reports & Export</h1>
              <span>Generate and export attendance, payroll, and calendar reports</span>
            </div>
            <div className="buttonGroup">
                <button className="exportBtn csv" onClick={exportToCSV}>
                <FileDownloadIcon /> CSV
                </button>
            </div>
          </div>

          <div className="tabs">
            <button 
              className={activeReport === "attendance" ? "active" : ""} 
              onClick={() => setActiveReport("attendance")}
            >
              <AssessmentIcon /> Attendance Report
            </button>
            <button 
              className={activeReport === "payroll" ? "active" : ""} 
              onClick={() => setActiveReport("payroll")}
            >
              <PaymentsIcon /> Payroll Report
            </button>
          </div>

          <div className="filtersCard">
            <div className="title">
              <FilterListIcon /> Filters
            </div>
            <div className="filterInputs">
              {activeReport === "payroll" ? (
                <div className="inputGroup">
                  <label>Payroll Period</label>
                  <select value={selectedPeriod} onChange={handlePeriodChange}>
                    <option value="custom">-- Select Period --</option>
                    {payrollPeriods.map(p => {
                      const [startY, startM, startD] = p.startDate.split('-').map(Number);
                      const [endY, endM, endD] = p.endDate.split('-').map(Number);
                      const startObj = new Date(startY, startM - 1, startD);
                      const month = startObj.toLocaleString('en-US', { month: 'short' });
                      const label = `${month} ${startD}-${endD}, ${startY}`;
                      return (
                        <option key={p.periodId} value={p.periodId}>
                          {label}
                        </option>
                      );
                    })}
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>
              ) : null}

              {(activeReport !== "payroll" || selectedPeriod === "custom") && (
                <>
                  <div className="inputGroup">
                    <label>Date From</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="inputGroup">
                    <label>Date To</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </>
              )}

              <div className="inputGroup">
                <label>Employee</label>
                <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
                  <option value="All Employees">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.user_Id} value={emp.user_Id}>
                      {emp.user_LastName}, {emp.user_FirstName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="recordsCard">
            {loading ? <div className="loading">Loading records...</div> : (
              <>
                {activeReport === "attendance" && (
                  <>
                    <div className="reportHeader">
                        <h3>Attendance Records</h3>
                        <span>Showing {attendanceData.length} records from {startDate} to {endDate}</span>
                    </div>
                    <table className="reportsTable">
                      <thead>
                        <tr>
                          <th>EMPLOYEE ID</th>
                          <th>EMPLOYEE NAME</th>
                          <th>DATE</th>
                          <th>TIME IN</th>
                          <th>TIME OUT</th>
                          <th>HOURS WORKED</th>
                          <th>STATUS</th>
                          <th>REMARKS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceData.map((r, i) => (
                          <tr key={i}>
                            <td>{formatUserId(r.user_Id)}</td>
                            <td>{r.userName}</td>
                            <td>{new Date(r.log_Date).toLocaleDateString()}</td>
                            <td>{r.time_In}</td>
                            <td>{r.time_Out}</td>
                            <td>{r.hoursWorked}</td>
                            <td>
                              <span className={`status ${r.status.toLowerCase().replace(/\s+/g, '')}`}>
                                {r.status}
                              </span>
                            </td>
                            <td>{r.remarks}</td>
                          </tr>
                        ))}
                        {attendanceData.length === 0 && <tr><td colSpan="8">No records found.</td></tr>}
                      </tbody>
                    </table>

                    <div className="summaryStats">
                      <div className="statBox">
                        <label>Total Present</label>
                        <p className="presentText">{stats.present}</p>
                      </div>
                      <div className="statBox">
                        <label>Total Absent</label>
                        <p className="absentText">{stats.absent}</p>
                      </div>
                      <div className="statBox">
                        <label>Total Late</label>
                        <p className="lateText">{stats.late}</p>
                      </div>
                      <div className="statBox">
                        <label>Total Hours</label>
                        <p>{stats.totalHours.toFixed(1)} hrs</p>
                      </div>
                    </div>
                  </>
                )}

                {activeReport === "payroll" && (
                  <>
                    <div className="reportHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3>Payroll Records</h3>
                          <span>Payroll data from {startDate} to {endDate}</span>
                        </div>
                        <button 
                          className="exportBtn zip" 
                          onClick={handleBatchExport}
                          disabled={payrollData.length === 0}
                        >
                          <FileDownloadIcon /> Batch Export (ZIP)
                        </button>
                    </div>
                    <table className="reportsTable payrollTable">
                    <thead>
                        <tr>
                        <th>PAYROLL ID</th>
                        <th>EMPLOYEE NAME</th>
                        <th>PERIOD</th>
                        <th>DAYS/HOURS</th>
                        <th>RATE/HR</th>
                        <th>BASIC PAY</th>
                        <th>TOTAL EARNINGS</th>
                        <th>DEDUCTIONS</th>
                        <th>NET PAY</th>
                        <th>STATUS</th>
                        <th className="no-print">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payrollData.map((r, i) => (
                          <tr key={i}>
                            <td>{r.payrollId}</td>
                            <td>{r.user_FirstName} {r.user_LastName}</td>
                            <td>{new Date(r.period_Start).toLocaleDateString()} - {new Date(r.period_End).toLocaleDateString()}</td>
                            <td>{r.NoDays_Worked}d / {r.NoHrs_Worked}h</td>
                            <td>₱{r.ratePerHr}</td>
                            <td>₱{r.basicPay.toLocaleString()}</td>
                            <td className="pos">₱{r.totalEarnings.toLocaleString()}</td>
                            <td className="neg">₱{r.totalDeductions.toLocaleString()}</td>
                            <td className="bold">₱{r.netPay.toLocaleString()}</td>
                            <td><span className={`status ${r.statusName.toLowerCase()}`}>{r.statusName}</span></td>
                            <td className="no-print">
                                <div className="actions">
                                <Link title="View Payslip" to={`/adminReports/payslip/${r.payrollId}`}>
                                    <ReceiptLongIcon className="payslipIcon" />
                                </Link>
                                </div>
                            </td>
                          </tr>
                        ))}
                        {payrollData.length === 0 && <tr><td colSpan="11">No records found.</td></tr>}
                    </tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;