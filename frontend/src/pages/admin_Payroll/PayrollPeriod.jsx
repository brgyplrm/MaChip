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
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ProcessPayrollModal from "../../components/procpayrollmodal/ProcessPayrollModal";
import CreatePeriodModal from "../../components/createperiodmodal/CreatePeriodModal";
import EventNoteIcon from "@mui/icons-material/EventNote";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { exportBatchToZip } from "../../utils/payrollExport";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const PayrollPeriod = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPeriodLabel, setCurrentPeriodLabel] = useState("Loading...");
  const [periodDates, setPeriodDates] = useState({ start: null, end: null });
  const [stats, setStats] = useState({
    totalNetPay: 0,
    totalEarnings: 0,
    totalDeductions: 0
  });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [systemToday, setSystemToday] = useState("");

  const fetchPeriodsList = async () => {
    try {
      const timeRes = await fetch("http://localhost:4000/api/system/time");
      const { systemTime } = await timeRes.json();
      const today = new Date(systemTime);
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      setSystemToday(todayStr);

      const response = await fetch("http://localhost:4000/api/system/payroll-periods");
      const data = await response.json();
      
      if (response.ok && data.length > 0) {
        setPeriods(data);
        return data;
      }
    } catch (error) {
      console.error("Error fetching periods:", error);
    }
    return [];
  };

  const setPeriodDisplay = (active) => {
    if (!active) return;
    const [startY, startM, startD] = active.startDate.split('-').map(Number);
    const [endY, endM, endD] = active.endDate.split('-').map(Number);
    const startObj = new Date(startY, startM - 1, startD);
    const month = startObj.toLocaleString('en-US', { month: 'long' });

    setCurrentPeriodLabel(`${month} ${startD}-${endD}, ${startY}`);
    setPeriodDates({ start: active.startDate, end: active.endDate });
  };

  const fetchLivePayrolls = async (period) => {
    if (!period) return;
    try {
      const empRes = await fetch("http://localhost:4000/api/users/all");
      const employees = await empRes.json();
      if (!empRes.ok) return;

      const livePayrolls = [];
      let totalNet = 0, totalEarn = 0, totalDed = 0;

      for (const emp of employees.filter(e => e.dailyRate > 0)) {
        const prevRes = await fetch(`http://localhost:4000/api/payroll/preview?user_Id=${emp.user_Id}&period_Start=${period.startDate}&period_End=${period.endDate}`);
        const preview = await prevRes.json();

        if (prevRes.ok) {
          const ratePerHr = emp.dailyRate / 8;
          const ratePerMin = ratePerHr / 60;
          
          const combinedAbsences = (preview.absence_Days || 0) + (preview.unpaidLeave_Days || 0);
          const daysWorked = (preview.totalScheduledDays || 0) - combinedAbsences;
          const basicPay = daysWorked * 8 * ratePerHr;
          const otPay = (preview.OT_Hrs || 0) * ratePerHr;
          const tardinessDed = (preview.tardiness_Mins || 0) * ratePerMin;
          const absenceDed = combinedAbsences * emp.dailyRate;

          const earnings = basicPay + otPay;
          const deductions = tardinessDed + absenceDed;
          const net = earnings - deductions;

          livePayrolls.push({
            payrollId: `live-${emp.user_Id}`,
            user_FirstName: emp.user_FirstName,
            user_LastName: emp.user_LastName,
            user_Id: emp.user_Id,
            period_Start: period.startDate,
            period_End: period.endDate,
            NoDays_Worked: daysWorked,
            NoHrs_Worked: daysWorked * 8,
            basicPay: basicPay,
            totalEarnings: earnings,
            totalDeductions: deductions,
            netPay: net,
            PaystatusName: "Live"
          });

          totalNet += net;
          totalEarn += earnings;
          totalDed += deductions;
        }
      }

      setPayrolls(livePayrolls);
      setStats({
        totalNetPay: totalNet,
        totalEarnings: totalEarn,
        totalDeductions: totalDed
      });
    } catch (error) {
      console.error("Error fetching live payrolls:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    const list = await fetchPeriodsList();
    if (list.length > 0) {
      const selected = list[selectedPeriodIdx];
      setPeriodDisplay(selected);
      
      // Check if this period already has processed payrolls in the DB
      const checkRes = await fetch(`http://localhost:4000/api/payroll/all?start=${selected.startDate}&end=${selected.endDate}`);
      const checkData = await checkRes.json();
      
      if (Array.isArray(checkData) && checkData.length > 0) {
        // Show saved data
        setPayrolls(checkData);
        const net = checkData.reduce((acc, p) => acc + parseFloat(p.netPay || 0), 0);
        const earn = checkData.reduce((acc, p) => acc + parseFloat(p.totalEarnings || 0), 0);
        const ded = checkData.reduce((acc, p) => acc + parseFloat(p.totalDeductions || 0), 0);
        setStats({ totalNetPay: net, totalEarnings: earn, totalDeductions: ded });
        setLoading(false);
        setRefreshing(false);
      } else {
        // Show live preview
        await fetchLivePayrolls(selected);
      }
    } else {
      setLoading(false);
      setRefreshing(false);
      setCurrentPeriodLabel("No Active Period");
    }
  };

  const handleFinalProcess = async () => {
    if (!periodDates.start || !periodDates.end) {
      alert("Missing period dates.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("http://localhost:4000/api/payroll/batch-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_Start: periodDates.start,
          period_End: periodDates.end
        }),
      });
      const result = await response.json();
      if (response.ok) {
        alert(`${result.message}\nProcessed: ${result.processed}\nSkipped: ${result.skipped}`);
        fetchData();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error creating batch payroll:", error);
      alert("Failed to generate batch payroll.");
    } finally {
      setLoading(false);
      setIsConfirmOpen(false);
    }
  };

  const handleRefresh = () => fetchData(true);

  useEffect(() => {
    fetchData();
  }, [selectedPeriodIdx]);

  return (
    <div className="payroll">
      <Sidebar />
      <div className="payrollContainer">
        <Navbar />
        <div className="wrapper">
          <div className="header">
            <div className="text">
              <div className="titleWithBack">
                <Link to="/payroll" className="backLink">
                  <ArrowBackIcon className="backIcon" />
                </Link>
                <h1>Payroll Period ({currentPeriodLabel}) {selectedPeriodIdx === 0 ? "(Current)" : "(Previous)"}</h1>
              </div>
              <span>Manage employee payroll and compensation</span>
            </div>
            <div className="headerActions">
              <button 
                className={`actionBtn processBtn ${ (selectedPeriodIdx !== 0 || periodDates.end < systemToday) ? "disabled" : ""}`} 
                onClick={() => setIsConfirmOpen(true)}
                disabled={selectedPeriodIdx !== 0 || periodDates.end < systemToday}
                title={selectedPeriodIdx !== 0 ? "Only the current period can be batch processed." : (periodDates.end < systemToday ? "This period is over." : "")}
              >
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
                <span className="amount">₱{stats.totalNetPay.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            </div>
            <div className="statCard">
              <div className="left">
                <div className="icon earnings"><span className="symbol">📈</span></div>
                <span className="title">Total Earnings</span>
                <span className="amount">₱{stats.totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            </div>
            <div className="statCard">
              <div className="left">
                <div className="icon deductions"><span className="symbol">📉</span></div>
                <span className="title">Total Deductions</span>
                <span className="amount">₱{stats.totalDeductions.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
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
              <select value={selectedPeriodIdx} onChange={(e) => setSelectedPeriodIdx(parseInt(e.target.value))}>
                {periods.map((p, idx) => (
                  <option key={p.periodId} value={idx}>
                    {p.startDate} to {p.endDate} {idx === 0 ? "(Latest)" : ""}
                  </option>
                ))}
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
                      <td>₱{parseFloat(p.basicPay).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="pos">+₱{parseFloat(p.totalEarnings).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="neg">-₱{parseFloat(p.totalDeductions).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="bold">₱{parseFloat(p.netPay).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td>
                        <span className={`status ${p.PaystatusName?.toLowerCase() || (p.status === 2 ? "released" : "live")}`}>
                          {p.PaystatusName || (p.status === 2 ? "Released" : "Live")}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          <Link to={`/payrollDetails/${p.payrollId}?start=${p.period_Start}&end=${p.period_End}`}><VisibilityIcon className="view" /></Link>
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
          <ProcessPayrollModal 
          isOpen={isConfirmOpen} 
          onClose={() => setIsConfirmOpen(false)} 
          onConfirm={handleFinalProcess}
          employeeCount={payrolls.length}
          />
        </div>
      </div>
    </div>
  );
};

export default PayrollPeriod;
