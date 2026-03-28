import React, { useState, useEffect } from "react";
import "./payroll_Management.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RefreshIcon from "@mui/icons-material/Refresh";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import EventNoteIcon from "@mui/icons-material/EventNote";
import { Link } from "react-router-dom";
import CreatePeriodModal from "../../components/createperiodmodal/CreatePeriodModal";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";


const Payroll = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalNetPay: 0,
    totalEarnings: 0,
    totalDeductions: 0
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleCreatePeriod = (data) => {
    console.log("Creating period for:", data);
    // Add your API call here
    setIsModalOpen(false);
  };

  const fetchPayrolls = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch("http://localhost:4000/api/payroll/all");
      const data = await response.json();
      if (response.ok) {
        setPayrolls(data);
        
        // Calculate stats
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
                onClick={() => setIsModalOpen(true)}
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

          {/* New Alert Section */}
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

          {/* New Active Period Card */}
          <div className="sectionTitle">Active Period</div><br />
          <div className="activePeriodCard">
            <div className="cardHeader">
              <div className="periodIcon"><CalendarMonthIcon /></div>
              <div className="periodInfo">
                <h3>March 2026</h3>
                <span>3/1/2026 - 3/31/2026</span>
              </div>
              <span className="statusDraft">Draft</span>
            </div>
            <div className="cardDetails">
              <div className="detailRow"><label>Employees:</label><span>Not calculated</span></div>
              <div className="detailRow"><label>Total Amount:</label><span>Not calculated</span></div>
            </div>
            <Link to="/payroll/payrollPeriod" style={{ textDecoration: "none" }}>
              <button className="processBtn">
                <VisibilityIcon /> Process Payroll
              </button>
            </Link>
          </div>

          {/* New Previous Periods Table */}
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

          <CreatePeriodModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
      </div>
    </div>
  );
};

export default Payroll;