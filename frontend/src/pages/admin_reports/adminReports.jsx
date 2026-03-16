import React, { useState } from "react";
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

const Reports = () => {
  const [activeReport, setActiveReport] = useState("attendance");

  return (
    <div className="reports">
      <Sidebar />
      <div className="reportsContainer">
        <Navbar />
        <div className="wrapper">
          {/* Header Section */}
          <div className="header">
            <div className="text">
              <h1>Reports & Export</h1>
              <span>Generate and export attendance, payroll, and calendar reports</span>
            </div>
            <button className="exportBtn">
              <FileDownloadIcon /> Export to CSV
            </button>
          </div>

          {/* Report Selection Tabs */}
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
            <button 
              className={activeReport === "calendar" ? "active" : ""} 
              onClick={() => setActiveReport("calendar")}
            >
              <CalendarMonthIcon /> Calendar Report
            </button>
          </div>

          {/* Filters Section */}
          <div className="filtersCard">
            <div className="title">
              <FilterListIcon /> Filters
            </div>
            <div className="filterInputs">
              <div className="inputGroup">
                <label>Date From</label>
                <input type="date" defaultValue="2026-03-01" />
              </div>
              <div className="inputGroup">
                <label>Date To</label>
                <input type="date" defaultValue="2026-03-16" />
              </div>
              <div className="inputGroup">
                <label>Employee</label>
                <select>
                  <option>All Employees</option>
                  <option>Kathleen Pinto</option>
                  <option>John Dela Cruz</option>
                </select>
              </div>
            </div>
          </div>

          {/* Dynamic Records Card */}
          <div className="recordsCard">
            
            {/* 1. Attendance Report View */}
            {activeReport === "attendance" && (
              <>
                <h3>Attendance Records</h3>
                <span>Showing 10 records from 3/1/2026 to 3/16/2026</span>
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
                    <tr>
                      <td>1</td>
                      <td>Kathleen Pinto</td>
                      <td>3/16/2026</td>
                      <td>08:00:00</td>
                      <td>17:00:00</td>
                      <td>8 hrs</td>
                      <td><span className="status present">Present</span></td>
                      <td>-</td>
                    </tr>
                    <tr>
                      <td>1</td>
                      <td>Kathleen Pinto</td>
                      <td>3/15/2026</td>
                      <td>08:15:00</td>
                      <td>17:05:00</td>
                      <td>8 hrs</td>
                      <td><span className="status late">Late</span></td>
                      <td className="remarks">Late by 15 mins</td>
                    </tr>
                  </tbody>
                </table>

                {/* Statistics Row: Only for Attendance */}
                <div className="summaryStats">
                  <div className="statBox">
                    <label>Total Present</label>
                    <p className="presentText">6</p>
                  </div>
                  <div className="statBox">
                    <label>Total Absent</label>
                    <p className="absentText">1</p>
                  </div>
                  <div className="statBox">
                    <label>Total Late</label>
                    <p className="lateText">1</p>
                  </div>
                  <div className="statBox">
                    <label>Total Hours</label>
                    <p>64 hrs</p>
                  </div>
                </div>
              </>
            )}

            {/* 2. Payroll Report View */}
            {activeReport === "payroll" && (
            <>
                <h3>Payroll Records</h3>
                <span>Payroll data from 3/1/2026 to 3/16/2026</span>
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
                    <th>ACTIONS</th> {/* New Column Header */}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                    <td>1</td>
                    <td>Kathleen Pinto</td>
                    <td>Mar 1 - Mar 15 2026</td>
                    <td>10d / 80h</td>
                    <td>₱150</td>
                    <td>₱12,000</td>
                    <td className="pos">₱15,500</td>
                    <td className="neg">₱1,200</td>
                    <td className="bold">₱14,300</td>
                    <td><span className="status paid">Paid</span></td>
                    <td>
                        {/* New Action Button linking to the payslip page */}
                        <div className="actions">
                        <Link title="View Payslip" to={`/adminReports/payslip/1`}>
                            <ReceiptLongIcon className="payslipIcon" />
                        </Link>
                        </div>
                    </td>
                    </tr>
                </tbody>
                </table>
            </>
            )}

            {/* 3. Calendar Report View */}
            {activeReport === "calendar" && (
              <>
                <h3>Calendar Events</h3>
                <span>Holidays, leaves, and field work from 3/1/2026 to 3/16/2026</span>
                <table className="reportsTable calendarTable">
                  <thead>
                    <tr>
                      <th>TYPE</th>
                      <th>DATE</th>
                      <th>NAME/EMPLOYEE</th>
                      <th>DETAILS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="eventTag holiday">Holiday</span></td>
                      <td>March 25, 2026</td>
                      <td className="bold">Araw ng Dabaw</td>
                      <td>Special Holiday</td>
                    </tr>
                    <tr>
                      <td><span className="eventTag fieldWork">Field Work</span></td>
                      <td>March 20, 2026</td>
                      <td className="bold">Kathleen Pinto</td>
                      <td>Client Site A - Project Meeting</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;