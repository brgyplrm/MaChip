import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
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

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 p-4 md:p-4 w-full overflow-x-hidden min-w-0">
        
        {/* Header section with back button */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-start md:items-center gap-4">
            <Link 
              to="/payroll" 
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#f0ebfa] text-[#2A174E] transition-colors shrink-0 mt-1 md:mt-0 hover:scale-110"
            >
              <ArrowBackIcon className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight">
                {selectedPeriod?.label} {selectedPeriod?.status === 'Draft' ? "Current Period" : "Previous Period"}
              </h1>
              <span className="text-sm text-slate-500 mt-1 block">
                {selectedPeriod?.startDate} to {selectedPeriod?.endDate}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0">
            <Button 
              className={`w-full sm:w-auto bg-[#e6f7ff] text-[#004085] border border-[#b8daff] hover:bg-[#bae7ff] ${selectedPeriod?.status !== 'Draft' ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => setIsConfirmOpen(true)}
              disabled={selectedPeriod?.status !== 'Draft'}
            >
              <GroupsOutlinedIcon className="mr-2 h-4 w-4" /> {selectedPeriod?.status === 'Draft' ? "Process Batch" : "Processed"}
            </Button>
            <Button 
              className="w-full sm:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30]" 
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshIcon className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Statistics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-sm border-0 bg-white py-0">
            <CardContent className="p-6">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-4">
                <span className="text-green-700 font-bold text-lg">₱</span>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Net Pay</p>
              <p className="text-2xl font-bold text-[#2A174E]">₱{stats.totalNetPay.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-0 bg-white py-0">
            <CardContent className="p-6">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <KeyboardDoubleArrowUpIcon className="text-blue-700 h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Earnings</p>
              <p className="text-2xl font-bold text-[#2A174E]">₱{stats.totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-0 bg-white py-0">
            <CardContent className="p-6">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center mb-4">
                <KeyboardDoubleArrowDownIcon className="text-red-700 h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Deductions</p>
              <p className="text-2xl font-bold text-[#2A174E]">₱{stats.totalDeductions.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </CardContent>
          </Card>
        </div>

        {/* Table Card */}
        <Card className="shadow-sm border-0 bg-white py-2 px-4">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400 italic">Loading payroll records...</div>
            ) : (
              <Table className="min-w-[800px]">
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-b-slate-200">
                    <TableHead className="font-semibold text-slate-700 py-4">EMPLOYEE</TableHead>
                    <TableHead className="font-semibold text-slate-700 py-4">BASIC PAY</TableHead>
                    <TableHead className="font-semibold text-slate-700 py-4">EARNINGS</TableHead>
                    <TableHead className="font-semibold text-slate-700 py-4">DEDUCTIONS</TableHead>
                    <TableHead className="font-semibold text-slate-700 py-4">NET PAY</TableHead>
                    <TableHead className="font-semibold text-slate-700 py-4">STATUS</TableHead>
                    <TableHead className="font-semibold text-slate-700 py-4 text-right pr-6">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrolls.map(p => {
                    let badgeStyle = "bg-amber-100 text-amber-800";
                    if (p.PaystatusName?.toLowerCase() === "released" || p.statusName?.toLowerCase() === "released") {
                      badgeStyle = "bg-green-100 text-green-800";
                    }

                    return (
                      <TableRow key={p.payrollId} className="border-b-slate-100 hover:bg-slate-50/50">
                        <TableCell className="py-4">
                          <div className="font-semibold text-[#2A174E]">{p.user_FirstName || p.userName} {p.user_LastName || ""}</div>
                          <div className="text-xs text-slate-400 font-mono">ID: {formatUserId(p.user_Id)}</div>
                        </TableCell>
                        <TableCell className="py-4 text-slate-700">₱{parseFloat(p.basicPay).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                        <TableCell className="py-4 text-green-600 font-semibold">+₱{parseFloat(p.totalEarnings).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                        <TableCell className="py-4 text-red-500 font-semibold">-₱{parseFloat(p.totalDeductions).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                        <TableCell className="py-4 font-bold text-slate-900">₱{parseFloat(p.netPay).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                        <TableCell className="py-4">
                          <Badge variant="secondary" className={`font-semibold uppercase tracking-wide ${badgeStyle}`}>
                            {p.PaystatusName || p.statusName || "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-right pr-6">
                          <Button variant="outline" size="sm" asChild className="border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white transition-colors">
                            <Link to={`/payrollDetails/${p.payrollId}?start=${p.period_Start || selectedPeriod.startDate}&end=${p.period_End || selectedPeriod.endDate}`}>
                              {/* <VisibilityIcon className="mr-1 h-4 w-4" />  */} View Details
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {payrolls.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground italic">
                        No payroll records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ProcessPayrollModal 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)} 
        onConfirm={handleBatchProcess}
        employeeCount={payrolls.length}
      />
      </Sidebar>
    </div>
  );
};

export default PayrollPeriod;