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
  const [allPeriods, setAllPeriods] = useState([]);

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
      
      if (current.getDate() <= 15) {
        start = new Date(year, month, 16);
        end = new Date(year, month + 1, 0); 
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
      const response = await fetch("/api/system/payroll-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: periodData.startDate,
          endDate: periodData.endDate,
          label: `${periodData.month} ${periodData.year}`
        })
      });

      if (response.ok) {
        setIsCreateModalOpen(false);
        fetchActive();
      } else {
        alert("Failed to save payroll period.");
      }
    } catch (error) {
      console.error("Error saving period:", error);
    }
  };

  const fetchActive = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/system/payroll-periods");
      const data = await response.json();
      
      if (response.ok && data.length > 0) {
        setAllPeriods(data);
        
        // ACTIVE = The most recent DRAFT period
        const draftPeriods = data.filter(p => p.status === 'Draft');
        const active = draftPeriods[0]; 

        if (active) {
          const [startY, startM, startD] = active.startDate.split('-').map(Number);
          const [endY, endM, endD] = active.endDate.split('-').map(Number);
          const startObj = new Date(startY, startM - 1, startD);
          const endObj = new Date(endY, endM - 1, endD);
          
          setActivePeriod({
            id: active.periodId,
            month: startObj.toLocaleString('en-US', { month: 'long' }),
            year: startY,
            periodText: `${startObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${endObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
            startDate: active.startDate,
            endDate: active.endDate,
            status: active.status,
            employees: active.employeeCount,
            amount: `₱${parseFloat(active.totalAmount).toLocaleString()}`
          });
        } else {
          setActivePeriod(null);
        }

        setUpcomingPeriods(generateUpcomingPeriods(data[0].endDate, 3));
      }
    } catch (error) {
      console.error("Error fetching periods:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => fetchActive();

  useEffect(() => {
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
                <RefreshIcon /> Refresh
              </button>
            </div>
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
                    <div className="detailRow"><label>Estimated Pay:</label><span>{activePeriod.amount}</span></div>
                  </div>
                  <Link to={`/payroll/payrollPeriod?periodId=${activePeriod.id}`} style={{ textDecoration: "none" }}>
                    <button className="processBtn">
                      <VisibilityIcon /> Process Payroll
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="noActivePeriod">
                  <p>No draft payroll periods. Use the next period card to start one.</p>
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
          <div className="sectionTitle">Previous Periods (Locked)</div>
          <div className="tableCard">
            <table className="customPayrollTable">
              <thead>
                <tr>
                  <th>Period Label</th>
                  <th>Date Range</th>
                  <th>Employees</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th className="actionHead">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allPeriods.filter(p => p.status !== 'Draft' || (activePeriod && p.periodId !== activePeriod.id)).length > 0 ? (
                  allPeriods
                    .filter(p => p.status !== 'Draft' || (activePeriod && p.periodId !== activePeriod.id))
                    .map((p, index) => (
                      <tr key={index}>
                        <td className="boldText">{p.label}</td>
                        <td>{`${new Date(p.startDate).toLocaleDateString()} - ${new Date(p.endDate).toLocaleDateString()}`}</td>
                        <td>{p.employeeCount || 0}</td>
                        <td className="amountText">₱{(parseFloat(p.totalAmount) || 0).toLocaleString()}</td>
                        <td>
                          <span className={`statusPill ${p.status?.toLowerCase() || "draft"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td>
                          <div className="cellAction">
                            <Link to={`/payroll/payrollPeriod?periodId=${p.periodId}`} className="viewBtn">
                              <VisibilityIcon className="icon" /> View Details
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan="6" className="noData">No previous periods found</td>
                  </tr>
                )}
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
