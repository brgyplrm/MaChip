import React, { useState, useEffect, useCallback, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AttachmentIcon from '@mui/icons-material/Attachment';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import HistoryIcon from '@mui/icons-material/History';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import { useSystemTime } from "../../context/SystemTimeContext";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const UserRequests = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [activeTab, setActiveTab] = useState("submit"); // "submit" or "history"
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [historyRequests, setHistoryRequests] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(false);

  // Pagination & History States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [selectedReqId, setSelectedReqId] = useState(null);

  useEffect(() => {
    const pending = historyRequests.filter(r => r.emp_reqStatusId === 1).length;
    const approved = historyRequests.filter(r => r.emp_reqStatusId === 2).length;
    const rejected = historyRequests.filter(r => r.emp_reqStatusId === 3).length;
    setStats({ pending, approved, rejected });
  }, [historyRequests]);
  
  const getPayrollDates = useCallback((baseDate) => {
    const today = baseDate || new Date();
    const day = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthName = today.toLocaleString('en-US', { month: 'long' });
    
    const formatDate = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (day <= 15) {
      const start = new Date(year, month, 1);
      const end = new Date(year, month, 15);
      return {
        start: formatDate(start),
        end: formatDate(end),
        payEnding: `${monthName} 1-15, ${year}`
      };
    } else {
      const start = new Date(year, month, 16);
      const end = new Date(year, month + 1, 0); 
      return {
        start: formatDate(start),
        end: formatDate(end),
        payEnding: `${monthName} 16-${end.getDate()}, ${year}`
      };
    }
  }, []);

  const payroll = useMemo(() => getPayrollDates(systemToday), [systemToday, getPayrollDates]);
  const [balance, setBalance] = useState(null);

  const fetchPayrollPeriods = async () => {
    try {
      await fetchWithAuth("/api/system/payroll-periods");
      // We no longer restrict requests by payroll periods
    } catch (error) {
      console.error("Error fetching periods:", error);
    }
  };

  const [formData, setFormData] = useState({
    user_Id: userData?.user_Id || "",
    emp_reqTypeId: "",
    remarks: "",
    leaveStartDate: "",
    leaveEndDate: "",
    noDays: 0,
    otDate: "",
    hrFrom: "",
    hrTo: "",
    totalHrs: 0,
    proofFile: null,
    logCorrDate: "",
    currentIn: "",
    currentOut: "",
    claimedIn: "",
    claimedOut: "",
    correctionCategory: "",
    period: "",
  });

  const [currentPeriodLogs, setCurrentPeriodLogs] = useState([]);
  const [periodDates, setPeriodDates] = useState([]);

  const fetchCurrentPeriodLogs = async () => {
    if (!userData?.user_Id) return;
    try {
      const { start: pStart, end: pEnd } = payroll;
      const start = pStart;
      const end = pEnd;

      const dates = [];
      const startDate = new Date(start + "T00:00:00");
      const endDate = new Date(end + "T00:00:00");
      
      let curr = new Date(startDate);
      while (curr <= endDate) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
        curr.setDate(curr.getDate() + 1);
      }
      setPeriodDates(dates);

      const response = await fetchWithAuth(`/api/attendance/report?startDate=${start}&endDate=${end}&user_Id=${userData.user_Id}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentPeriodLogs(data);
      }
    } catch (error) {
      console.error("Error fetching logs for correction:", error);
    }
  };

  useEffect(() => {
    if (formData.emp_reqTypeId === "1" || formData.emp_reqTypeId === "5") {
      fetchCurrentPeriodLogs();
    }
  }, [formData.emp_reqTypeId, payroll]);

  const suggestOTTimes = (selectedDate) => {
    if (!selectedDate || !currentPeriodLogs || currentPeriodLogs.length === 0) return;

    const log = currentPeriodLogs.find(l => {
      const logDate = typeof l.log_Date === 'string' ? l.log_Date.split('T')[0] : new Date(l.log_Date).toISOString().split('T')[0];
      return logDate === selectedDate;
    });

    if (!log) return;

    const SHIFT_END = "17:30";
    const ins = Array.isArray(log.inArr) ? log.inArr.map(t => t.substring(0, 5)) : [];
    const outs = Array.isArray(log.outArr) ? log.outArr.map(t => t.substring(0, 5)) : [];

    const otIn = ins.find(t => t >= SHIFT_END);
    const lastOut = outs.length > 0 ? outs[outs.length - 1] : "";

    if (lastOut && lastOut > SHIFT_END) {
      setFormData(prev => ({
        ...prev,
        hrFrom: otIn || SHIFT_END,
        hrTo: lastOut
      }));
    }
  };

  useEffect(() => {
    if (formData.emp_reqTypeId === "1" && formData.otDate && currentPeriodLogs.length > 0) {
      suggestOTTimes(formData.otDate);
    }
  }, [currentPeriodLogs, formData.emp_reqTypeId, formData.otDate]);

  const refreshLogDisplay = (selectedDate, category, allLogs) => {
    if (!selectedDate || !category || !allLogs) return;

    const log = allLogs.find(l => {
      const d = typeof l.log_Date === 'string' ? l.log_Date.split('T')[0] : new Date(l.log_Date).toISOString().split('T')[0];
      return d === selectedDate;
    });

    if (!log) {
      setFormData(prev => ({ ...prev, currentIn: "", currentOut: "" }));
      return;
    }

    let sysIn = "", sysOut = "";
    if (category === "Morning") {
      sysIn = log.morning_In !== "—" ? log.morning_In : "";
      sysOut = log.morning_Out !== "—" ? log.morning_Out : "";
    } else if (category === "Afternoon") {
      sysIn = log.afternoon_In !== "—" ? log.afternoon_In : "";
      sysOut = log.afternoon_Out !== "—" ? log.afternoon_Out : "";
    } else if (category === "Overtime") {
      sysIn = log.ot_In !== "—" ? log.ot_In : "";
      sysOut = log.ot_Out !== "—" ? log.ot_Out : "";
    }

    setFormData(prev => ({
      ...prev,
      currentIn: sysIn,
      currentOut: sysOut,
    }));
  };

  const handleLogDateChange = (val) => {
    const selectedDate = val;
    const dateObj = new Date(selectedDate);
    
    if (dateObj.getUTCDay() === 0) {
      setToast({ message: "Cannot file log correction for Sundays.", type: "error" });
      setFormData(prev => ({
        ...prev,
        logCorrDate: "",
        currentIn: "",
        currentOut: "",
      }));
      return;
    }

    setFormData(prev => ({ ...prev, logCorrDate: selectedDate }));
    refreshLogDisplay(selectedDate, formData.correctionCategory, currentPeriodLogs);
  };

  useEffect(() => {
    if (formData.emp_reqTypeId === "1" && formData.hrFrom && formData.hrTo) {
      const [h1, m1] = formData.hrFrom.split(":").map(Number);
      const [h2, m2] = formData.hrTo.split(":").map(Number);
      
      if (!isNaN(h1) && !isNaN(h2)) {
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 24 * 60; 
        const calculatedHrs = (diff / 60).toFixed(2);
        setFormData(prev => ({ ...prev, totalHrs: calculatedHrs }));
      }
    } else if (formData.emp_reqTypeId === "1") {
      if (formData.totalHrs !== "0.00" && formData.totalHrs !== 0) {
        setFormData(prev => ({ ...prev, totalHrs: "0.00" }));
      }
    }
  }, [formData.hrFrom, formData.hrTo, formData.emp_reqTypeId]);

  const fetchBalance = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetchWithAuth(`/api/request/balance/${userData.user_Id}`);
      if (response.ok) {
        const data = await response.json();
        setBalance(data);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  const fetchHistory = async () => {
    if (!userData?.user_Id) return;
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/request/${userData.user_Id}`);
      const data = await response.json();
      if (response.ok) {
        setHistoryRequests(data);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchPayrollPeriods();
    const handleRefresh = () => {
      fetchBalance();
      fetchHistory();
    };
    window.addEventListener("dataRefresh", handleRefresh);
    return () => window.removeEventListener("dataRefresh", handleRefresh);
  }, [userData?.user_Id, activeTab]);

  useEffect(() => {
    fetchHistory();
  }, [activeTab]);

  useEffect(() => {
    if (["3", "4", "8", "9", "10", "11", "12"].includes(formData.emp_reqTypeId) && formData.leaveStartDate && formData.leaveEndDate) {
      const start = new Date(formData.leaveStartDate);
      const end = new Date(formData.leaveEndDate);
      let count = 0;
      let cur = new Date(start);
      while (cur <= end) {
        if (cur.getDay() !== 0) count++;
        cur.setDate(cur.getDate() + 1);
      }
      setFormData((prev) => ({ ...prev, noDays: count }));
    }
  }, [formData.leaveStartDate, formData.leaveEndDate, formData.emp_reqTypeId]);

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === "file" && files && files[0]) {
      const file = files[0];
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
      if (!allowedTypes.includes(file.type)) {
        setToast({ message: "Invalid file format. Only png, jpg, and jpeg are allowed!", type: "error" });
        e.target.value = null;
        return;
      }
    }

    const newValue = type === "checkbox" ? checked : type === "file" ? files[0] : value;
    setFormData((prev) => ({ ...prev, [name]: newValue }));

    if (name === "otDate") {
      suggestOTTimes(newValue);
    }
  };

  const handleSelectChange = (name, val) => {
    setFormData((prev) => ({ ...prev, [name]: val }));
    if (name === "correctionCategory") {
      refreshLogDisplay(formData.logCorrDate, val, currentPeriodLogs);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let isInsufficient = false;
    if (balance) {
      const vlBal = parseFloat(balance.VL_balance);
      const slBal = parseFloat(balance.SL_balance);
      const spBal = parseFloat(balance.SoloParent_balance || 0);
      const requestedDays = parseFloat(formData.noDays);

      if (formData.emp_reqTypeId === "3" && requestedDays > vlBal) isInsufficient = true;
      else if (formData.emp_reqTypeId === "4" && requestedDays > slBal) isInsufficient = true;
      else if (formData.emp_reqTypeId === "10" && requestedDays > spBal) isInsufficient = true;
      else if (formData.emp_reqTypeId === "6" && requestedDays > (vlBal + slBal)) isInsufficient = true;
      else if (formData.emp_reqTypeId === "7" && 0.5 > vlBal) isInsufficient = true;
    }

    // Attachment validation for specific statutory leaves
    if (["8", "11", "12"].includes(formData.emp_reqTypeId) && !formData.proofFile) {
      setToast({ message: "Supporting documentation is mandatory for this request.", type: "error" });
      return;
    }

    let isLateFiling = false;
    if (formData.emp_reqTypeId === "3") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(formData.leaveStartDate);
      const diffTime = startDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 3) isLateFiling = true;
    }

    const formDataToSubmit = new FormData();
    formDataToSubmit.append("user_Id", userData.user_Id);
    formDataToSubmit.append("emp_reqTypeId", formData.emp_reqTypeId);
    formDataToSubmit.append("remarks", formData.remarks);
    formDataToSubmit.append("purpose", formData.remarks);
    formDataToSubmit.append("reason", formData.remarks);
    
    if (formData.emp_reqTypeId === "1") {
      formDataToSubmit.append("OT_DateOf", formData.otDate);
      formDataToSubmit.append("HrFrom", formData.hrFrom);
      formDataToSubmit.append("HrTo", formData.hrTo);
      formDataToSubmit.append("Total_Hrs", formData.totalHrs);
    } else if (formData.emp_reqTypeId === "2") {
      formDataToSubmit.append("DateonField", formData.otDate);
      formDataToSubmit.append("NoHrs", formData.totalHrs);
      formDataToSubmit.append("NoDays", 1);
      formDataToSubmit.append("destination", formData.remarks);
    } else if (formData.emp_reqTypeId === "5") {
      formDataToSubmit.append("logDate", formData.logCorrDate);
      formDataToSubmit.append("currentIn", formData.currentIn);
      formDataToSubmit.append("currentOut", formData.currentOut);
      formDataToSubmit.append("claimedIn", formData.claimedIn);
      formDataToSubmit.append("claimedOut", formData.claimedOut);
      formDataToSubmit.append("correctionCategory", formData.correctionCategory);
      formDataToSubmit.append("reason", formData.remarks);
    } else if (formData.emp_reqTypeId === "6") {
      formDataToSubmit.append("DateOfLeave", formData.leaveStartDate);
      formDataToSubmit.append("NoDays", 1);
      formDataToSubmit.append("reason", formData.remarks);
    } else if (formData.emp_reqTypeId === "7") {
      formDataToSubmit.append("DateOfLeave", formData.leaveStartDate);
      formDataToSubmit.append("period", formData.period);
      formDataToSubmit.append("NoDays", 0.5);
    } else if (["8", "9", "10", "11", "12"].includes(formData.emp_reqTypeId)) {
      formDataToSubmit.append("StartDate", formData.leaveStartDate);
      formDataToSubmit.append("EndDate", formData.leaveEndDate);
      formDataToSubmit.append("NoDays", formData.noDays);
      formDataToSubmit.append("reason", formData.remarks);
    } else {
      formDataToSubmit.append("StartDate", formData.leaveStartDate);
      formDataToSubmit.append("EndDate", formData.leaveEndDate);
      formDataToSubmit.append("NoDays", formData.noDays);
    }
    
    if (formData.proofFile) formDataToSubmit.append("proofFile", formData.proofFile);

    try {
      const response = await fetchWithAuth("/api/request", {
        method: "POST",
        body: formDataToSubmit,
      });
      const result = await response.json();
      if (response.ok) {
        let finalMessage = "Request submitted successfully!";
        if (isInsufficient && isLateFiling) finalMessage = "Warning: Insufficient balance & late filing. Request submitted but may be rejected.";
        else if (isInsufficient) finalMessage = "Warning: Insufficient balance. Request submitted but may be rejected.";
        else if (isLateFiling) finalMessage = "Warning: Vacation Leave must be filed 3 days in advance. Request submitted but may be rejected.";

        setToast({ message: finalMessage, type: (isInsufficient || isLateFiling) ? "error" : "success" });
        setFormData({
          user_Id: userData?.user_Id || "",
          emp_reqTypeId: "",
          remarks: "",
          leaveStartDate: "",
          leaveEndDate: "",
          noDays: 0,
          otDate: "",
          hrFrom: "",
          hrTo: "",
          totalHrs: 0,
          proofFile: null,
          logCorrDate: "",
          currentIn: "",
          currentOut: "",
          claimedIn: "",
          claimedOut: "",
          correctionCategory: "",
        });
        fetchBalance();
        fetchHistory();
        setActiveTab("history"); // Auto-switch to history to see it pending
      } else {
        setToast({ message: result.error || "Failed to submit request", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Error connecting to server", type: "error" });
    }
  };

  // --- Pagination & Formatting Logic for History ---
  const totalItems = historyRequests.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentHistoryData = historyRequests.slice(startIndex, endIndex);
  
  const currentReq = selectedReqId ? historyRequests.find(r => r.emp_reqId === selectedReqId) : historyRequests[0];

  useEffect(() => {
    if (activeTab === "history" && historyRequests.length > 0 && !selectedReqId) {
      setSelectedReqId(historyRequests[0].emp_reqId);
    }
  }, [activeTab, historyRequests, selectedReqId]);

  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getDates = (req) => {
    if (!req) return "";
    return req.VL_StartDate
      ? `${new Date(req.VL_StartDate).toLocaleDateString()} — ${new Date(req.VL_EndDate).toLocaleDateString()}`
      : req.SL_StartDate
        ? `${new Date(req.SL_StartDate).toLocaleDateString()} — ${new Date(req.SL_EndDate).toLocaleDateString()}`
        : req.ST_StartDate
          ? `${new Date(req.ST_StartDate).toLocaleDateString()} — ${new Date(req.ST_EndDate).toLocaleDateString()}`
          : req.OT_DateOf
            ? `${new Date(req.OT_DateOf).toLocaleDateString()} (${formatTime(req.HrFrom)} - ${formatTime(req.HrTo)})`
            : req.LC_logDate
              ? new Date(req.LC_logDate).toLocaleDateString()
              : req.EL_DateOfLeave
                ? new Date(req.EL_DateOfLeave).toLocaleDateString()
                : req.HD_DateOfLeave
                  ? new Date(req.HD_DateOfLeave).toLocaleDateString()
                  : req.DateonField ? new Date(req.DateonField).toLocaleDateString() : "";
  };

  const getShortType = (typeName) => {
    if (!typeName) return "REQ";
    const name = typeName.toLowerCase();
    if (name.includes("vacation")) return "VL";
    if (name.includes("sick")) return "SL";
    if (name.includes("overtime")) return "OT";
    if (name.includes("onfield") || name.includes("field")) return "OW";
    if (name.includes("correction")) return "LC";
    if (name.includes("emergency")) return "EL";
    if (name.includes("half-day") || name.includes("half")) return "HD";
    if (name.includes("maternity")) return "MAT";
    if (name.includes("paternity")) return "PAT";
    if (name.includes("solo parent")) return "SP";
    if (name.includes("vawc")) return "VAW";
    if (name.includes("special leave") || name.includes("special")) return "SPC";
    return "REQ";
  };

  const getStatusColor = (statusId) => {
    if (statusId === 1 || statusId === 4) return "bg-orange-100 text-orange-800 hover:bg-orange-100";
    if (statusId === 2) return "bg-green-100 text-green-800 hover:bg-green-100";
    if (statusId === 3) return "bg-red-100 text-red-800 hover:bg-red-100";
    return "bg-slate-100 text-slate-800";
  };

  const getTypeColor = (shortType) => {
    switch (shortType) {
      case "VL": return "bg-indigo-100 text-indigo-800 border-transparent";
      case "SL": return "bg-rose-100 text-rose-800 border-transparent";
      case "OW": return "bg-orange-100 text-orange-800 border-transparent";
      case "OT": return "bg-blue-100 text-blue-800 border-transparent";
      case "LC": return "bg-emerald-100 text-emerald-800 border-transparent";
      case "MAT": return "bg-fuchsia-100 text-fuchsia-800 border-transparent";
      case "PAT": return "bg-cyan-100 text-cyan-800 border-transparent";
      case "SP": return "bg-amber-100 text-amber-800 border-transparent";
      case "VAW": return "bg-red-100 text-red-800 border-transparent";
      case "SPC": return "bg-violet-100 text-violet-800 border-transparent";
      default: return "bg-slate-100 text-slate-800 border-transparent";
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">

        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] leading-tight">My Requests</h1>
          <span className="text-sm text-slate-500 mt-1 block">
              Submit and track your leave, overtime, and log corrections.
          </span>
        </div>
        
        {/* Dashboard-Style Statistics Cards */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
          {/* Card 1: Pending */}
          <Card className="shadow-sm border-0 bg-[#FAF2FF] py-0 h-full min-w-0">
            <CardContent className="px-5 py-5 flex justify-between h-full">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider mb-2">Pending Requests</p>
                  <p className="text-4xl font-bold text-[#2A174E]">{stats.pending}</p>
                </div>
                <p className="text-xs text-[#2A174E]/70 italic mt-4">Awaiting admin approval</p>
              </div>
              <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <HourglassEmptyIcon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Approved */}
          <Card className="shadow-sm border-0 bg-[#F8FFF2] py-0 h-full min-w-0">
            <CardContent className="px-5 py-5 flex justify-between h-full">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-[#3B4E17] uppercase tracking-wider mb-2">Approved Total</p>
                  <p className="text-4xl font-bold text-[#3B4E17]">{stats.approved}</p>
                </div>
                <p className="text-xs text-[#3B4E17]/70 italic mt-4">Processed and approved requests</p>
              </div>
              <div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <CheckCircleOutlineIcon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Rejected */}
          <Card className="shadow-sm border-0 bg-[#FFFFF2] py-0 h-full min-w-0">
            <CardContent className="px-5 py-5 flex justify-between h-full">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Rejected Total</p>
                  <p className="text-4xl font-bold text-[#BB8B26]">{stats.rejected}</p>
                </div>
                <p className="text-xs text-[#BB8B26]/70 italic mt-4">Declined and unapproved requests</p>
              </div>
              <div className="bg-[#BB8B26]/20 text-[#BB8B26] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <CancelOutlinedIcon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Split Content */}
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
          
          {/* Left: Request Queue or Guidelines */}
          <Card className="w-full lg:w-1/3 flex flex-col shadow-sm border-0 bg-white h-full overflow-hidden py-0">
            <div className="flex border-b border-slate-100 bg-slate-50/50 shrink-0">
              <button
                className={`flex-1 py-4 font-semibold text-sm transition-colors ${activeTab === "submit" ? "text-[#2A174E] border-b-2 border-[#2A174E] bg-white" : "text-slate-500 hover:bg-slate-100"}`}
                onClick={() => setActiveTab("submit")}
              >
                <AddCircleOutlineIcon className="h-4 w-4 mr-1 mb-0.5" /> Submit Request
              </button>
              <button
                className={`flex-1 py-4 font-semibold text-sm transition-colors ${activeTab === "history" ? "text-[#2A174E] border-b-2 border-[#2A174E] bg-white" : "text-slate-500 hover:bg-slate-100"}`}
                onClick={() => setActiveTab("history")}
              >
                <HistoryIcon className="h-4 w-4 mr-1 mb-0.5" /> History
              </button>
            </div>
            
            {activeTab === "submit" ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Your Leave Balances</h4>
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-sm font-semibold text-slate-700">Vacation Leave (VL)</span>
                     <Badge className="bg-indigo-100 text-indigo-800">{balance ? balance.VL_balance : "..."} days</Badge>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-sm font-semibold text-slate-700">Sick Leave (SL)</span>
                     <Badge className="bg-rose-100 text-rose-800">{balance ? balance.SL_balance : "..."} days</Badge>
                  </div>
                  {userData?.is_solo_parent && (
                    <div className="flex justify-between items-center">
                       <span className="text-sm font-semibold text-slate-700">Solo Parent Leave</span>
                       <Badge className="bg-amber-100 text-amber-800">{balance ? balance.SoloParent_balance : "..."} days</Badge>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Filing Guidelines</h4>
                  <ul className="text-xs text-blue-700 space-y-2 list-disc pl-4 font-medium">
                    <li>Vacation Leaves must be filed at least 3 days in advance.</li>
                    <li>Log corrections can be filed for any past date.</li>
                    <li>Attachments are strictly required for Sick Leaves exceeding 2 days.</li>
                    <li>Sundays cannot be filed for Log Corrections.</li>
                  </ul>
                </div>

              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 py-0 custom-scrollbar">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-1 mt-4">
                  Past Requests ({totalItems})
                </h4>
                
                {loading ? (
                  <div className="text-center py-8 text-slate-500 animate-pulse">Syncing history...</div>
                ) : currentHistoryData.length > 0 ? (
                  currentHistoryData.map((req) => {
                    const isSelected = currentReq?.emp_reqId === req.emp_reqId;
                    return (
                      <div
                        key={req.emp_reqId}
                        onClick={() => setSelectedReqId(req.emp_reqId)}
                        className={`p-4 border rounded-xl cursor-pointer transition-all ${isSelected ? "bg-[#f0ebfa] border-[#2A174E] shadow-sm" : "border-slate-200 bg-white hover:border-[#2A174E]/50"}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <Badge variant="outline" className={getTypeColor(getShortType(req.reqTypeName))}>
                            {getShortType(req.reqTypeName)}
                          </Badge>
                          <span className="text-xs text-slate-500 font-medium">REQ-{req.emp_reqId}</span>
                        </div>
                        <p className="font-bold text-slate-800 text-sm mb-1">{req.reqTypeName}</p>
                        <p className="text-xs text-slate-500">{getDates(req)}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl mt-2">
                    <HourglassEmptyIcon className="h-8 w-8 text-slate-300 mb-2" />
                    <h5 className="font-bold text-[#2A174E] text-sm mb-1">No Records Found</h5>
                    <p className="text-xs text-slate-500">Your history is currently empty.</p>
                  </div>
                )}

                {/* Queue Pagination Footer */}
                {totalItems > itemsPerPage && (
                  <div className="flex items-center justify-between py-4 shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="h-8 px-2"
                    >
                      <ChevronLeftIcon className="h-4 w-4 text-slate-500" />
                    </Button>
                    <span className="text-xs font-semibold text-slate-500">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                      disabled={currentPage === totalPages}
                      className="h-8 px-2"
                    >
                      <ChevronRightIcon className="h-4 w-4 text-slate-500" />
                    </Button>
                  </div>
                )}

              </div>
            )}
          </Card>

          {/* Right: Detailed Review / Form Pane */}
          <Card className="w-full lg:w-2/3 flex flex-col shadow-sm border-0 bg-white h-full overflow-hidden py-2">
            {activeTab === "submit" ? (
              <CardContent className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="mb-6">
                  <h3 className="text-xl md:text-2xl font-bold text-[#2A174E]">Submit New Request</h3>
                  <p className="text-sm text-slate-500 mt-1">Fill out the form below to file a new attendance or leave request.</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Request Type <span className="text-red-500">*</span></label>
                    <Select value={formData.emp_reqTypeId} onValueChange={(val) => handleSelectChange("emp_reqTypeId", val)} required>
                      <SelectTrigger className="w-full bg-slate-50/50 border-slate-200 focus-visible:ring-[#2A174E]">
                        <SelectValue placeholder="Select request type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Standard Requests</SelectLabel>
                          <SelectItem value="1">Overtime (OT)</SelectItem>
                          <SelectItem value="2">Onfield Work</SelectItem>
                          <SelectItem value="3">Vacation Leave (VL)</SelectItem>
                          <SelectItem value="4">Sick Leave (SL)</SelectItem>
                          <SelectItem value="5">Log Correction</SelectItem>
                          <SelectItem value="6">Emergency Leave (EL)</SelectItem>
                          <SelectItem value="7">Half-Day</SelectItem>
                        </SelectGroup>
                        
                        <SelectGroup>
                          <SelectLabel>Statutory Benefits</SelectLabel>
                          {userData?.user_Gender === "Female" && (
                            <SelectItem value="8">Maternity Leave</SelectItem>
                          )}
                          {userData?.user_Gender === "Male" && userData?.civil_status === "Married" && (
                            <SelectItem value="9">Paternity Leave</SelectItem>
                          )}
                          {userData?.is_solo_parent && (
                            <SelectItem value="10">Solo Parent Leave</SelectItem>
                          )}
                          {userData?.user_Gender === "Female" && (
                            <>
                              <SelectItem value="11">VAWC Leave</SelectItem>
                              <SelectItem value="12">Special Leave for Women</SelectItem>
                            </>
                          )}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* CONDITIONAL FIELDS */}
                  {formData.emp_reqTypeId === "7" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 border-dashed">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Half-Day Date</label>
                        <Input type="date" name="leaveStartDate" value={formData.leaveStartDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Period</label>
                        <Select value={formData.period} onValueChange={(val) => handleSelectChange('period', val)} required>
                          <SelectTrigger className="w-full bg-slate-50/50 border-slate-200">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Morning">Morning (8:30am - 12:30pm)</SelectItem>
                            <SelectItem value="Afternoon">Afternoon (1:00pm - 5:30pm)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {formData.emp_reqTypeId === "6" && (
                    <div className="pt-4 border-t border-slate-100 border-dashed space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Emergency Leave Date</label>
                        <Input type="date" name="leaveStartDate" value={formData.leaveStartDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                      </div>
                    </div>
                  )}

                  {formData.emp_reqTypeId === "5" && (
                    <div className="pt-4 border-t border-slate-100 border-dashed space-y-4">
                      <p className="text-xs font-bold text-slate-500 uppercase">Current Period: <span className="text-[#2A174E]">{payroll.payEnding}</span></p>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Correction Category</label>
                        <Select value={formData.correctionCategory} onValueChange={(val) => handleSelectChange('correctionCategory', val)}>
                          <SelectTrigger className="w-full bg-slate-50/50">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Morning">Morning (Time-In)</SelectItem>
                            <SelectItem value="Afternoon">Afternoon (Time-Out)</SelectItem>
                            <SelectItem value="Overtime">Overtime Correction</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Date to Correct</label>
                        <Select value={formData.logCorrDate} onValueChange={(val) => handleLogDateChange(val)}>
                          <SelectTrigger className="w-full bg-slate-50/50">
                            <SelectValue placeholder="Select a date" />
                          </SelectTrigger>
                          <SelectContent>
                            {periodDates.map(date => (
                              <SelectItem key={date} value={date}>{new Date(date).toLocaleDateString()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Current In</label>
                          <Input type="text" value={formData.currentIn || "No Log"} readOnly className="bg-slate-100 text-slate-500" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Current Out</label>
                          <Input type="text" value={formData.currentOut || "No Log"} readOnly className="bg-slate-100 text-slate-500" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Claimed In</label>
                          <Input type="time" name="claimedIn" value={formData.claimedIn} onChange={handleInputChange} required className="bg-slate-50/50" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Claimed Out</label>
                          <Input type="time" name="claimedOut" value={formData.claimedOut} onChange={handleInputChange} required className="bg-slate-50/50" />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.emp_reqTypeId === "1" && (
                    <div className="pt-4 border-t border-slate-100 border-dashed space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">OT Date</label>
                        <Input type="date" name="otDate" value={formData.otDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Time From</label>
                          <Input type="time" name="hrFrom" value={formData.hrFrom} onChange={handleInputChange} required className="bg-slate-50/50" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Time To</label>
                          <Input type="time" name="hrTo" value={formData.hrTo} onChange={handleInputChange} required className="bg-slate-50/50" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Total Hours</label>
                        <Input type="number" name="totalHrs" value={formData.totalHrs} readOnly className="bg-slate-100 text-slate-500 font-bold" />
                      </div>
                    </div>
                  )}

                  {formData.emp_reqTypeId === "2" && (
                    <div className="pt-4 border-t border-slate-100 border-dashed space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Onfield Date</label>
                        <Input type="date" name="otDate" value={formData.otDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Expected Hours</label>
                        <Input type="number" name="totalHrs" value={formData.totalHrs} onChange={handleInputChange} step="0.5" min="1" max="8" required className="bg-slate-50/50" />
                      </div>
                    </div>
                  )}

                  {(["3", "4", "8", "9", "10", "11", "12"].includes(formData.emp_reqTypeId)) && (
                    <div className="pt-4 border-t border-slate-100 border-dashed space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Start Date</label>
                          <Input type="date" name="leaveStartDate" value={formData.leaveStartDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">End Date</label>
                          <Input type="date" name="leaveEndDate" value={formData.leaveEndDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Number of Days</label>
                        <Input type="number" name="noDays" value={formData.noDays} readOnly className="bg-slate-100 text-slate-500 font-bold" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-4 border-t border-slate-100 border-dashed">
                    <label className="text-sm font-bold text-slate-700">Description / Purpose <span className="text-red-500">*</span></label>
                    <Textarea name="remarks" placeholder="Please provide detailed remarks..." value={formData.remarks} onChange={handleInputChange} required className="bg-slate-50/50 resize-none h-24" />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Attachment {["8", "11", "12"].includes(formData.emp_reqTypeId) ? <span className="text-red-500">*</span> : "(Optional)"}</label>
                    <Input type="file" name="proofFile" onChange={handleInputChange} accept="image/png, image/jpeg, image/jpg" className="bg-slate-50/50 cursor-pointer" />
                    <p className="text-xs text-slate-400">
                      {["8", "11", "12"].includes(formData.emp_reqTypeId) 
                        ? "Mandatory for legal compliance (Medical Cert/Barangay Cert)." 
                        : "Required for Sick Leaves spanning more than 2 days."}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <Button type="submit" className="bg-[#2A174E] text-white hover:bg-[#1a0e30] w-full sm:w-auto px-8">Submit Request</Button>
                  </div>
                </form>

              </CardContent>
            ) : (
              <CardContent className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                {currentReq ? (
                  <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-6 mb-6 gap-4">
                      <div>
                        <h3 className="text-xl md:text-2xl font-bold text-[#2A174E]">Review {currentReq.reqTypeName}</h3>
                        <p className="text-sm text-slate-500 mt-1">Submitted on {currentReq.date_Filed ? new Date(currentReq.date_Filed).toLocaleDateString() : ""}</p>
                      </div>
                      <Badge variant="secondary" className={`px-4 py-2 text-sm justify-center ${getStatusColor(currentReq.emp_reqStatusId)}`}>
                        {currentReq.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100 mb-4">
                      
                      <div className="space-y-1 sm:col-span-2 xl:col-span-1 p-3 -m-3 rounded-lg ">
                        <label className="text-xs font-bold text-slate-500 uppercase">Requested Schedule</label>
                        <p className="font-bold text-[#2A174E]">{getDates(currentReq)}</p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Duration / Details</label>
                        <p className="font-semibold text-slate-800">
                          {currentReq.emp_reqTypeId === 1
                            ? `${currentReq.Total_Hrs || 0} Hrs`
                            : currentReq.emp_reqTypeId === 2
                              ? `${currentReq.OW_NoDays || 0} Day(s) (${currentReq.OW_NoHrs || 0} Hrs)`
                              : currentReq.emp_reqTypeId === 5
                                ? `${currentReq.LC_correctionCategory || "Correction"} for ${new Date(currentReq.LC_logDate).toLocaleDateString()}`
                                : currentReq.emp_reqTypeId === 6 
                                  ? `${currentReq.EL_NoDays || 0} Day(s)`
                                  : currentReq.emp_reqTypeId === 7 
                                    ? `Half-day (${currentReq.HD_period})`
                                    : [8, 9, 10, 11, 12].includes(currentReq.emp_reqTypeId)
                                      ? `${currentReq.ST_NoDays || 0} Day(s)`
                                      : `${currentReq.VL_NoDays || currentReq.SL_NoDays || 0} Day(s)`}
                        </p>
                      </div>

                      {currentReq.emp_reqTypeId === 1 && (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time From</label>
                            <p className="font-semibold text-slate-800">{formatTime(currentReq.HrFrom)}</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time To</label>
                            <p className="font-semibold text-slate-800">{formatTime(currentReq.HrTo)}</p>
                          </div>
                        </>
                      )}

                      {currentReq.emp_reqTypeId === 5 && (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
                            <Badge variant="outline" className="mt-1">{currentReq.LC_correctionCategory || "N/A"}</Badge>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current In (System)</label>
                            <p className="font-semibold text-slate-800">{currentReq.LC_currentIn || "No Log"}</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Out (System)</label>
                            <p className="font-semibold text-slate-800">{currentReq.LC_currentOut || "No Log"}</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Claimed In</label>
                            <p className="font-bold text-blue-700">{formatTime(currentReq.LC_claimedIn)}</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Claimed Out</label>
                            <p className="font-bold text-blue-700">{formatTime(currentReq.LC_claimedOut)}</p>
                          </div>
                        </>
                      )}

                      {currentReq.emp_reqTypeId !== 1 && currentReq.emp_reqTypeId !== 5 && (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Status</label>
                            <p className="font-semibold text-slate-800 mt-1">
                                {currentReq.VL_withPayName || currentReq.SL_withPayName || currentReq.ST_withPayName || (currentReq.emp_reqStatusId === 1 ? "Pending" : "N/A")}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              {currentReq.emp_reqStatusId === 1 ? "Remaining Balance" : "Leave Used"}
                            </label>
                            <p className="font-semibold text-slate-800 mt-1">
                              {currentReq.emp_reqTypeId === 3 
                                ? (currentReq.emp_reqStatusId === 1 ? `${currentReq.VL_balance || 0} VL Remaining` : `${currentReq.VL_NoDays || 0} Day(s) Used`)
                                : currentReq.emp_reqTypeId === 4 
                                ? (currentReq.emp_reqStatusId === 1 ? `${currentReq.SL_balance || 0} SL Remaining` : `${currentReq.SL_NoDays || 0} Day(s) Used`)
                                : currentReq.emp_reqTypeId === 10
                                ? (currentReq.emp_reqStatusId === 1 ? `${currentReq.SoloParent_balance || 0} SP Remaining` : `${currentReq.ST_NoDays || 0} Day(s) Used`)
                                : "N/A"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Processed By</label>
                            <p className="font-semibold text-slate-800">{currentReq.approverName ? `${currentReq.approverName} (${formatUserId(currentReq.processedBy)})` : "Pending Review"}</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date Processed</label>
                            <p className="font-semibold text-slate-800">{currentReq.date_Processed || "Pending"}</p>
                          </div>
                        </>
                      )}

                      {currentReq.emp_reqTypeId === 5 && (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recommended By</label>
                            <p className="font-semibold text-slate-800">{currentReq.recommenderName ? `${currentReq.recommenderName} (${formatUserId(currentReq.recommendedBy)})` : "Pending Recommendation"}</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Approved By</label>
                            <p className="font-semibold text-slate-800">{currentReq.approverName ? `${currentReq.approverName} (${formatUserId(currentReq.processedBy)})` : "Pending Approval"}</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date Processed</label>
                            <p className="font-semibold text-slate-800">{currentReq.date_Processed || "Pending"}</p>
                          </div>
                        </>
                      )}

                      {(currentReq.SL_proof_File || currentReq.OW_proof_File || currentReq.LC_proof_File || currentReq.ST_proof_File) && (
                        <div className="space-y-1 col-span-1 sm:col-span-2 xl:col-span-3">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attachment</label>
                          <div>
                            <a 
                              href={`/api/uploads/${currentReq.SL_proof_File || currentReq.OW_proof_File || currentReq.LC_proof_File || currentReq.ST_proof_File}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-[#2A174E] font-semibold hover:underline mt-1"
                            >
                              <AttachmentIcon className="mr-1 h-4 w-4" /> View Attachment
                            </a>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 col-span-1 sm:col-span-2 xl:col-span-3 border-t border-slate-200 pt-4 mt-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Remarks / Purpose</label>
                        <p className="text-sm text-slate-700 italic bg-white p-4 rounded-lg border border-slate-200">"{currentReq.remarks || "No details provided"}"</p>
                      </div>

                      {currentReq.system_remarks && (
                        <div className="space-y-2 col-span-1 sm:col-span-2 xl:col-span-3">
                          <label className="text-xs font-bold text-red-600 uppercase tracking-wider">System Validation Note:</label>
                          <p className="text-sm text-red-700 italic bg-red-50 p-4 rounded-lg border border-red-200">"{currentReq.system_remarks}"</p>
                        </div>
                      )}

                      {currentReq.admin_remarks && (
                        <div className="space-y-2 col-span-1 sm:col-span-2 xl:col-span-3">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admin Reply</label>
                          <p className="text-sm text-slate-700 italic bg-white p-4 rounded-lg border border-slate-200">"{currentReq.admin_remarks}"</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 p-12">
                     <HourglassEmptyIcon className="h-12 w-12 text-slate-300 mb-4" />
                     <p>Select a request from your history queue to view details.</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

        </div>
        
        {/* Global styling for custom scrollbars */}
        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
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
      </div>
      </Sidebar>
    </div>
  );
};

export default UserRequests;