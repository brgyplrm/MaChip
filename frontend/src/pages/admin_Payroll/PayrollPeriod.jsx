import React, { useState, useEffect } from "react";
import "./payrollPeriod.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import SearchIcon from "@mui/icons-material/Search";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FilterListIcon from "@mui/icons-material/FilterList";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import { Link, useLocation } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ProcessPayrollModal from "../../components/procpayrollmodal/ProcessPayrollModal";
import EditPayrollModal from "../../components/editPayrollModal/EditPayrollModal";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import { fetchWithAuth } from "../../utils/api";
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';

const PayrollPeriod = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalNetPay: 0,
    totalEarnings: 0,
    totalDeductions: 0
  });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState(null);
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [isMaxicareActive, setIsMaxicareActive] = useState(false);
  
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const periodIdFromUrl = queryParams.get("periodId");

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Periods
      const periodsRes = await fetchWithAuth("/api/system/payroll-periods");
      const periodsData = await periodsRes.json();

      // 2. Fetch System Settings for Maxicare schedule
      const settingsRes = await fetchWithAuth("/api/system/settings");
      const settings = await settingsRes.json();

      if (periodsRes.ok && periodsData.length > 0) {
        setPeriods(periodsData);
        let current;
        if (periodIdFromUrl) {
          current = periodsData.find(p => p.periodId === parseInt(periodIdFromUrl));
        }
        if (!current) current = periodsData[0];
        setSelectedPeriod(current);

        // Maxicare Schedule Check
        if (settingsRes.ok && settings.maxicareDates && current) {
          const isScheduled = settings.maxicareDates.some(d => {
            const d1 = new Date(d).toISOString().split('T')[0];
            const d2 = new Date(current.endDate).toISOString().split('T')[0];
            return d1 === d2;
          });
          setIsMaxicareActive(isScheduled);
        }

        if (current.status === 'Draft') {
          await fetchLivePreview(current);
        } else {
          await fetchSavedPayrolls(current);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchLivePreview = async (period) => {
    try {
      const empRes = await fetchWithAuth("/api/users/all");
      const employees = await empRes.json();
      if (!empRes.ok) return;

      const livePayrolls = [];
      let totalNet = 0, totalEarn = 0, totalDed = 0;

      for (const emp of employees.filter(e => e.dailyRate > 0)) {
        const prevRes = await fetchWithAuth(`/api/payroll/preview?user_Id=${emp.user_Id}&period_Start=${period.startDate}&period_End=${period.endDate}`);
        const preview = await prevRes.json();

        if (prevRes.ok) {
          livePayrolls.push({
            payrollId: `preview-${emp.user_Id}`,
            user_FirstName: emp.user_FirstName,
            user_LastName: emp.user_LastName,
            user_Id: emp.user_Id,
            period_Start: period.startDate,
            period_End: period.endDate,
            NoDays_Worked: preview.NoDays_Worked,
            NoHrs_Worked: preview.NoHrs_Worked,
            basicPay: preview.basicPay,
            totalEarnings: preview.totalEarnings,
            totalDeductions: preview.totalDeductions,
            netPay: preview.netPay,
            dailyRate: emp.dailyRate,
            taxStatus: emp.taxStatus,
            PaystatusName: "Draft"
          });

          totalNet += preview.netPay;
          totalEarn += preview.totalEarnings;
          totalDed += preview.totalDeductions;
        }
      }
      setPayrolls(livePayrolls);
      setStats({ totalNetPay: totalNet, totalEarnings: totalEarn, totalDeductions: totalDed });
    } catch (err) { console.error(err); }
  };

  const fetchSavedPayrolls = async (period) => {
    try {
      const response = await fetchWithAuth(`/api/payroll/report?startDate=${period.startDate}&endDate=${period.endDate}`);
      const data = await response.json();
      if (response.ok) {
        setPayrolls(data);
        const net = data.reduce((acc, p) => acc + parseFloat(p.netPay || 0), 0);
        const earn = data.reduce((acc, p) => acc + parseFloat(p.totalEarnings || 0), 0);
        const ded = data.reduce((acc, p) => acc + parseFloat(p.totalDeductions || 0), 0);
        setStats({ totalNetPay: net, totalEarnings: earn, totalDeductions: ded });
      }
    } catch (err) { console.error(err); }
  };

  const handleBatchProcess = async () => {
    if (!selectedPeriod) return;
    try {
      setLoading(true);
      const response = await fetchWithAuth("/api/payroll/batch-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_Start: selectedPeriod.startDate,
          period_End: selectedPeriod.endDate
        }),
      });
      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        fetchData();
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); setIsConfirmOpen(false); }
  };

  const handlePreviewSummary = async () => {
    if (!selectedPeriod) return;
    try {
      const response = await fetchWithAuth(`/api/payroll/summary-preview?period_Start=${selectedPeriod.startDate}&period_End=${selectedPeriod.endDate}`);
      if (response.ok) {
        const html = await response.text();
        setPreviewContent(html);
        setShowSummaryPreview(true);
      } else {
        alert("Failed to fetch summary preview.");
      }
    } catch (err) { console.error(err); }
  };

  const handleDownloadSummary = async () => {
    if (!selectedPeriod) return;
    try {
      const response = await fetchWithAuth(`/api/payroll/summary-pdf?period_Start=${selectedPeriod.startDate}&period_End=${selectedPeriod.endDate}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `PayrollSummary_${selectedPeriod.label.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert("Failed to download summary. Ensure payroll is processed for this period.");
      }
    } catch (err) { console.error(err); }
  };

  const handleEditPayroll = async (payroll) => {
    if (String(payroll.payrollId).startsWith("preview-")) {
      alert("This is a preview. Please 'Process Batch' first to edit individual deductions.");
      return;
    }
    // Fetch full details including deductions
    try {
      const res = await fetchWithAuth(`/api/payroll/${payroll.payrollId}`);
      const fullData = await res.json();
      if (res.ok) {
        setEditingPayroll(fullData);
        setIsEditModalOpen(true);
      }
    } catch (err) { console.error(err); }
  };

  const handleSavePayroll = async (updatedData) => {
    try {
      const response = await fetchWithAuth(`/api/payroll/update-full/${updatedData.payrollId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData)
      });
      if (response.ok) {
        setIsEditModalOpen(false);
        fetchData();
      } else {
        const err = await response.json();
        alert(err.error || "Failed to update payroll.");
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchData();
  }, [periodIdFromUrl]);

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
                <h1>
                  {selectedPeriod?.label} {selectedPeriod?.status === 'Draft' ? "Current Period" : "Previous Period"}
                </h1>
              </div>
              <span>{selectedPeriod?.startDate} to {selectedPeriod?.endDate}</span>
            </div>
            <div className="headerActions">
              <button 
                className="actionBtn previewBtn" 
                onClick={handlePreviewSummary}
              >
                <VisibilityIcon /> Summary Preview
              </button>
              <button 
                className={`actionBtn processBtn ${selectedPeriod?.status !== 'Draft' ? "disabled" : ""}`} 
                onClick={() => setIsConfirmOpen(true)}
                disabled={selectedPeriod?.status !== 'Draft'}
              >
                <GroupsOutlinedIcon /> {selectedPeriod?.status === 'Draft' ? "Process Batch" : "Processed"}
              </button>
              <button className="actionBtn refreshBtn" onClick={() => fetchData(true)}>
                <RefreshIcon /> Refresh
              </button>
            </div>
          </div>

          <div className="stats">
            {/* ... stats ... */}
            <div className="statCard">
              <div className="left">
                <div className="icon net"><span className="symbol">₱</span></div>
                <span className="title">Total Net Pay</span>
                <span className="amount">₱{stats.totalNetPay.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            </div>
            <div className="statCard">
              <div className="left">
                <div className="icon earnings"><span className="symbol"><KeyboardDoubleArrowUpIcon/></span></div>
                <span className="title">Total Earnings</span>
                <span className="amount">₱{stats.totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            </div>
            <div className="statCard">
              <div className="left">
                <div className="icon deductions"><span className="symbol"><KeyboardDoubleArrowDownIcon/></span></div>
                <span className="title">Total Deductions</span>
                <span className="amount">₱{stats.totalDeductions.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
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
                    <th>BASIC PAY</th>
                    <th>EARNINGS</th>
                    <th>DEDUCTIONS</th>
                    <th>NET PAY</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map(p => (
                    <tr key={p.payrollId}>
                      <td>
                        <div className="empName">{p.user_FirstName || p.userName} {p.user_LastName || ""}</div>
                        <div className="id">ID: {formatUserId(p.user_Id)}</div>
                      </td>
                      <td>₱{parseFloat(p.basicPay).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="pos">+₱{parseFloat(p.totalEarnings).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="neg">-₱{parseFloat(p.totalDeductions).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="bold">₱{parseFloat(p.netPay).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td>
                        <span className={`status ${p.PaystatusName?.toLowerCase() || p.statusName?.toLowerCase() || "draft"}`}>
                          {p.PaystatusName || p.statusName || "Draft"}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          <Link to={`/payrollDetails/${p.payrollId}?start=${p.period_Start || selectedPeriod.startDate}&end=${p.period_End || selectedPeriod.endDate}`}>
                            <VisibilityIcon className="view" />
                          </Link>
                          {selectedPeriod?.status !== 'Released' && (
                            <EditIcon 
                              className="edit" 
                              onClick={() => handleEditPayroll(p)}
                              style={{ cursor: 'pointer', color: '#3b82f6', marginLeft: '10px' }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <ProcessPayrollModal 
            isOpen={isConfirmOpen} 
            onClose={() => setIsConfirmOpen(false)} 
            onConfirm={handleBatchProcess}
            employeeCount={payrolls.length}
          />
          <EditPayrollModal 
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            data={editingPayroll}
            onSave={handleSavePayroll}
          />
          
          {/* Summary Preview Modal */}
          {showSummaryPreview && (
            <div className="summaryPreviewOverlay">
              <div className="summaryPreviewModal">
                <div className="modalHeader">
                  <h2>Payroll Summary Preview</h2>
                  <div className="headerBtns">
                    <button className="exportBtn" onClick={handleDownloadSummary} style={{ cursor: 'pointer' }}>
                      <DownloadIcon /> Confirm & Export PDF
                    </button>
                    <button className="closeBtn" onClick={() => setShowSummaryPreview(false)} style={{ cursor: 'pointer' }}>
                      <CloseIcon /> Close
                    </button>
                  </div>
                </div>
                <div className="modalBody">
                  <iframe 
                    title="Summary Preview"
                    srcDoc={previewContent}
                    style={{ width: '100%', height: '80vh', border: 'none', background: 'white' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PayrollPeriod;
