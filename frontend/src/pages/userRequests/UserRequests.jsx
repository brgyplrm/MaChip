import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Toast from "../../components/toast/Toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Link } from "react-router-dom";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import { useSystemTime } from "../../context/SystemTimeContext";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const UserRequests = () => {
  const { systemToday } = useSystemTime();
  const dtrRef = useRef();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [activeTab, setActiveTab] = useState("submit"); 
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [historyRequests, setHistoryRequests] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [dtrData, setDtrData] = useState([]);
  const [loading, setLoading] = useState(false);

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
  const [dtrStartDate, setDtrStartDate] = useState(payroll.start);
  const [dtrEndDate, setDtrEndDate] = useState(payroll.end);
  const [balance, setBalance] = useState({ VL_balance: 0, SL_balance: 0 });
  const [minAllowedDate, setMinAllowedDate] = useState("");

  useEffect(() => {
    setDtrStartDate(payroll.start);
    setDtrEndDate(payroll.end);
  }, [payroll]);

  const fetchPayrollPeriods = async () => {
    try {
      const response = await fetchWithAuth("/api/system/payroll-periods");
      if (response.ok) {
        const periods = await response.json();
        const latestClosed = periods
          .filter(p => ["Processing", "Released", "Closed"].includes(p.status))
          .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0];
        
        if (latestClosed) {
          const nextDate = new Date(latestClosed.endDate);
          nextDate.setDate(nextDate.getDate() + 1);
          setMinAllowedDate(nextDate.toISOString().split('T')[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching periods:", error);
    }
  };

  const handleDownloadDTR = async () => {
    const element = dtrRef.current;
    if (!element) return;

    try {
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: "#f7f1e3" 
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`DTR_${userData?.user_LastName || "Report"}.pdf`);
    } catch (error) {
      setToast({ message: "Failed to generate PDF", type: "error" });
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
      const start = minAllowedDate && minAllowedDate < pStart ? minAllowedDate : pStart;
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
  }, [formData.emp_reqTypeId, minAllowedDate, payroll]);

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
      } else {
        console.error("Failed to fetch history:", data.error);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDTR = async () => {
    if (!userData?.user_Id) return;
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/attendance/report?startDate=${dtrStartDate}&endDate=${dtrEndDate}&user_Id=${userData.user_Id}`);
      const data = await response.json();
      if (response.ok) {
        setDtrData(data);
      }
    } catch (error) {
      console.error("Error fetching DTR:", error);
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
      if (activeTab === "dtr") fetchDTR();
    };
    window.addEventListener("dataRefresh", handleRefresh);
    return () => window.removeEventListener("dataRefresh", handleRefresh);
  }, [userData?.user_Id, activeTab]);

  useEffect(() => {
    fetchHistory();
    if (activeTab === "dtr") {
      fetchDTR();
    }
  }, [activeTab]);

  useEffect(() => {
    if (formData.leaveStartDate && formData.leaveEndDate) {
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
  }, [formData.leaveStartDate, formData.leaveEndDate]);

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

    if (name === "correctionCategory") {
      refreshLogDisplay(formData.logCorrDate, newValue, currentPeriodLogs);
    }
    if (name === "otDate") {
      suggestOTTimes(newValue);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let isInsufficient = false;
    if (formData.emp_reqTypeId === "3" && formData.noDays > balance.VL_balance) isInsufficient = true;
    else if (formData.emp_reqTypeId === "4" && formData.noDays > balance.SL_balance) isInsufficient = true;

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
      } else {
        setToast({ message: result.error || "Failed to submit request", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Error connecting to server", type: "error" });
    }
  };

  const getStatusClasses = (status) => {
    if (!status) return { box: "bg-amber-50 border-amber-200", icon: "text-amber-500", badge: "bg-amber-500 hover:bg-amber-600" };
    const s = status.toLowerCase();
    if (s.includes("approve")) return { box: "bg-green-50 border-green-200", icon: "text-green-600", badge: "bg-green-500 hover:bg-green-600" };
    if (s.includes("reject") || s.includes("denied")) return { box: "bg-red-50 border-red-200", icon: "text-red-600", badge: "bg-red-500 hover:bg-red-600" };
    return { box: "bg-amber-50 border-amber-200", icon: "text-amber-500", badge: "bg-amber-500 hover:bg-amber-600" };
  };

  return (
    <div className="home requestsPage">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="requestsWrapper">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
          <div className="statsRow">
            <div className="statCard">
              <div className="info"><span>Pending Requests</span><p>{stats.pending}</p></div>
              <HourglassEmptyIcon className="icon pending" />
            </div>
            <div className="statCard">
              <div className="info"><span>Approved Total</span><p>{stats.approved}</p></div>
              <CheckCircleOutlineIcon className="icon approved" />
            </div>
            <div className="statCard">
              <div className="info"><span>Rejected Total</span><p>{stats.rejected}</p></div>
              <CancelOutlinedIcon className="icon rejected" />
            </div>
          </div><br />
          <div className="contentSection">
            {activeTab !== "dtr" ? (
              <div className="requestsSplitLayout">
                <div className="requestCard formColumn">
                  <h2 className="cardTitle">Submit New Request</h2>
                  <form onSubmit={handleSubmit}>
                    <div className="formGroup">
                      <label>Request Type</label>
                      <select name="emp_reqTypeId" value={formData.emp_reqTypeId} onChange={handleInputChange} required>
                        <option value="" disabled>Select request type</option>
                        <option value="1">Overtime (OT)</option>
                        <option value="2">Onfield Work</option>
                        <option value="3">Vacation Leave (VL)</option>
                        <option value="4">Sick Leave (SL)</option>
                        <option value="6">Emergency Leave (EL)</option>
                        <option value="7">Half-Day</option>
                        <option value="5">Log Correction</option>
                      </select>
                    </div>

                    {formData.emp_reqTypeId === "7" && (
                      <div className="conditionalFields">
                        <div className="formRow">
                          <div className="formGroup">
                            <label>Half-Day Date</label>
                            <input type="date" name="leaveStartDate" min={minAllowedDate} value={formData.leaveStartDate} onChange={handleInputChange} required />
                          </div>
                          <div className="formGroup">
                            <label>Period</label>
                            <select name="period" value={formData.period} onChange={handleInputChange} required>
                                <option value="" disabled>Select period</option>
                                <option value="Morning">Morning (8:30am - 12:30pm)</option>
                                <option value="Afternoon">Afternoon (1:00pm - 5:30pm)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.emp_reqTypeId === "6" && (
                      <div className="conditionalFields">
                        <div className="formRow">
                          <div className="formGroup">
                            <label>Emergency Leave Date</label>
                            <input type="date" name="leaveStartDate" min={minAllowedDate} value={formData.leaveStartDate} onChange={handleInputChange} required />
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.emp_reqTypeId === "5" && (
                      <div className="pt-4 border-t border-slate-100 border-dashed space-y-4">
                        <p className="text-sm text-slate-500 italic">Current Period: {payroll.payEnding}</p>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Correction Category</label>
                          <Select 
                            value={formData.correctionCategory} 
                            onValueChange={(val) => handleInputChange({ target: { name: 'correctionCategory', value: val, type: 'select' } })}
                          >
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
                          <Select 
                            value={formData.logCorrDate} 
                            onValueChange={(val) => handleLogDateChange(val)}
                          >
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
                          <Input type="date" name="otDate" value={formData.otDate} min={minAllowedDate} onChange={handleInputChange} required className="bg-slate-50/50" />
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
                          <Input type="number" name="totalHrs" value={formData.totalHrs} readOnly className="bg-slate-100 text-slate-500" />
                        </div>
                      </div>
                    )}

                    {formData.emp_reqTypeId === "2" && (
                      <div className="pt-4 border-t border-slate-100 border-dashed space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Onfield Date</label>
                          <Input type="date" name="otDate" value={formData.otDate} min={minAllowedDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Expected Hours</label>
                          <Input type="number" name="totalHrs" value={formData.totalHrs} onChange={handleInputChange} step="0.5" min="1" max="8" required className="bg-slate-50/50" />
                        </div>
                      </div>
                    )}

                    {(formData.emp_reqTypeId === "3" || formData.emp_reqTypeId === "4") && (
                      <div className="pt-4 border-t border-slate-100 border-dashed space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Start Date</label>
                            <Input type="date" name="leaveStartDate" min={minAllowedDate} value={formData.leaveStartDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">End Date</label>
                            <Input type="date" name="leaveEndDate" min={minAllowedDate} value={formData.leaveEndDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Number of Days</label>
                          <Input type="number" name="noDays" value={formData.noDays} readOnly className="bg-slate-100 text-slate-500" />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Description / Purpose</label>
                      <Textarea name="remarks" placeholder="Please provide details..." value={formData.remarks} onChange={handleInputChange} required className="bg-slate-50/50 h-24 resize-none" />
                    </div>

                    <Button type="submit" className="w-full bg-[#2A174E] hover:bg-[#1a0e30] text-white py-6">
                      Submit Request
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Right Column: History */}
              <Card className="lg:col-span-5 shadow-sm border-0 bg-white h-fit max-h-[800px] flex flex-col">
                <CardHeader>
                  <CardTitle className="text-xl text-[#2A174E]">All My Requests</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto pr-2">
                  <div className="space-y-3">
                    {loading ? (
                      <p className="text-slate-500 italic">Loading requests...</p>
                    ) : historyRequests.length > 0 ? (
                      historyRequests.slice(0, 15).map(req => {
                        const style = getStatusClasses(req.status);
                        
                        let detailText = "";
                        if (req.emp_reqTypeId === 1) detailText = `${req.Total_Hrs} Hr(s) • ${req.OT_DateOf}`;
                        else if (req.emp_reqTypeId === 2) detailText = `${req.OW_NoDays} Day(s) • ${req.DateonField}`;
                        else if (req.emp_reqTypeId === 6) detailText = `${req.EL_NoDays} Day(s) • ${req.EL_DateOfLeave}`;
                        else if (req.emp_reqTypeId === 7) detailText = `Half-day (${req.HD_period}) • ${req.HD_DateOfLeave}`;
                        else detailText = `${req.VL_NoDays || req.SL_NoDays || 1} Day(s) • ${req.VL_StartDate || req.SL_StartDate}`;

                        return (
                          <Link to={`/requests/${req.emp_reqId}`} key={req.emp_reqId} className="block transition-transform hover:-translate-y-0.5">
                            <div className={`flex items-center gap-4 p-4 border rounded-xl shadow-sm ${style.box}`}>
                              <div className="hidden sm:block shrink-0">
                                {req.status?.toLowerCase().includes("approve") ? <CheckCircleIcon className={`h-8 w-8 ${style.icon}`} /> : 
                                 req.status?.toLowerCase().includes("reject") ? <CancelIcon className={`h-8 w-8 ${style.icon}`} /> : 
                                 <HourglassEmptyIcon className={`h-8 w-8 ${style.icon}`} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <Badge variant="secondary" className="mb-1 bg-slate-200 text-slate-700 hover:bg-slate-200 font-bold">{req.reqTypeName}</Badge>
                                <p className="text-sm text-slate-600 truncate">{req.status} • {detailText}</p>
                              </div>
                              <Badge className={`shrink-0 ${style.badge} text-white shadow-none`}>
                                {req.status}
                              </Badge>
                            </div>
                          </Link>
                        );
                      })
                    ) : (
                      <p className="text-slate-500 italic text-center py-8">No requests found.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>
          ) : (
            <div className="bg-[#f7f1e3] p-8 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800 uppercase tracking-widest m-0">Daily Time Record</h2>
                  <Button className="bg-green-500 hover:bg-green-600 text-white" onClick={handleDownloadDTR}>
                    <CloudUploadIcon className="mr-2 h-4 w-4" /> Export PDF
                  </Button>
              </div>
              <div className="max-w-[600px] mx-auto text-slate-900" ref={dtrRef}>
                 {/* DTR Display Logic is handled by the PDF generator, this div just holds the ref if needed for on-screen view */}
              </div>
            </div>
          )}
        </div>
      </div>
      </Sidebar>
    </div>
  );
};

export default UserRequests;