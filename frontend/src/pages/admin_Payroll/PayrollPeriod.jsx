import { useState, useEffect, useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import Sidebar from "../../components/Sidebar";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import { Link, useLocation } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ProcessPayrollModal from "../../components/procpayrollmodal/ProcessPayrollModal";
import { fetchWithAuth } from "../../utils/api";
import { useSystemTime } from "../../context/SystemTimeContext";
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RateReviewIcon from '@mui/icons-material/RateReview';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { EyeIcon, ChevronLeft, Mail } from "lucide-react";  
import Toast from "../../components/toast/Toast";
import PayrollAlertBanner from "../../components/PayrollAlertBanner";
import ReleaseSummaryModal from "../../components/ReleaseSummaryModal";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getStoredUser } from "../../utils/authStorage";
import PayrollChecklistModal from "./modals/PayrollChecklistModal";
import ManagerApprovalModal from "./modals/ManagerApprovalModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { resolvePaydaySchedule } from "../../utils/paydayHelper";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/ui/table-pagination";

const PayrollPeriod = () => {
  const { systemToday } = useSystemTime();
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
  const [confirmMode, setConfirmMode] = useState("release"); // "draft" or "release"
  const [isReleaseSummaryOpen, setIsReleaseSummaryOpen] = useState(false);
  const [releaseSummaryData, setReleaseSummaryData] = useState(null);
  const [isResendConfirmOpen, setIsResendConfirmOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState(null);
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  const currentUser = useMemo(() => getStoredUser(), []);
  const userRoleId = Number(currentUser?.user_RoleId);
  const userPosition = (currentUser?.position || "").toUpperCase();
  const isManager = userRoleId === 1 || ["PRESIDENT", "ADMIN MANAGER", "SUPERVISOR"].includes(userPosition);

  const handleWorkflowSuccess = async () => {
    await fetchData();
    setToast({
      message: "Payroll period approval workflow status updated successfully.",
      type: "success"
    });
  };
  
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const periodIdFromUrl = queryParams.get("periodId");
  const openApprovalFromUrl = queryParams.get("openApproval") === "true";
  const hasAutoOpenedModal = useRef(false);

  // Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [gracePeriodDays, setGracePeriodDays] = useState(7);
  const [deadlineDays, setDeadlineDays] = useState(3);
  const [bufferDays, setBufferDays] = useState(2);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [isSendingBatchEmails, setIsSendingBatchEmails] = useState(false);

  const handleOpenResendConfirm = () => {
    if (!selectedPeriod) return;
    setIsResendConfirmOpen(true);
  };

  const executeResendBatchEmails = async () => {
    setIsResendConfirmOpen(false);
    if (!selectedPeriod) return;

    setIsSendingBatchEmails(true);
    try {
      const res = await fetchWithAuth("/api/payroll/resend-batch-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_Start: selectedPeriod.startDate,
          period_End: selectedPeriod.endDate
        })
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: data.message || "Payroll emails sent successfully!", type: "success" });
      } else {
        setToast({ message: data.error || "Failed to send batch emails", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error: " + err.message, type: "error" });
    } finally {
      setIsSendingBatchEmails(false);
    }
  };

  const [weekendRule, setWeekendRule] = useState("PRECEDING_FRIDAY");

  const periodSchedule = useMemo(() => {
    if (!selectedPeriod?.endDate) return null;
    return resolvePaydaySchedule(selectedPeriod.endDate, weekendRule);
  }, [selectedPeriod, weekendRule]);

  const todayStr = useMemo(() => {
    if (!systemToday) return "";
    const d = new Date(systemToday);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [systemToday]);

  const isCutoffOngoing = useMemo(() => {
    if (!selectedPeriod?.endDate || !todayStr) return false;
    return todayStr < selectedPeriod.endDate;
  }, [selectedPeriod, todayStr]);

  const submissionOpenDate = useMemo(() => {
    if (!selectedPeriod?.endDate) return null;
    const [eY, eM, eD] = selectedPeriod.endDate.split("-").map(Number);
    const bDays = bufferDays || 2;
    const evalEndDay = Math.max(1, eD - bDays);
    return `${eY}-${String(eM).padStart(2, "0")}-${String(evalEndDay).padStart(2, "0")}`;
  }, [selectedPeriod, bufferDays]);

  const isSubmissionWindowOpen = useMemo(() => {
    if (!submissionOpenDate || !todayStr) return false;
    return todayStr >= submissionOpenDate;
  }, [submissionOpenDate, todayStr]);

  const isProcessingWindow = useMemo(() => {
    if (!selectedPeriod?.endDate || !systemToday) return false;
    
    // Manual checking and batch preparation begins on the audit day (business day before payday)
    const checkDateStr = periodSchedule?.checkingDate || selectedPeriod.endDate;
    const checkDate = new Date(checkDateStr + "T00:00:00");
    checkDate.setHours(0, 0, 0, 0);
    
    const today = new Date(systemToday);
    today.setHours(0, 0, 0, 0);

    return today >= checkDate;
  }, [selectedPeriod, systemToday, periodSchedule]);

  const isOverdue = useMemo(() => {
    if (!selectedPeriod?.endDate || !systemToday || selectedPeriod?.status !== 'Draft') return false;
    const payDayStr = periodSchedule?.effectivePayday || selectedPeriod.endDate;
    const payDay = new Date(payDayStr + "T00:00:00");
    payDay.setHours(0, 0, 0, 0);

    const today = new Date(systemToday);
    today.setHours(0, 0, 0, 0);

    const deadline = new Date(payDay);
    deadline.setDate(deadline.getDate() + (deadlineDays || 3));
    return today > deadline;
  }, [selectedPeriod, systemToday, periodSchedule, deadlineDays]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [periodsRes, settingsRes] = await Promise.all([
        fetchWithAuth("/api/system/payroll-periods"),
        fetchWithAuth("/api/system/settings")
      ]);
      const periodsData = await periodsRes.json();
      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        if (sData.payrollGracePeriodDays) {
          setGracePeriodDays(parseInt(sData.payrollGracePeriodDays));
        }
        if (sData.payrollProcessingDeadlineDays) {
          setDeadlineDays(parseInt(sData.payrollProcessingDeadlineDays));
        }
        if (sData.payrollWeekendRule) {
          setWeekendRule(sData.payrollWeekendRule);
        }
        if (sData.payrollCutoffBufferDays !== undefined && sData.payrollCutoffBufferDays !== null) {
          setBufferDays(parseInt(sData.payrollCutoffBufferDays, 10));
        }
      }

      if (periodsRes.ok && periodsData.length > 0) {
        setPeriods(periodsData);
        
        let current;
        if (periodIdFromUrl) {
          current = periodsData.find(p => p.periodId === parseInt(periodIdFromUrl));
        }
        if (!current) current = periodsData[0]; 
        
        setSelectedPeriod(current);

        if (openApprovalFromUrl && !hasAutoOpenedModal.current && current && isManager) {
          hasAutoOpenedModal.current = true;
          setIsApprovalModalOpen(true);
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
      const res = await fetchWithAuth(`/api/payroll/preview-batch?period_Start=${period.startDate}&period_End=${period.endDate}`);
      if (res.ok) {
        const data = await res.json();
        setPayrolls(data.employees || []);
        setStats({
          totalNetPay: data.totalNetPay || 0,
          totalEarnings: data.totalEarnings || 0,
          totalDeductions: data.totalDeductions || 0
        });
      } else {
        console.error("Failed to load batch live preview.");
      }
    } catch (err) {
      console.error("fetchLivePreview error:", err);
    }
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

  const formatMoney = (val) => {
    return Number(val || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handlePeriodChange = async (periodIdVal) => {
    const pId = parseInt(periodIdVal);
    const found = periods.find(p => p.periodId === pId);
    if (!found) return;
    setSelectedPeriod(found);
    setLoading(true);
    try {
      if (found.status === 'Draft') {
        await fetchLivePreview(found);
      } else {
        await fetchSavedPayrolls(found);
      }
    } catch (err) {
      console.error("Error switching period:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchProcess = async () => {
    if (!selectedPeriod) return;
    try {
      setLoading(true);
      const isRelease = (confirmMode === "release");
      const endpoint = isRelease ? "/api/payroll/batch-release" : "/api/payroll/batch-generate";
      const response = await fetchWithAuth(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_Start: selectedPeriod.startDate,
          period_End: selectedPeriod.endDate,
          shouldRelease: isRelease
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setIsConfirmOpen(false);

        if (isRelease || result.status === "Released") {
          setReleaseSummaryData({
            periodLabel: selectedPeriod.label || `${selectedPeriod.startDate} to ${selectedPeriod.endDate}`,
            employeeCount: result.processed || result.totalCount || payrolls.length,
            totalNetPay: result.totalNetPay || stats.totalNetPay,
            totalEarnings: result.totalEarnings || stats.totalEarnings,
            totalDeductions: result.totalDeductions || stats.totalDeductions
          });
          setIsReleaseSummaryOpen(true);
          setToast({
            message: result.message || "Batch payroll released and locked successfully.",
            type: "success"
          });
        } else {
          setToast({
            message: result.message || "Batch payroll draft calculated successfully.",
            type: "success"
          });
        }
        await fetchData(); 
      } else {
        const err = await response.json().catch(() => ({}));
        setToast({
          message: err.error || "Failed to process batch payroll.",
          type: "error"
        });
      }
    } catch (err) {
      console.error("handleBatchProcess error:", err);
      setToast({
        message: "Network error: " + err.message,
        type: "error"
      });
    } finally {
      setLoading(false);
      setIsConfirmOpen(false);
    }
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
        setToast({ message: "Failed to fetch summary preview.", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to fetch summary preview: " + err.message, type: "error" });
    }
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
        setToast({ message: "Payroll summary PDF downloaded successfully.", type: "success" });
      } else {
        setToast({ message: "Failed to download summary. Ensure payroll is processed for this period.", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to download summary: " + err.message, type: "error" });
    }
  };

  useEffect(() => {
    fetchData();
  }, [periodIdFromUrl]);

  // --- Filtering & Pagination Logic ---
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  const isFiltering = searchQuery !== "";

  const filteredPayrolls = payrolls.filter(p => {
    const fullName = `${p.user_FirstName || p.userName} ${p.user_LastName || ""}`.toLowerCase();
    const formattedId = formatUserId(p.user_Id).toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || formattedId.includes(query);
  });

  const totalItems = filteredPayrolls.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredPayrolls.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <TooltipProvider>
          <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
            <PayrollAlertBanner />
        
        {/* Header section with back button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">

        <div className="group flex items-start md:items-center gap-0transition-all">
          {/* Back Button: Hidden by default, slides and fades in on hover */}
          <div className="w-0 overflow-hidden group-hover:w-10 transition-all duration-300 ease-in-out">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    asChild 
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-brand-primary"
                  >
                    <Link to="/payroll">
                      <ChevronLeft className="h-6 w-6" />
                    </Link>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-slate-800">
                Back to Payroll Management
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Title: Adds left padding when hovered */}
          <div className="transition-all duration-300 ease-in-out group-hover:pl-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-brand-primary leading-tight">
                {selectedPeriod?.label}
              </h1>
              {selectedPeriod?.status === 'Pending Approval' && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-xs">
                  <AccessTimeIcon sx={{ fontSize: 13 }} /> Pending Approval
                </span>
              )}
              {selectedPeriod?.status === 'Approved' && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1 shadow-xs">
                  <CheckCircleOutlineIcon sx={{ fontSize: 13 }} /> Approved by Management
                </span>
              )}
              {selectedPeriod?.status === 'Released' && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-xs">
                  <CheckCircleOutlineIcon sx={{ fontSize: 13 }} /> Released &amp; Locked
                </span>
              )}
              {(!selectedPeriod?.status || selectedPeriod?.status === 'Draft') && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 shadow-xs">
                  Draft
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm text-slate-500">
                {selectedPeriod?.startDate ? new Date(selectedPeriod.startDate).toLocaleDateString() : "—"} to {selectedPeriod?.endDate ? new Date(selectedPeriod.endDate).toLocaleDateString() : "—"}
              </span>
              {periodSchedule?.effectivePayday && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                  Payday: {periodSchedule.readablePayday}
                </span>
              )}
              {periodSchedule?.isAdjusted && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                  <EventRepeatIcon className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                  {periodSchedule.adjustmentNotice}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0 items-center">
            {periods.length > 0 && (
              // <Select 
              //   value={selectedPeriod?.periodId ? String(selectedPeriod.periodId) : ""} 
              //   onValueChange={handlePeriodChange}
              // >
              //   <SelectTrigger className="w-full sm:w-[230px] bg-white border-slate-200 text-slate-700 font-medium shadow-sm">
              //     <SelectValue placeholder="Select Period" />
              //   </SelectTrigger>
              //   <SelectContent className="max-h-64">
              //     {periods.map(period => (
              //       <SelectItem key={period.periodId} value={String(period.periodId)}>
              //         <div className="flex items-center justify-between w-full gap-2">
              //           <span>{period.label || `${period.startDate} to ${period.endDate}`}</span>
              //           <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              //             period.status === 'Draft' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              //           }`}>
              //             {period.status}
              //           </span>
              //         </div>
              //       </SelectItem>
              //     ))}
              //   </SelectContent>
              // </Select>

              ""
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block w-full sm:w-auto">
                  <Button 
                    className="w-full bg-[#f8fafc] hover:text-brand-primary text-brand-primary/70 border border-slate-200 hover:bg-slate-100" 
                    onClick={handlePreviewSummary}
                    disabled={loading || payrolls.length === 0}
                  >
                    <SummarizeOutlinedIcon className="mr-2 h-4 w-4" /> Summary View
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-slate-800">
                Generate and preview overall payroll summary report.
              </TooltipContent>
            </Tooltip>

            {/* 1. If Draft and NO records calculated yet */}
            {selectedPeriod?.status === 'Draft' && payrolls.length === 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block w-full sm:w-auto">
                    <Button 
                      className={`w-full ${
                        isOverdue 
                          ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-sm" 
                          : "bg-brand-primary text-white border hover:bg-[#7A52B5]"
                      } ${
                        !isProcessingWindow ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      onClick={() => {
                        setConfirmMode(isOverdue ? "release" : "draft");
                        setIsConfirmOpen(true);
                      }}
                      disabled={!isProcessingWindow || loading}
                      title={
                        !isProcessingWindow ? `Batch manual verification will be available on the audit day (${periodSchedule?.readableCheckingDate || new Date(selectedPeriod?.endDate).toLocaleDateString()}).` :
                        isOverdue ? `Overdue: Cutoff was on ${new Date(selectedPeriod?.endDate).toLocaleDateString()}. Click to process and finalize batch now.` : ""
                      }
                    >
                      <GroupsOutlinedIcon className="mr-2 h-4 w-4" /> 
                      {isOverdue 
                        ? "Process & Release Overdue Batch" 
                        : (todayStr && periodSchedule?.checkingDate && todayStr === periodSchedule.checkingDate)
                          ? "Verify Batch (Audit Day)"
                          : "Process Batch"}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-slate-800">
                  {isOverdue 
                    ? `Overdue Batch: Cutoff was on ${new Date(selectedPeriod?.endDate).toLocaleDateString()}. Process, lock, and archive payroll now.`
                    : !isProcessingWindow 
                      ? `Manual verification opens on ${periodSchedule?.readableCheckingDate || new Date(selectedPeriod?.endDate).toLocaleDateString()} before payday release.`
                      : "Compute draft attendance, earnings, and deductions for all active employees."}
                </TooltipContent>
              </Tooltip>
            )}

            {/* 2. If Draft / Rejected and records exist: Maker (Accountant) Review & Submit */}
            {(selectedPeriod?.status === 'Draft' || selectedPeriod?.status === 'Rejected') && payrolls.length > 0 && (
              isSubmissionWindowOpen ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="w-full sm:w-auto bg-brand-primary hover:bg-[#7A52B5] text-white shadow-sm border border-brand-primary"
                      onClick={() => setIsChecklistModalOpen(true)}
                      disabled={loading}
                    >
                      <RateReviewIcon className="mr-2 h-4 w-4" />
                      Review &amp; Submit for Approval
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 max-w-xs text-center">
                    Run automated pre-flight scan and complete the 5-domain audit checklist for Management sign-off.
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block w-full sm:w-auto">
                      <Button
                        className="w-full sm:w-auto bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed hover:bg-slate-100"
                        disabled={true}
                      >
                        <LockOutlinedIcon className="mr-2 h-4 w-4 text-slate-400" />
                        Review &amp; Submit for Approval
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 max-w-xs text-center">
                    Pre-flight review and submission opens 2 days prior to cutoff conclusion (available on or after {submissionOpenDate ? new Date(submissionOpenDate + "T00:00:00").toLocaleDateString() : "the audit day"}).
                  </TooltipContent>
                </Tooltip>
              )
            )}

            {/* 3. If Pending Approval */}
            {selectedPeriod?.status === 'Pending Approval' && (
              isManager ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white shadow-sm border border-amber-600"
                      onClick={() => setIsApprovalModalOpen(true)}
                      disabled={loading}
                    >
                      <RateReviewIcon className="mr-2 h-4 w-4" />
                      Review &amp; Authorize Batch
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 max-w-xs text-center">
                    Inspect accountant checklist affirmations, total net disbursements, and approve or return batch.
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block w-full sm:w-auto">
                      <Button
                        className="w-full sm:w-auto bg-amber-50 text-amber-800 border border-amber-300 cursor-not-allowed hover:bg-amber-50"
                        disabled={true}
                      >
                        <LockOutlinedIcon className="mr-2 h-4 w-4 text-amber-700" />
                        Awaiting Management Authorization
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 max-w-xs text-center">
                    Submitted for executive sign-off. Release unlocks once approved by Admin Manager or President.
                  </TooltipContent>
                </Tooltip>
              )
            )}

            {/* 4. If Approved by Management: Release is unlocked */}
            {selectedPeriod?.status === 'Approved' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border border-emerald-600"
                    onClick={() => {
                      setConfirmMode("release");
                      setIsConfirmOpen(true);
                    }}
                    disabled={loading}
                  >
                    <LockOutlinedIcon className="mr-2 h-4 w-4" />
                    Release &amp; Lock Payroll
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-slate-800 max-w-xs text-center">
                  Executive approval verified. Permanently lock records, archive PDFs, and dispatch encrypted payslip emails.
                </TooltipContent>
              </Tooltip>
            )}

            {/* 5. If Already Released */}
            {selectedPeriod?.status === 'Released' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-sm font-semibold cursor-default">
                <CheckCircleOutlineIcon className="h-4 w-4 text-emerald-600" />
                Released &amp; Locked
              </span>
            )}

            {/* Resend Batch Emails Button */}
            {selectedPeriod?.status === 'Released' && payrolls.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block w-full sm:w-auto">
                    <Button 
                      variant="outline"
                      className="w-full border-purple-300 text-brand-primary hover:bg-purple-50"
                      onClick={handleOpenResendConfirm}
                      disabled={isSendingBatchEmails}
                    >
                      <Mail className="mr-2 h-4 w-4 text-purple-700" />
                      {isSendingBatchEmails ? "Sending..." : "Resend Emails"}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-slate-800">
                  Resend password-protected Payslips 1 & 2 and DTR via email to all employees in this period.
                </TooltipContent>
              </Tooltip>
            )}
        </div>
        </div>

        {/* Rejection / Return to Draft Feedback Banner */}
        {selectedPeriod?.rejectionReason && (selectedPeriod?.status === 'Draft' || selectedPeriod?.status === 'Rejected') && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3 shadow-sm">
            <WarningAmberIcon className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="font-bold text-sm text-red-800">Batch Returned to Draft by Management</h4>
              <p className="text-xs mt-0.5 text-red-700">
                <strong>Adjustment Feedback:</strong> {selectedPeriod.rejectionReason}
              </p>
              <p className="text-xs text-red-600 mt-1">
                Please make necessary corrections to attendance logs, requests, or deductions, then re-run the verification checklist to submit again.
              </p>
            </div>
          </div>
        )}

        {/* Pending Approval Notice Banner */}
        {selectedPeriod?.status === 'Pending Approval' && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-3">
              <AccessTimeIcon className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-amber-900">Awaiting Executive Management Authorization</h4>
                <p className="text-xs mt-0.5 text-amber-700">
                  Pre-flight checklist submitted. Batch release is locked pending executive authorization.
                  {selectedPeriod.submittedAt && ` Submitted on ${new Date(selectedPeriod.submittedAt).toLocaleString()}.`}
                </p>
              </div>
            </div>
            {isManager && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0"
                onClick={() => setIsApprovalModalOpen(true)}
              >
                <RateReviewIcon className="mr-1.5 h-4 w-4" /> Review &amp; Authorize
              </Button>
            )}
          </div>
        )}

        {/* Approved by Management Notice Banner */}
        {selectedPeriod?.status === 'Approved' && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-3">
              <CheckCircleOutlineIcon className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-blue-900">Executive Authorization Granted</h4>
                <p className="text-xs mt-0.5 text-blue-700">
                  This payroll batch has been approved. You may now release payments, lock historical records, and email encrypted payslips.
                  {selectedPeriod.approvedAt && ` Authorized on ${new Date(selectedPeriod.approvedAt).toLocaleString()}.`}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shrink-0"
              onClick={() => {
                setConfirmMode("release");
                setIsConfirmOpen(true);
              }}
            >
              <LockOutlinedIcon className="mr-1.5 h-4 w-4" /> Release &amp; Lock Now
            </Button>
          </div>
        )}

         {/* Statistics Cards */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
            {/* Card 1: Total Gross Pay */}
            <Card className="border-t-5 border-accent-green bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                 <div className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-[13px] font-bold text-accent-green uppercase tracking-wider">Total Earnings</p>
                  </div>
                  <p className="text-3xl font-bold text-accent-green">₱{formatMoney(stats.totalEarnings)}</p>
                </div>
                <p className="text-xs text-accent-green/70 italic mt-4">Gross pay including OT and allowances</p>
              </div>
              </CardContent>
            </Card>
            
 
            {/* Card 2: Total Deductions */}
            <Card className="border-t-5 border-status-danger bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-[13px] font-bold text-status-danger uppercase tracking-wider">Total Deductions</p>
                  </div>
                  <p className="text-3xl font-bold text-status-danger">₱{formatMoney(stats.totalDeductions)}</p>
                </div>
                <p className="text-xs text-status-danger/70 italic mt-4">Withholdings including taxes and loans</p>
              </div>
              </CardContent>
            </Card>
 
            {/* Card 3: Total Net Pay */}
            <Card className="border-t-5 border-brand-primary bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-[13px] font-bold text-brand-primary uppercase tracking-wider">Total Net Pay</p>
                  </div>
                  <p className="text-3xl font-bold text-brand-primary">₱{formatMoney(stats.totalNetPay)}</p>
                </div>
                <p className="text-xs text-brand-primary/70 italic mt-4">Calculated total distribution amount</p>
              </div>
              </CardContent>
            </Card>
            
          </div>

        {/* Filters Card */}
        <Card className="shadow-sm border-0 bg-white mb-6 py-0">
          <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
            <div className="relative w-full xl:max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by Employee Name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-slate-200 focus-visible:ring-brand-primary w-full"
              />
            </div>
            
            {isFiltering && (
              <div className="flex items-center gap-3 w-full xl:w-auto">
                <Button 
                  variant="ghost" 
                  onClick={handleClearFilters}
                  className="w-full sm:w-auto text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors font-semibold"
                >
                  <CloseIcon className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card className="shadow-sm border-0 bg-white py-0">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <Table className="min-w-[800px]">
                <TableHeader className="bg-brand-primary">
                  <TableRow className="hover:bg-transparent border-b-slate-200">
                    <TableHead className="font-semibold text-white py-4 px-6">EMPLOYEE</TableHead>
                    <TableHead className="font-semibold text-white py-4">
                      <div className="flex items-center gap-1">
                        BASIC PAY
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-white/60 hover:text-white cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                            Fixed scheduled target base pay for the period (Scheduled Days × Daily Rate), before additions or deductions.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-white py-4">
                      <div className="flex items-center gap-1">
                        GROSS PAY
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-white/60 hover:text-white cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                            Basic pay plus overtime earnings, night differential, holiday premiums, and other earned additions.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-white py-4">
                      <div className="flex items-center gap-1">
                        DEDUCTIONS
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-white/60 hover:text-white cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                            Withholdings including attendance penalties (absences/lates), government contributions, withholding tax, and loan repayments.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-white py-4">
                      <div className="flex items-center gap-1">
                        NET PAY
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-white/60 hover:text-white cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                            The actual take-home salary after subtracting total deductions from gross earnings.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-white py-4 text-right pr-6">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i} className="border-b-slate-100">
                      <TableCell className="py-4 px-6">
                        <Skeleton className="h-4 w-32 bg-slate-200" />
                        <Skeleton className="h-3 w-16 bg-slate-200 mt-2" />
                      </TableCell>
                      <TableCell className="py-4">
                        <Skeleton className="h-4 w-20 bg-slate-200" />
                      </TableCell>
                      <TableCell className="py-4">
                        <Skeleton className="h-4 w-20 bg-slate-200" />
                      </TableCell>
                      <TableCell className="py-4">
                        <Skeleton className="h-4 w-20 bg-slate-200" />
                      </TableCell>
                      <TableCell className="py-4">
                        <Skeleton className="h-4 w-20 bg-slate-200" />
                      </TableCell>
                      <TableCell className="py-4 text-right pr-6">
                        <div className="flex justify-end">
                          <Skeleton className="h-8 w-8 bg-slate-200 rounded" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table className="min-w-[800px]">
                <TableHeader className="bg-brand-primary">
                  <TableRow className="hover:bg-transparent border-b-slate-200">
                    <TableHead className="font-semibold text-white py-4 px-6">EMPLOYEE</TableHead>
                    <TableHead className="font-semibold text-white py-4">
                      <div className="flex items-center gap-1">
                        BASIC PAY
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-white/60 hover:text-white cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                            Fixed scheduled target base pay for the period (Scheduled Days × Daily Rate), before additions or deductions.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-white py-4">
                      <div className="flex items-center gap-1">
                        GROSS PAY
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-white/60 hover:text-white cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                            Basic pay plus overtime earnings, night differential, holiday premiums, and other earned additions.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-white py-4">
                      <div className="flex items-center gap-1">
                        DEDUCTIONS
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-white/60 hover:text-white cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                            Withholdings including attendance penalties (absences/lates), government contributions, withholding tax, and loan repayments.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-white py-4">
                      <div className="flex items-center gap-1">
                        NET PAY
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-white/60 hover:text-white cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                            The actual take-home salary after subtracting total deductions from gross earnings.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-white py-4 text-right pr-6">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.length > 0 ? (
                    currentData.map(p => {
                      const fixedBasic = p.potentialBasicPay ?? (p.totalScheduledDays && p.dailyRate ? p.totalScheduledDays * p.dailyRate : (p.dailyRate ? p.dailyRate * 13 : p.basicPay));

                      return (
                        <TableRow key={p.payrollId} className="border-b-slate-100 hover:bg-slate-50/50">
                          <TableCell className="py-4 px-6">
                            <div className="font-semibold text-brand-primary-semi-dark">{p.user_FirstName || p.userName} {p.user_LastName || ""}</div>
                            <div className="text-xs text-slate-400 font-mono">ID: {formatUserId(p.user_Id)}</div>
                          </TableCell>
                          <TableCell className="py-4 text-slate-700">₱{formatMoney(fixedBasic)}</TableCell>
                          <TableCell className="py-4 text-green-600 font-semibold">+₱{formatMoney(p.grossEarnings || p.totalEarnings)}</TableCell>
                          <TableCell className="py-4 text-red-500 font-semibold">-₱{formatMoney(p.totalDeductions)}</TableCell>
                          <TableCell className="py-4 font-bold text-slate-900">₱{formatMoney(p.netPay)}</TableCell>
                          <TableCell className="py-4 text-right pr-6">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block">
                                  <Button variant="outline" size="sm" asChild className="border-[#d1c4e9] text-[#5b3fa6] hover:bg-brand-primary-light hover:border-[#9c7de0] transition-colors">
                                    <Link to={`/payrollDetails/${p.payrollId}?start=${p.period_Start || selectedPeriod.startDate}&end=${p.period_End || selectedPeriod.endDate}&periodId=${selectedPeriod.periodId}`}>
                                      <EyeIcon className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800">
                                View Details
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <SearchIcon className="h-8 w-8 text-slate-300 mb-2" />
                          <span className="font-semibold text-slate-600">No payroll records found</span>
                          <span className="text-sm text-slate-400">Try adjusting your search or filters.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {/* Pagination Controls */}
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              startIndex={startIndex}
              endIndex={endIndex}
              itemLabel="records"
            />
          </CardContent>
        </Card>
      </div>

      <ProcessPayrollModal 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)} 
        onConfirm={handleBatchProcess}
        employeeCount={payrolls.length}
        mode={confirmMode}
        periodLabel={selectedPeriod?.label}
        isOverdue={isOverdue}
        loading={loading}
      />

      <ReleaseSummaryModal
        isOpen={isReleaseSummaryOpen}
        onClose={() => setIsReleaseSummaryOpen(false)}
        data={releaseSummaryData}
        onPreviewSummary={handlePreviewSummary}
        onDownloadSummary={handleDownloadSummary}
      />

      <PayrollChecklistModal
        isOpen={isChecklistModalOpen}
        onClose={() => setIsChecklistModalOpen(false)}
        period={selectedPeriod}
        onSubmitSuccess={handleWorkflowSuccess}
        currentUser={currentUser}
      />

      <ManagerApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        period={selectedPeriod}
        onDecisionSuccess={handleWorkflowSuccess}
        currentUser={currentUser}
      />

      {/* Resend Batch Emails Confirmation Dialog */}
      <AlertDialog open={isResendConfirmOpen} onOpenChange={setIsResendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend Batch Payroll Emails</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to resend encrypted Payslips (standard &amp; detailed) and official DTR PDFs to all {payrolls.length} employees for period <strong>{selectedPeriod?.label || `${selectedPeriod?.startDate} to ${selectedPeriod?.endDate}`}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeResendBatchEmails}
              className="bg-brand-primary hover:bg-[#7A52B5] text-white"
            >
              Send Emails
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Summary Preview Modal */}
      {showSummaryPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl border-0 overflow-hidden py-0">
            <CardContent className="p-0 flex flex-col h-full">
              <div className="flex justify-between items-center p-4 bg-brand-primary text-white">
                <h3 className="font-bold text-lg flex items-center gap-2">
                   Payroll Summary Preview - {selectedPeriod?.label}
                </h3>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleDownloadSummary} className="bg-green-600 hover:bg-green-700 text-white border-0">
                    <DownloadIcon className="mr-2 h-4 w-4" /> Download PDF
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowSummaryPreview(false)} className="text-white hover:bg-white/10">
                    <CloseIcon />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden bg-slate-100 p-2 sm:p-4 flex flex-col">
                <iframe
                  title="Payroll Summary Preview"
                  srcDoc={DOMPurify.sanitize(previewContent, {
                    WHOLE_DOCUMENT: true,
                    ADD_TAGS: ["style"],
                  })}
                  className="w-full h-full flex-1 border-0 rounded-lg bg-white shadow-inner"
                  sandbox="allow-same-origin allow-modals allow-popups"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8; 
        }
      `}} />
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ ...toast, message: "" })} 
        />
      </TooltipProvider>
      </Sidebar>
    </div>
  );
};

export default PayrollPeriod;