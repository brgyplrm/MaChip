import React, { useState, useEffect } from "react";
import "./payrollPeriod.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import SearchIcon from "@mui/icons-material/Search";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FilterListIcon from "@mui/icons-material/FilterList";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Link } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import CreatePeriodModal from "../../components/CreatePeriodModal";
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ProcessPayrollModal from "../../components/ProcessPayrollModal";
import Breadcrumbs from "../../components/breadcrumbs/Breadcrumbs";



const PayrollPeriod = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalNetPay: 0,
    totalEarnings: 0,
    totalDeductions: 0
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
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

  const handleFinalProcess = () => {
    console.log("Finalizing payroll processing...");}

  return (
    <div className="payroll">
      <Sidebar />
      <div className="payrollContainer">
        <Navbar />
        <div className="wrapper">
          <Breadcrumbs />
          <div className="header">
            <div className="text">
              <h1>Payroll Period</h1>
              <span>Manage employee payroll and compensation</span>
            </div>
            <div className="headerActions">
              <button className={`actionBtn processBtn`} onClick={() => setIsConfirmOpen(true)}>
                <GroupsOutlinedIcon /> Process Batch
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

          <div className="stats">
            <div className="statCard">
              <div className="left">
                <div className="icon net"><span className="symbol">₱</span></div>
                <span className="title">Total Net Pay</span>
                <span className="amount">₱{stats.totalNetPay.toLocaleString()}</span>
              </div>
            </div>
            <div className="statCard">
              <div className="left">
                <div className="icon earnings"><span className="symbol">📈</span></div>
                <span className="title">Total Earnings</span>
                <span className="amount">₱{stats.totalEarnings.toLocaleString()}</span>
              </div>
            </div>
            <div className="statCard">
              <div className="left">
                <div className="icon deductions"><span className="symbol">📉</span></div>
                <span className="title">Total Deductions</span>
                <span className="amount">₱{stats.totalDeductions.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="filters">
            <div className="search">
              <SearchIcon className="icon" />
              <input type="text" placeholder="Search by employee name..." />
            </div>
            <div className="select">
              <CalendarTodayIcon className="icon" />
              <select>
                <option>All Periods</option>
                <option>Current Period</option>
                <option>Last Period</option>
              </select>
            </div>
            <div className="select">
              <FilterListIcon className="icon" />
              <select>
                <option>All Status</option>
                <option>Processing</option>
                <option>Released</option>
              </select>
            </div>
          </div>

          <div className="tableContainer">
            {loading ? (
              <p>Loading payroll records...</p>
            ) : (
              <table className="payrollTable">
                <thead>
                  <tr>
                    <th>EMPLOYEE</th>
                    <th>PERIOD</th>
                    <th>DAYS/HOURS</th>
                    <th>BASIC PAY</th>
                    <th>EARNINGS</th>
                    <th>DEDUCTIONS</th>
                    <th>NET PAY</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.length > 0 ? payrolls.map(p => (
                    <tr key={p.payrollId}>
                      <td>
                        <div className="empName">{p.user_FirstName} {p.user_LastName}</div>
                        <div className="id">ID: {formatUserId(p.user_Id)}</div>
                      </td>
                      <td>{p.period_Start} to {p.period_End}</td>
                      <td>{p.NoDays_Worked} days / {p.NoHrs_Worked} hrs</td>
                      <td>₱{parseFloat(p.basicPay).toLocaleString()}</td>
                      <td className="pos">+₱{parseFloat(p.totalEarnings).toLocaleString()}</td>
                      <td className="neg">-₱{parseFloat(p.totalDeductions).toLocaleString()}</td>
                      <td className="bold">₱{parseFloat(p.netPay).toLocaleString()}</td>
                      <td>
                        <span className={`status ${p.PaystatusName?.toLowerCase()}`}>
                          {p.PaystatusName}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          <Link to={`/payrollDetails/${p.payrollId}`}><VisibilityIcon className="view" /></Link>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="9" style={{ textAlign: "center", padding: "20px" }}>No payroll records found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <CreatePeriodModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)}
            onCreate={handleCreatePeriod}
          />
          <ProcessPayrollModal 
          isOpen={isConfirmOpen} 
          onClose={() => setIsConfirmOpen(false)} 
          onConfirm={handleFinalProcess} 
          />
        </div>
      </div>
    </div>
  );
};

export default PayrollPeriod;