import React, { useState, useEffect } from "react";
import "./payroll_Management.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RefreshIcon from "@mui/icons-material/Refresh";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import EventNoteIcon from "@mui/icons-material/EventNote";
import { Link } from "react-router-dom";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CreatePeriodModal from "../../components/createperiodmodal/CreatePeriodModal";
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';

const Payroll = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalNetPay: 0,
    totalEarnings: 0,
    totalDeductions: 0
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activePeriod, setActivePeriod] = useState(null);
  const [upcomingPeriods, setUpcomingPeriods] = useState([]);

  const formatLocalISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to generate next N periods
  const generateUpcomingPeriods = (startDate, count = 3) => {
    const periods = [];
    let current;
    
    if (typeof startDate === "string") {
      const [y, m, d] = startDate.split("-").map(Number);
      current = new Date(y, m - 1, d);
    } else {
      current = new Date(startDate);
    }
    
    for (let i = 0; i < count; i++) {
      let start, end, half;
      const year = current.getFullYear();
      const month = current.getMonth();
      
      // Strict logic for 1st half (1-15) and 2nd half (16-End)
      if (current.getDate() <= 15) {
        start = new Date(year, month, 16);
        end = new Date(year, month + 1, 0); // Last day of same month
        half = "2nd Half";
      } else {
        start = new Date(year, month + 1, 1);
        end = new Date(year, month + 1, 15);
        half = "1st Half";
      }
      
      const monthName = start.toLocaleString('default', { month: 'long' });
      const periodText = `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      
      periods.push({
        month: monthName,
        year: start.getFullYear(),
        half,
        periodText,
        startDate: formatLocalISO(start),
        endDate: formatLocalISO(end)
      });
      
      current = new Date(start);
    }
    return periods;
  };

  const handleCreatePeriod = async (periodData) => {
    try {
      const response = await fetch("http://localhost:4000/api/system/payroll-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: periodData.startDate,
          endDate: periodData.endDate,
          label: `${periodData.month} ${periodData.year}`
        })
      });

      if (response.ok) {
        const newPeriod = {
          month: periodData.month,
          year: periodData.year,
          periodText: periodData.periodText,
          startDate: periodData.startDate,
          endDate: periodData.endDate,
          status: "Draft",
          employees: "Not calculated",
          amount: "Not calculated"
        };
        
        setActivePeriod(newPeriod);
        
        // Use endDate to generate what strictly follows
        const upcoming = generateUpcomingPeriods(periodData.endDate, 3);
        setUpcomingPeriods(upcoming);
        setIsCreateModalOpen(false);
      } else {
        alert("Failed to save payroll period to database.");
      }
    } catch (error) {
      console.error("Error saving period:", error);
      alert("Error saving payroll period.");
    }
  };

  const fetchPayrolls = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch("http://localhost:4000/api/payroll/all");
      const data = await response.json();
      if (response.ok) {
        setPayrolls(data);
        
        const totalNet = data.reduce((sum, p) => sum + parseFloat(p.netPay || 0), 0);
        const totalEarn = data.reduce((sum, p) => sum + parseFloat(p.totalEarnings || 0), 0);
        const totalDed = data.reduce((sum, p) => sum + parseFloat(p.totalDeductions || 0), 0);
        
        setStats({
          totalNetPay: totalNet,
          totalEarnings: totalEarn,
          totalDeductions: totalDed
        });
      }
    } catch (error) {
      console.error("Error fetching payrolls:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => fetchPayrolls(true);

  useEffect(() => {
    fetchPayrolls();
    
    const fetchActive = async () => {
      try {
        // 1. Get System Time (handles mock time)
        const timeRes = await fetch("http://localhost:4000/api/system/time");
        const { systemTime } = await timeRes.json();
        const today = new Date(systemTime);
        const todayStr = formatLocalISO(today);

        // 2. Get all periods
        const response = await fetch("http://localhost:4000/api/system/payroll-periods");
        const data = await response.json();
        
        if (response.ok && data.length > 0) {
          // Find the period that includes "today"
          let active = data.find(p => todayStr >= p.startDate && todayStr <= p.endDate);
          
          // If no period includes today, take the most recent one
          if (!active) active = data[0];

          const [startY, startM, startD] = active.startDate.split('-').map(Number);
          const [endY, endM, endD] = active.endDate.split('-').map(Number);
          const startObj = new Date(startY, startM - 1, startD);
          const endObj = new Date(endY, endM - 1, endD);
          
          setActivePeriod({
            month: startObj.toLocaleString('en-US', { month: 'long' }),
            year: startY,
            periodText: `${startObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${endObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
            startDate: active.startDate,
            endDate: active.endDate,
            status: "Draft",
            employees: "Not calculated",
            amount: "Not calculated"
          });

          // Generate upcoming based on the LATEST period in the database
          setUpcomingPeriods(generateUpcomingPeriods(data[0].endDate, 3));
        } else {
          setUpcomingPeriods(generateUpcomingPeriods(todayStr, 3));
        }
      } catch (error) {
        console.error("Error fetching active period:", error);
      }
    };

    fetchActive();
  }, []);

  return (
    <div className="payroll">
      <Sidebar />
      <div className="payrollContainer">
        <Navbar />
        <div className="wrapper">
          <div className="header">
            <div className="text">
              <h1>Payroll Management</h1>
              <span>Manage employee payroll and compensation</span>
            </div>
            <div className="headerActions">
               <Link to="/payroll/employeeList" style={{ textDecoration: "none" }}>
                <button className="actionBtn employeeBtn">
                  <PeopleAltIcon /> Employee List
                </button>
              </Link>
              <button 
                className="actionBtn scheduleBtn" 
                onClick={() => setIsCreateModalOpen(true)}
              >
                <EventNoteIcon /> Payroll Schedule
              </button>
              <button
                className={`actionBtn refreshBtn ${refreshing ? "spinning" : ""}`}
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshIcon /> {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="infoAlert">
            <div className="alertTitle">
              <InfoOutlinedIcon className="icon" /> 
              <h3>Batch Payroll Processing</h3>
            </div>
            <p>
              Create a new payroll period to automatically calculate payroll for all employees based on their daily rates and attendance records. 
              Once processed, the period will be locked and cannot be edited.
            </p>
          </div>

          <div className="periodsGrid">
            <div className="periodColumn">
              <div className="sectionTitle">Active Period</div>
              {activePeriod ? (
                <div className="activePeriodCard">
                  <div className="cardHeader">
                    <div className="periodIcon"><CalendarMonthIcon /></div>
                    <div className="periodInfo">
                      <h3>{activePeriod.month} {activePeriod.year}</h3>
                      <span>{activePeriod.periodText}</span>
                    </div>
                    <span className="statusDraft">{activePeriod.status}</span>
                  </div>
                  <div className="cardDetails">
                    <div className="detailRow"><label>Employees:</label><span>{activePeriod.employees}</span></div>
                    <div className="detailRow"><label>Total Amount:</label><span>{activePeriod.amount}</span></div>
                  </div>
                  <Link to="/payroll/payrollPeriod" style={{ textDecoration: "none" }}>
                    <button className="processBtn">
                      <VisibilityIcon /> Process Payroll
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="noActivePeriod">
                  <p>No active payroll period. Click "Payroll Schedule" or use the next period card to create one.</p>
                </div>
              )}
            </div>

            {upcomingPeriods.length > 0 && (
              <div className="periodColumn">
                <div className="sectionTitle">Next Period</div>
                <div className="activePeriodCard nextPeriod">
                  <div className="cardHeader">
                    <div className="periodIcon"><CalendarMonthIcon /></div>
                    <div className="periodInfo">
                      <h3>{upcomingPeriods[0].month} {upcomingPeriods[0].year}</h3>
                      <span>{upcomingPeriods[0].periodText}</span>
                    </div>
                    <span className="statusDraft">Upcoming</span>
                  </div>
                  <div className="cardDetails">
                    <div className="detailRow">
                      <p>Automated schedule for the {upcomingPeriods[0].half.toLowerCase()}.</p>
                    </div>
                  </div>
                  <button className="processBtn createNextBtn" onClick={() => handleCreatePeriod(upcomingPeriods[0])}>
                    <EventNoteIcon /> Create This Period
                  </button>
                </div>
              </div>
            )}
          </div>

          <br />
          <div className="sectionTitle">Previous Periods (Locked)</div><br />
          <div className="previousPeriodsTable">
            <table>
              <thead>
                <tr>
                  <th>PERIOD</th><th>DATE RANGE</th><th>EMPLOYEES</th>
                  <th>TOTAL AMOUNT</th><th>PROCESSED DATE</th><th>STATUS</th><th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan="7" className="emptyState">No previous periods found</td></tr>
              </tbody>
            </table>
          </div>

          <CreatePeriodModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onCreate={handleCreatePeriod}
          />
        </div>
      </div>
    </div>
  );
};

export default Payroll;