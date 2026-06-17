import React, { useState, useEffect, useCallback, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AttachmentIcon from '@mui/icons-material/Attachment';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import HistoryIcon from '@mui/icons-material/History';
import AssessmentIcon  from "@mui/icons-material/Assessment";
import EditIcon from "@mui/icons-material/Edit";
import ReplyIcon from "@mui/icons-material/Reply";
import EditRequestModal from "../../components/EditRequestModal";
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { formatDateTime, calculateDays } from "../../utils/formatTime";
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
  const [historyTab, setHistoryTab] = useState("pending"); // "pending", "returned", "past"
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [historyRequests, setHistoryRequests] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, returned: 0 });
  const [loading, setLoading] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRequestToEdit, setSelectedRequestToEdit] = useState(null);

  // Pagination & History States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [selectedReqId, setSelectedReqId] = useState(null);

  useEffect(() => {
    const pending = historyRequests.filter(r => r.emp_reqStatusId === 1 || r.emp_reqStatusId === 4).length;
    const approved = historyRequests.filter(r => r.emp_reqStatusId === 2).length;
    const rejected = historyRequests.filter(r => r.emp_reqStatusId === 3).length;
    const returned = historyRequests.filter(r => r.emp_reqStatusId === 5).length;
    setStats({ pending, approved, rejected, returned });
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
    agency: "",
    loanType: "",
    amountRequested: "",
    monthsToPay: "",
    loanReferenceNo: "",
    loanApprovalDate: "",
    monthlyAmortization: "",
    totalLoanTerm: "",
    amortizationStartMonth: "",
    totalOutstandingBalance: "",
    pagibigTAV: "",
    consoDP: "",
    mscCount: "",
    avgMSC: "",
  });

  const [currentPeriodLogs, setCurrentPeriodLogs] = useState([]);
  const [periodDates, setPeriodDates] = useState([]);

  const fetchCurrentPeriodLogs = async () => {
    if (!userData?.user_Id || !payroll) return;
    try {
      const { start, end } = payroll;

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
        const actualLogs = Array.isArray(data) ? data : (data.logs || []);
        setCurrentPeriodLogs(actualLogs);
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

  const handleEditReturned = (req) => {
    setSelectedRequestToEdit(req);
    setIsEditModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    fetchHistory();
    setToast({ message: "Request updated and resubmitted successfully!", type: "success" });
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
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        setToast({ message: "Invalid file format. Only png, jpg, jpeg, and pdf are allowed!", type: "error" });
        e.target.value = null;
        return;
      }
    }

    const newValue = type === "checkbox" ? checked : type === "file" ? files[0] : value;
    
    // Auto-calculate for SSS Loans (Salary or Calamity)
    if (formData.agency === "SSS" && (formData.loanType === "Salary Loan" || formData.loanType === "Calamity Loan")) {
      // Principal could be entered in 'amountRequested' (Calamity/Other) or 'totalOutstandingBalance' (Salary)
      const isPrincipalField = name === "totalOutstandingBalance" || name === "amountRequested";
      const isTermField = name === "totalLoanTerm" || name === "monthsToPay";

      if (isPrincipalField || isTermField || formData.loanType === "Calamity Loan") {
        const principal = isPrincipalField ? parseFloat(value) : parseFloat(formData.totalOutstandingBalance || formData.amountRequested || 0);
        // Calamity is strictly 24 months per SSS guidelines
        const term = formData.loanType === "Calamity Loan" ? 24 : (isTermField ? parseInt(value) : parseInt(formData.totalLoanTerm || formData.monthsToPay || 0));

        if (principal > 0 && term > 0) {
           // Estimated Amortization with ~10% annual interest
           const monthlyInterest = (0.10 / 12);
           const estimatedAmort = (principal * monthlyInterest * Math.pow(1 + monthlyInterest, term)) / (Math.pow(1 + monthlyInterest, term) - 1);
           
           setFormData(prev => ({ 
             ...prev, 
             [name]: newValue,
             monthlyAmortization: Math.round(estimatedAmort)
           }));
           return;
        }
      }
    }

    // --- HIGH ACCURACY FINANCIAL CALCULATIONS ---
    const isLoanField = ["amountRequested", "monthsToPay", "loanApprovalDate"].includes(name);
    if (isLoanField && (formData.agency === "SSS" || formData.agency === "Pag-IBIG" || formData.agency === "Company")) {
      const principal = name === "amountRequested" ? parseFloat(value) : parseFloat(formData.amountRequested || 0);
      const term = name === "monthsToPay" ? parseInt(value) : parseInt(formData.monthsToPay || 0);
      const approvalDate = name === "loanApprovalDate" ? value : formData.loanApprovalDate;
      const agency = formData.agency;
      const loanType = formData.loanType;

      if (principal > 0 && term > 0) {
        // 1. Determine Interest Rate
        let annualRate = 0;
        if (agency === 'SSS') {
          annualRate = (loanType === 'Calamity Loan') ? 0.06 : 0.10;
        } else if (agency === 'Pag-IBIG') {
          annualRate = (loanType === "Calamity Loan") ? 0.0595 : 0.105;
        } else if (agency === 'Company') {
          annualRate = 0;
        }

        // 2. Monthly Amortization Formula (Standard Annuity)
        let monthlyAmort = 0;
        if (annualRate > 0) {
          const monthlyRate = annualRate / 12;
          const factor = Math.pow(1 + monthlyRate, term);
          monthlyAmort = (principal * monthlyRate * factor) / (factor - 1);
        } else {
          monthlyAmort = principal / term;
        }

        // 3. Upfront Fees (SSS Specific)
        let serviceFeeVal = 0;
        let proRatedVal = 0;
        if (agency === 'SSS' && approvalDate) {
          serviceFeeVal = principal * 0.01;
          const dObj = new Date(approvalDate);
          const daysInMonth = new Date(dObj.getFullYear(), dObj.getMonth() + 1, 0).getDate();
          const daysLeft = daysInMonth - dObj.getDate();
          proRatedVal = (principal * annualRate * daysLeft) / 365;
        }

        const netProceeds = principal - serviceFeeVal - proRatedVal;

        setFormData(prev => ({
          ...prev,
          [name]: newValue,
          monthlyAmortization: Math.round(monthlyAmort * 100) / 100,
          serviceFeeAmount: Math.round(serviceFeeVal * 100) / 100,
          proRatedInterest: Math.round(proRatedVal * 100) / 100,
          netDisbursement: Math.round(netProceeds * 100) / 100
        }));
        return;
      }
    }

    // Auto-calculate Amortization Start Month
    if (name === "loanApprovalDate" && value) {
      const approvalDate = new Date(value);
      if (!isNaN(approvalDate.getTime())) {
        let monthsToAdd = 1;
        
        if (formData.agency === "SSS") {
          // SSS Rule: 2nd month following the month of approval
          monthsToAdd = 2;
        } else if (formData.agency === "Pag-IBIG") {
          if (formData.loanType === "Calamity Loan") {
            // Pag-IBIG Calamity: 3-month grace period (starts 4th month)
            monthsToAdd = 4;
          } else {
            // Pag-IBIG MPL: Starts following month
            monthsToAdd = 1;
          }
        }

        const startMonth = new Date(approvalDate.getFullYear(), approvalDate.getMonth() + monthsToAdd, 1);
        const yyyy = startMonth.getFullYear();
        const mm = String(startMonth.getMonth() + 1).padStart(2, '0');
        
        setFormData(prev => ({ 
          ...prev, 
          [name]: newValue,
          amortizationStartMonth: `${yyyy}-${mm}` 
        }));
        return;
      }
    }

    setFormData((prev) => ({ ...prev, [name]: newValue }));

    if (name === "otDate") {
      suggestOTTimes(newValue);
    }
  };

  const handleSelectChange = (name, val) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: val };
      if (name === "agency") {
        updated.loanType = "";
        if (val === "Company") {
          updated.loanType = "Cash Advance";
          updated.monthsToPay = "1";
        }
      }
      return updated;
    });
    
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

    // Attachment validation for specific statutory leaves and government loans
    const isGovLoan = formData.emp_reqTypeId === "14" && formData.agency !== "Company";
    if ((["8", "11", "12"].includes(formData.emp_reqTypeId) || isGovLoan) && !formData.proofFile) {
      setToast({ message: "Voucher or Disclosure Statement is mandatory for government loan enrollment.", type: "error" });
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
    } else if (["13", "14"].includes(formData.emp_reqTypeId)) {
      formDataToSubmit.append("agency", formData.agency);
      formDataToSubmit.append("loanType", formData.loanType);
      formDataToSubmit.append("amountRequested", formData.amountRequested);
      formDataToSubmit.append("monthsToPay", formData.monthsToPay);
      
      if (formData.agency === "SSS" && formData.loanType === "Salary Loan" && formData.emp_reqTypeId === "14") {
        formDataToSubmit.append("loanReferenceNo", formData.loanReferenceNo);
        formDataToSubmit.append("loanApprovalDate", formData.loanApprovalDate);
        formDataToSubmit.append("monthlyAmortization", formData.monthlyAmortization);
        formDataToSubmit.append("totalLoanTerm", formData.totalLoanTerm);
        formDataToSubmit.append("amortizationStartMonth", formData.amortizationStartMonth);
        formDataToSubmit.append("totalOutstandingBalance", formData.totalOutstandingBalance);
      } else if (formData.agency === "SSS" && formData.loanType === "Emergency Loan" && formData.emp_reqTypeId === "14") {
        formDataToSubmit.append("loanReferenceNo", formData.loanReferenceNo);
        formDataToSubmit.append("loanApprovalDate", formData.loanApprovalDate);
        formDataToSubmit.append("monthlyAmortization", formData.monthlyAmortization);
        formDataToSubmit.append("amortizationStartMonth", formData.amortizationStartMonth);
      } else if (formData.agency === "SSS" && formData.loanType === "SSS Conso Loan" && formData.emp_reqTypeId === "14") {
        formDataToSubmit.append("loanReferenceNo", formData.loanReferenceNo);
        formDataToSubmit.append("loanApprovalDate", formData.loanApprovalDate);
        formDataToSubmit.append("monthlyAmortization", formData.monthlyAmortization);
        formDataToSubmit.append("totalLoanTerm", formData.totalLoanTerm);
        formDataToSubmit.append("amortizationStartMonth", formData.amortizationStartMonth);
        formDataToSubmit.append("totalOutstandingBalance", formData.totalOutstandingBalance);
      } else if (formData.agency === "SSS" && formData.loanType === "Calamity Loan" && formData.emp_reqTypeId === "14") {
        formDataToSubmit.append("calamityArea", formData.calamityArea);
        formDataToSubmit.append("loanReferenceNo", formData.loanReferenceNo);
        formDataToSubmit.append("loanApprovalDate", formData.loanApprovalDate);
        formDataToSubmit.append("totalOutstandingBalance", formData.totalOutstandingBalance);
        formDataToSubmit.append("monthlyAmortization", formData.monthlyAmortization);
        formDataToSubmit.append("netPaySufficient", formData.netPaySufficient);
        if (formData.damageProofFile) {
          formDataToSubmit.append("damageProofFile", formData.damageProofFile);
        }
      } else if (formData.agency === "Pag-IBIG" && formData.loanType === "Multi-Purpose Loan (MPL)" && formData.emp_reqTypeId === "14") {
        formDataToSubmit.append("pagibigTAV", formData.pagibigTAV);
        formDataToSubmit.append("loanReferenceNo", formData.loanReferenceNo);
        formDataToSubmit.append("loanApprovalDate", formData.loanApprovalDate);
        formDataToSubmit.append("monthlyAmortization", formData.monthlyAmortization);
        formDataToSubmit.append("amortizationStartMonth", formData.amortizationStartMonth);
      } else if (formData.agency === "Pag-IBIG" && formData.loanType === "Calamity Loan" && formData.emp_reqTypeId === "14") {
        formDataToSubmit.append("calamityArea", formData.calamityArea);
        formDataToSubmit.append("loanReferenceNo", formData.loanReferenceNo);
        formDataToSubmit.append("loanApprovalDate", formData.loanApprovalDate);
        formDataToSubmit.append("monthlyAmortization", formData.monthlyAmortization);
        formDataToSubmit.append("amortizationStartMonth", formData.amortizationStartMonth);
      }
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
          agency: "",
          loanType: "",
          amountRequested: "",
          monthsToPay: "",
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
  const filteredHistory = historyRequests.filter(req => {
    if (historyTab === "pending") return req.emp_reqStatusId === 1 || req.emp_reqStatusId === 4;
    if (historyTab === "returned") return req.emp_reqStatusId === 5;
    if (historyTab === "past") return req.emp_reqStatusId === 2 || req.emp_reqStatusId === 3;
    return false;
  });

  const totalItems = filteredHistory.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentHistoryData = filteredHistory.slice(startIndex, endIndex);
  
  const currentReq = selectedReqId ? historyRequests.find(r => r.emp_reqId === selectedReqId) : filteredHistory[0];

  useEffect(() => {
    if (activeTab === "history" && filteredHistory.length > 0 && !selectedReqId) {
      setSelectedReqId(filteredHistory[0].emp_reqId);
    }
  }, [activeTab, historyTab, filteredHistory.length, selectedReqId]);

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
                : req.DateonField ? new Date(req.DateonField).toLocaleDateString() : 
                (req.emp_reqTypeId === 13 || req.emp_reqTypeId === 14) ? new Date(req.date_Filed).toLocaleDateString() : "";
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
    if (name.includes("certification")) return "LCERT";
    if (name.includes("enrollment")) return "LENRL";
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
      case "LCERT": return "bg-sky-100 text-sky-800 border-transparent";
      case "LENRL": return "bg-teal-100 text-teal-800 border-transparent";
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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6 mb-6 w-full">
          {/* Card 1: Pending */}
          <Card className="shadow-sm border-t-4 border-[#2A174E] py-0 h-full min-w-0">
            <CardContent className="px-5 py-5 flex justify-between h-full text-left">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider mb-2">Pending</p>
                  <p className="text-4xl font-bold text-[#2A174E]">{stats.pending}</p>
                </div>
              </div>
              <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <HourglassEmptyIcon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Returned */}
          <Card className="shadow-sm border-t-4 border-blue-500  py-0 h-full min-w-0">
            <CardContent className="px-5 py-5 flex justify-between h-full text-left">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Returned</p>
                  <p className="text-4xl font-bold text-blue-800">{stats.returned}</p>
                </div>
              </div>
              <div className="bg-blue-100 text-blue-800 p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <ReplyIcon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Approved */}
          <Card className="shadow-sm border-t-4 border-[#3B4E17] py-0 h-full min-w-0">
            <CardContent className="px-5 py-5 flex justify-between h-full text-left">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-[#3B4E17] uppercase tracking-wider mb-2">Approved</p>
                  <p className="text-4xl font-bold text-[#3B4E17]">{stats.approved}</p>
                </div>
              </div>
              <div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <CheckCircleOutlineIcon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Rejected */}
          <Card className="shadow-sm border-t-4 border-[#BB8B26] py-0 h-full min-w-0">
            <CardContent className="px-5 py-5 flex justify-between h-full text-left">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Rejected</p>
                  <p className="text-4xl font-bold text-[#BB8B26]">{stats.rejected}</p>
                </div>
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
              <div className="flex-1 flex flex-col overflow-hidden py-0">
                {/* Sub-tabs for History */}
                <div className="flex bg-slate-100/50 p-1 m-2 rounded-lg gap-1">
                   {["pending", "returned", "past"].map(t => (
                     <button
                       key={t}
                       onClick={() => { setHistoryTab(t); setCurrentPage(1); setSelectedReqId(null); }}
                       className={`flex-1 py-1.5 text-[11px] font-bold uppercase rounded-md transition-all ${historyTab === t ? "bg-white text-[#2A174E] shadow-sm" : "text-slate-500 hover:bg-white/50"}`}
                     >
                       {t}
                     </button>
                   ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 pt-0 custom-scrollbar">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-1 mt-2">
                    {historyTab === "returned" ? "Editable Requests" : historyTab === "pending" ? "Awaiting Action" : "Finalized Records"} ({totalItems})
                  </h4>
                  
                  {loading ? (
                    <div className="text-center py-8 text-slate-500 animate-pulse">Syncing...</div>
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
                      <h5 className="font-bold text-[#2A174E] text-sm mb-1">Empty</h5>
                      <p className="text-xs text-slate-500">No requests in this category.</p>
                    </div>
                  )}
                </div>

                {/* Queue Pagination Footer */}
                {totalItems > itemsPerPage && (
                  <div className="flex items-center justify-between py-4 shrink-0 px-4 border-t border-slate-100">
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
                          <SelectLabel>Loan Notice</SelectLabel>
                          <SelectItem value="13">Loan Certification (Nudge Admin)</SelectItem>
                          <SelectItem value="14">Loan Enrollment (Payroll Setup)</SelectItem>
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

                  {(["13", "14"].includes(formData.emp_reqTypeId)) && (
                    <div className="pt-4 border-t border-slate-100 border-dashed space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Agency <span className="text-red-500">*</span></label>
                          <Select value={formData.agency} onValueChange={(val) => handleSelectChange('agency', val)} required>
                            <SelectTrigger className="w-full bg-slate-50/50 border-slate-200">
                              <SelectValue placeholder="Select agency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SSS">SSS</SelectItem>
                              <SelectItem value="Pag-IBIG">Pag-IBIG</SelectItem>
                              <SelectItem value="Company">Company / Internal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Loan Type <span className="text-red-500">*</span></label>
                          <Select 
                            value={formData.loanType} 
                            onValueChange={(val) => handleSelectChange('loanType', val)} 
                            required
                            disabled={!formData.agency}
                          >
                            <SelectTrigger className="w-full bg-slate-50/50 border-slate-200">
                              <SelectValue placeholder={!formData.agency ? "Select agency first" : "Select loan type"} />
                            </SelectTrigger>
                            <SelectContent>
                              {formData.agency === "SSS" && (
                                <>
                                  <SelectItem value="Salary Loan">Salary Loan</SelectItem>
                                  <SelectItem value="Calamity Loan">Calamity Loan</SelectItem>
                                  <SelectItem value="Emergency Loan">Emergency Loan</SelectItem>
                                  <SelectItem value="SSS Conso Loan">SSS Conso Loan</SelectItem>
                                </>
                              )}                              {formData.agency === "Pag-IBIG" && (
                                <>
                                  <SelectItem value="Multi-Purpose Loan (MPL)">Multi-Purpose Loan (MPL)</SelectItem>
                                  <SelectItem value="Calamity Loan">Calamity Loan</SelectItem>
                                </>
                              )}
                              {formData.agency === "Company" && (
                                <SelectItem value="Cash Advance">Cash Advance</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* NEW: HIGH ACCURACY FINANCIAL SUMMARY CARD */}
                      {formData.netDisbursement > 0 && (
                        <div className="bg-[#2A174E] text-white p-5 rounded-2xl border border-indigo-900/50 space-y-4 my-6 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                          <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">Matrix Financial Disclosure</h4>
                            <Badge className="bg-yellow-400 text-blue-900 font-black border-0">SSS/HDMF STANDARDS</Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                              <p className="text-[10px] text-indigo-300 font-bold uppercase">Requested Principal</p>
                              <p className="text-2xl font-black tracking-tight">₱{parseFloat(formData.amountRequested || formData.totalOutstandingBalance || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}</p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-[10px] text-indigo-300 font-bold uppercase">Monthly Amortization</p>
                              <p className="text-2xl font-black text-yellow-400 tracking-tight">₱{parseFloat(formData.monthlyAmortization || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}</p>
                              <p className="text-[8px] text-indigo-200 italic font-medium">Split across 2 cutoffs (₱{(parseFloat(formData.monthlyAmortization || 0) / 2).toLocaleString()}/ea)</p>
                            </div>
                          </div>

                          <div className="bg-black/20 p-4 rounded-xl space-y-2 border border-white/5">
                            <div className="flex justify-between text-[11px] font-medium">
                              <span className="text-indigo-200">Processing/Service Fee (1%)</span>
                              <span className="font-mono">- ₱{parseFloat(formData.serviceFeeAmount || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-medium">
                              <span className="text-indigo-200">Advanced Pro-rated Interest</span>
                              <span className="font-mono">- ₱{parseFloat(formData.proRatedInterest || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div className="pt-3 mt-2 border-t border-white/10 flex justify-between items-end">
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">Net Cash to Receive</span>
                                <span className="text-sm text-indigo-200/60 leading-none font-medium italic">Estimated proceeds via check/bank</span>
                              </div>
                              <span className="text-3xl font-black text-emerald-400 tracking-tighter">
                                ₱{parseFloat(formData.netDisbursement || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-[9px] text-indigo-300/70 text-center font-medium italic">
                             Calculated using the Diminishing Principal Balance Method. Final amounts may vary based on exact SSS/HDMF release dates.
                          </p>
                        </div>
                      )}

                      {formData.emp_reqTypeId === "14" && (
                        <div className="space-y-4">
                          {formData.agency === "SSS" && formData.loanType === "Salary Loan" ? (
                            <>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Loan Reference No. <span className="text-red-500">*</span></label>
                                  <Input name="loanReferenceNo" value={formData.loanReferenceNo} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="e.g. 12-3456789-0" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Loan Approval Date <span className="text-red-500">*</span></label>
                                  <Input type="date" name="loanApprovalDate" value={formData.loanApprovalDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Monthly Amortization (₱) <span className="text-red-500">*</span></label>
                                  <Input type="number" name="monthlyAmortization" value={formData.monthlyAmortization} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="0.00" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Total Loan Term (Months) <span className="text-red-500">*</span></label>
                                  <Input type="number" name="totalLoanTerm" value={formData.totalLoanTerm} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="e.g. 24" />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Amortization Start Month <span className="text-red-500">*</span></label>
                                  <Input type="month" name="amortizationStartMonth" value={formData.amortizationStartMonth} onChange={handleInputChange} required className="bg-slate-50/50" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Total Outstanding Balance (₱) <span className="text-red-500">*</span></label>
                                  <Input type="number" name="totalOutstandingBalance" value={formData.totalOutstandingBalance} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="0.00" />
                                </div>
                              </div>
                            </>
                          ) : formData.agency === "SSS" && formData.loanType === "Emergency Loan" ? (
                            <>
                              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4 mb-4">
                                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">SSS Emergency Loan (2026 Rules)</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-600">Total MSC Contributions <span className="text-red-500">*</span></label>
                                    <Select value={formData.mscCount || ""} onValueChange={(val) => handleSelectChange('mscCount', val)}>
                                      <SelectTrigger className="bg-white border-blue-200">
                                        <SelectValue placeholder="Select MSC range" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="18-35">18 to 35 Months (50% Limit)</SelectItem>
                                        <SelectItem value="36+">36 Months or More (100% Limit)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-600">Avg. MSC (Latest 12 Months) <span className="text-red-500">*</span></label>
                                    <Input 
                                      type="number" 
                                      name="avgMSC" 
                                      value={formData.avgMSC || ""} 
                                      onChange={handleInputChange} 
                                      placeholder="0.00" 
                                      className="bg-white border-blue-200"
                                    />
                                  </div>
                                </div>
                                
                                {formData.avgMSC > 0 && formData.mscCount && (
                                  <div className="p-3 bg-white/50 rounded-lg border border-blue-200">
                                    <p className="text-[10px] font-bold text-blue-600 uppercase">Max Loanable Amount (Estimate)</p>
                                    <p className="text-lg font-black text-blue-900">
                                      ₱{(Math.ceil((parseFloat(formData.avgMSC) * (formData.mscCount === "36+" ? 1.0 : 0.5)) / 1000) * 1000).toLocaleString()}
                                    </p>
                                    <p className="text-[9px] text-blue-500 mt-1 italic">Based on SSS Round-Up to nearest thousand rule.</p>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Loan Amount <span className="text-red-500">*</span></label>
                                  <Input type="number" name="amountRequested" value={formData.amountRequested} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="0.00" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Repayment (Months) <span className="text-red-500">*</span></label>
                                  <Input type="number" name="monthsToPay" value={formData.monthsToPay} readOnly className="bg-slate-100 text-slate-500 font-bold" />
                                  <p className="text-[10px] text-slate-400 italic">Fixed 24-month term per SSS ELP guidelines.</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Monthly Amortization <span className="text-red-500">*</span></label>
                                  <Input type="number" name="monthlyAmortization" value={formData.monthlyAmortization} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="0.00" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Loan Reference No. <span className="text-red-500">*</span></label>
                                  <Input name="loanReferenceNo" value={formData.loanReferenceNo} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="e.g. 12-3456789-0" />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Approval/Release Date <span className="text-red-500">*</span></label>
                                  <Input type="date" name="loanApprovalDate" value={formData.loanApprovalDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Amortization Start Month</label>
                                  <Input type="month" name="amortizationStartMonth" value={formData.amortizationStartMonth} readOnly className="bg-slate-100 text-slate-500 font-bold" />
                                  <p className="text-[10px] text-blue-600 font-medium">Auto-calculated: 6-month moratorium applied.</p>
                                </div>
                              </div>
                            </>
                          ) : formData.agency === "SSS" && formData.loanType === "SSS Conso Loan" && formData.emp_reqTypeId === "14" ? (
                            <>
                              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-4 mb-4">
                                <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider">SSS Conso Loan Program</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Total Consolidated Amount (₱) <span className="text-red-500">*</span></label>
                                    <Input 
                                      type="number" 
                                      name="totalOutstandingBalance" 
                                      value={formData.totalOutstandingBalance || ""} 
                                      onChange={(e) => {
                                        handleInputChange(e);
                                        // Auto-calculate 10% DP estimate
                                        const val = parseFloat(e.target.value) || 0;
                                        const dpEstimate = val * 0.10;
                                        handleSelectChange('consoDP', dpEstimate.toString());
                                      }} 
                                      required 
                                      className="bg-white border-purple-200" 
                                      placeholder="0.00" 
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Down Payment Paid (₱) <span className="text-red-500">*</span></label>
                                    <Input 
                                      type="number" 
                                      name="consoDP" 
                                      value={formData.consoDP || ""} 
                                      onChange={(e) => handleSelectChange('consoDP', e.target.value)} 
                                      required 
                                      className="bg-white border-purple-200" 
                                      placeholder="Minimum 10%" 
                                    />
                                    {parseFloat(formData.totalOutstandingBalance) > 0 && parseFloat(formData.consoDP) < (parseFloat(formData.totalOutstandingBalance) * 0.10) && (
                                      <p className="text-[10px] text-red-500 font-bold">Must be at least 10% (₱{(parseFloat(formData.totalOutstandingBalance) * 0.10).toFixed(2)})</p>
                                    )}
                                  </div>
                                </div>
                                
                                {parseFloat(formData.totalOutstandingBalance) > 0 && (
                                  <div className="p-3 bg-white/50 rounded-lg border border-purple-200">
                                    <p className="text-[10px] font-bold text-purple-600 uppercase">Remaining Balance for Payroll Amortization</p>
                                    <p className="text-lg font-black text-purple-900">
                                      ₱{Math.max(0, parseFloat(formData.totalOutstandingBalance || 0) - parseFloat(formData.consoDP || 0)).toLocaleString('en-PH', {minimumFractionDigits: 2})}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Term (Months) <span className="text-red-500">*</span></label>
                                  <Select 
                                    value={formData.totalLoanTerm ? String(formData.totalLoanTerm) : undefined} 
                                    onValueChange={(val) => handleSelectChange('totalLoanTerm', val)}
                                  >
                                    <SelectTrigger className="bg-slate-50/50 border-slate-200">
                                      <SelectValue placeholder="Select Term" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(() => {
                                        const bal = Math.max(0, parseFloat(formData.totalOutstandingBalance || 0) - parseFloat(formData.consoDP || 0));
                                        if (bal === 0) return <SelectItem value="0" disabled>Enter amounts first</SelectItem>;
                                        if (bal <= 5000) return <SelectItem value="0" disabled>Must be paid One-Time directly</SelectItem>;
                                        
                                        return (
                                          <>
                                            {bal > 5000 && <SelectItem value="6">6 Months</SelectItem>}
                                            {bal > 10000 && <SelectItem value="12">12 Months</SelectItem>}
                                            {bal > 18000 && <SelectItem value="24">24 Months</SelectItem>}
                                            {bal > 36000 && <SelectItem value="36">36 Months</SelectItem>}
                                            {bal > 54000 && <SelectItem value="48">48 Months</SelectItem>}
                                            {bal > 72000 && <SelectItem value="60">60 Months</SelectItem>}
                                          </>
                                        );
                                      })()}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Monthly Amortization (₱) <span className="text-red-500">*</span></label>
                                  <Input type="number" name="monthlyAmortization" value={formData.monthlyAmortization} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="0.00" />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Approval Date <span className="text-red-500">*</span></label>
                                  <Input type="date" name="loanApprovalDate" value={formData.loanApprovalDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Amortization Start Month</label>
                                  <Input type="month" name="amortizationStartMonth" value={formData.amortizationStartMonth} onChange={handleInputChange} required className="bg-slate-50/50" />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Conso Reference No. <span className="text-red-500">*</span></label>
                                <Input name="loanReferenceNo" value={formData.loanReferenceNo} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="e.g. 12-3456789-0" />
                              </div>
                            </>
                          ) : formData.agency === "Pag-IBIG" && formData.loanType === "Multi-Purpose Loan (MPL)" && formData.emp_reqTypeId === "14" ? (
                            <>
                              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 space-y-4 mb-4">
                                <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Pag-IBIG Multi-Purpose Loan (MPL)</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Total Accumulated Value (TAV) <span className="text-red-500">*</span></label>
                                    <Input 
                                      type="number" 
                                      name="pagibigTAV" 
                                      value={formData.pagibigTAV || ""} 
                                      onChange={handleInputChange} 
                                      required 
                                      className="bg-white border-emerald-200" 
                                      placeholder="Sum of all contributions" 
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Loan Amount <span className="text-red-500">*</span></label>
                                    <Input 
                                      type="number" 
                                      name="amountRequested" 
                                      value={formData.amountRequested || ""} 
                                      onChange={handleInputChange} 
                                      required 
                                      className="bg-white border-emerald-200" 
                                      placeholder="Up to 80% of TAV" 
                                    />
                                    {parseFloat(formData.pagibigTAV) > 0 && parseFloat(formData.amountRequested) > (parseFloat(formData.pagibigTAV) * 0.80) && (
                                      <p className="text-[10px] text-red-500 font-bold">Limit: ₱{(parseFloat(formData.pagibigTAV) * 0.80).toLocaleString()} (80% of TAV)</p>
                                    )}
                                  </div>
                                </div>
                                
                                {parseFloat(formData.amountRequested) > 0 && (
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-white/50 rounded-lg border border-emerald-200">
                                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Service Fee (1%)</p>
                                      <p className="text-sm font-black text-emerald-900">
                                        ₱{(parseFloat(formData.amountRequested) * 0.01).toLocaleString('en-PH', {minimumFractionDigits: 2})}
                                      </p>
                                    </div>
                                    <div className="p-3 bg-white/50 rounded-lg border border-emerald-200">
                                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Net Proceeds</p>
                                      <p className="text-sm font-black text-emerald-900">
                                        ₱{(parseFloat(formData.amountRequested) * 0.99).toLocaleString('en-PH', {minimumFractionDigits: 2})}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Repayment Term <span className="text-red-500">*</span></label>
                                  <Select 
                                    value={formData.monthsToPay ? String(formData.monthsToPay) : undefined} 
                                    onValueChange={(val) => handleSelectChange('monthsToPay', val)}
                                  >
                                    <SelectTrigger className="bg-slate-50/50 border-slate-200">
                                      <SelectValue placeholder="Select Term" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="12">12 Months (1 Year)</SelectItem>
                                      <SelectItem value="24">24 Months (2 Years)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Monthly Amortization (₱) <span className="text-red-500">*</span></label>
                                  <Input type="number" name="monthlyAmortization" value={formData.monthlyAmortization} readOnly className="bg-slate-100 text-[#2A174E] font-bold" />
                                  <p className="text-[10px] text-slate-400 italic">Auto-computed at 10.5% p.a. interest.</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Loan Approval Date <span className="text-red-500">*</span></label>
                                  <Input type="date" name="loanApprovalDate" value={formData.loanApprovalDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Amortization Start Month</label>
                                  <Input type="month" name="amortizationStartMonth" value={formData.amortizationStartMonth} readOnly className="bg-slate-100 text-slate-500 font-bold" />
                                  <p className="text-[10px] text-emerald-600 font-medium">Starts the following month after approval.</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Loan Reference No. <span className="text-red-500">*</span></label>
                                <Input name="loanReferenceNo" value={formData.loanReferenceNo} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="e.g. 12-3456789-0" />
                              </div>
                            </>
                          ) : formData.agency === "Pag-IBIG" && formData.loanType === "Calamity Loan" && formData.emp_reqTypeId === "14" ? (
                            <>
                              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-4 mb-4">
                                <h4 className="text-xs font-bold text-orange-800 uppercase tracking-wider">Pag-IBIG Calamity Loan</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Declared Calamity Area <span className="text-red-500">*</span></label>
                                    <Input name="calamityArea" value={formData.calamityArea || ""} onChange={handleInputChange} required className="bg-white border-orange-200" placeholder="e.g. Typhoon Enteng - Bicol" />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Loan Amount <span className="text-red-500">*</span></label>
                                    <Input 
                                      type="number" 
                                      name="amountRequested" 
                                      value={formData.amountRequested || ""} 
                                      onChange={handleInputChange} 
                                      required 
                                      className="bg-white border-orange-200" 
                                      placeholder="0.00" 
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Repayment Term <span className="text-red-500">*</span></label>
                                  <Select 
                                    value={formData.monthsToPay ? String(formData.monthsToPay) : undefined} 
                                    onValueChange={(val) => handleSelectChange('monthsToPay', val)}
                                  >
                                    <SelectTrigger className="bg-slate-50/50 border-slate-200">
                                      <SelectValue placeholder="Select Term" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="24">24 Months (2 Years)</SelectItem>
                                      <SelectItem value="36">36 Months (3 Years)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Monthly Amortization (₱) <span className="text-red-500">*</span></label>
                                  <Input type="number" name="monthlyAmortization" value={formData.monthlyAmortization} readOnly className="bg-slate-100 text-[#2A174E] font-bold" />
                                  <p className="text-[10px] text-slate-400 italic">Auto-computed at 5.95% p.a. interest.</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Loan Approval Date <span className="text-red-500">*</span></label>
                                  <Input type="date" name="loanApprovalDate" value={formData.loanApprovalDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Amortization Start Month</label>
                                  <Input type="month" name="amortizationStartMonth" value={formData.amortizationStartMonth} readOnly className="bg-slate-100 text-slate-500 font-bold" />
                                  <p className="text-[10px] text-orange-600 font-medium">Auto-calculated: 3-month grace period applied.</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Loan Reference No. <span className="text-red-500">*</span></label>
                                <Input name="loanReferenceNo" value={formData.loanReferenceNo} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="e.g. 12-3456789-0" />
                              </div>
                            </>
                          ) : formData.agency === "Company" && formData.loanType === "Cash Advance" && formData.emp_reqTypeId === "14" ? (
                            <>
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 mb-4">
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Company Cash Advance</h4>
                                <div className="grid grid-cols-1 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Requested Amount <span className="text-red-500">*</span></label>
                                    <Input 
                                      type="number" 
                                      name="amountRequested" 
                                      value={formData.amountRequested || ""} 
                                      onChange={handleInputChange} 
                                      required 
                                      className="bg-white border-slate-300 h-12 text-lg font-bold" 
                                      placeholder="0.00" 
                                    />
                                    <p className="text-[10px] text-slate-400 italic">Note: This is a short-term advance to be deducted in full on the next available payroll.</p>
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Purpose of Advance <span className="text-red-500">*</span></label>
                                <Textarea 
                                  name="remarks" 
                                  value={formData.remarks} 
                                  onChange={handleInputChange} 
                                  required 
                                  className="bg-white border-slate-200 h-20" 
                                  placeholder="e.g. Personal emergency, medical expenses, etc." 
                                />
                              </div>
                            </>
                          ) : formData.loanType === "Calamity Loan" ? (
                            <>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Declared Calamity Area <span className="text-red-500">*</span></label>
                                  <Input name="calamityArea" value={formData.calamityArea || ""} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="e.g. Typhoon Carina - Manila" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Loan Reference No. <span className="text-red-500">*</span></label>
                                  <Input name="loanReferenceNo" value={formData.loanReferenceNo} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="e.g. 12-3456789-0" />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Loan Approval Date <span className="text-red-500">*</span></label>
                                  <Input type="date" name="loanApprovalDate" value={formData.loanApprovalDate} onChange={handleInputChange} required className="bg-slate-50/50" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Total Loan Amount (₱) <span className="text-red-500">*</span></label>
                                  <Input type="number" name="totalOutstandingBalance" value={formData.totalOutstandingBalance} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="0.00" />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Monthly Amortization (₱) <span className="text-red-500">*</span></label>
                                  <Input type="number" name="monthlyAmortization" value={formData.monthlyAmortization} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="0.00" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">Property Damage Proof <span className="text-red-500">*</span></label>
                                  <Input type="file" name="damageProofFile" onChange={handleInputChange} accept="image/png, image/jpeg, image/jpg, application/pdf" required className="bg-slate-50/50 cursor-pointer" />
                                </div>
                              </div>
                              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3 mt-2">
                                <input type="checkbox" name="netPaySufficient" checked={formData.netPaySufficient || false} onChange={handleInputChange} className="mt-1" required />
                                <label className="text-xs text-orange-800 font-medium">I solemnly confirm that my net take-home pay is sufficient to cover the monthly amortization deduction for this Calamity Loan.</label>
                              </div>
                            </>
                          ) : (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Loan Amount <span className="text-red-500">*</span></label>
                                <Input type="number" name="amountRequested" value={formData.amountRequested} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="0.00" />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Repayment (Months) <span className="text-red-500">*</span></label>
                                <Input type="number" name="monthsToPay" value={formData.monthsToPay} onChange={handleInputChange} required className="bg-slate-50/50" placeholder="e.g. 12" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!(formData.agency === "Company" && formData.loanType === "Cash Advance" && formData.emp_reqTypeId === "14") && (
                    <div className="space-y-2 pt-4 border-t border-slate-100 border-dashed">
                      <label className="text-sm font-bold text-slate-700">Description / Purpose <span className="text-red-500">*</span></label>
                      <Textarea name="remarks" placeholder={formData.emp_reqTypeId === "13" ? "e.g. Applied for SSS Salary Loan on [Date]. Please certify." : "Please provide detailed remarks..."} value={formData.remarks} onChange={handleInputChange} required className="bg-slate-50/50 resize-none h-24" />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">
                      {formData.emp_reqTypeId === "14" && formData.loanType === "Calamity Loan" ? "Disclosure Statement (Required)" : (
                        <>Attachment {["8", "11", "12"].includes(formData.emp_reqTypeId) || (formData.emp_reqTypeId === "14" && formData.agency !== "Company") ? <span className="text-red-500">*</span> : "(Optional)"}</>
                      )}
                    </label>
                    <Input 
                      type="file" 
                      name="proofFile" 
                      onChange={handleInputChange} 
                      accept="image/png, image/jpeg, image/jpg, application/pdf" 
                      className="bg-slate-50/50 cursor-pointer" 
                      required={["8", "11", "12"].includes(formData.emp_reqTypeId) || (formData.emp_reqTypeId === "14" && formData.agency !== "Company")} 
                    />
                    <p className="text-xs text-slate-400">
                      {formData.agency === "Company" ? "Optional: You may upload a supporting document or voucher if necessary." :
                       formData.emp_reqTypeId === "14" && formData.loanType === "Calamity Loan"
                        ? "Mandatory: Please upload the official Disclosure Statement."
                        : formData.emp_reqTypeId === "14" 
                        ? "Mandatory: Please upload your Loan Voucher or Billing Statement."
                        : ["8", "11", "12"].includes(formData.emp_reqTypeId) 
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
                      <div className="flex flex-col sm:flex-row items-end gap-3">
                        {currentReq.emp_reqStatusId === 5 && (
                          <Button 
                            className="bg-[#2A174E] hover:bg-[#1a0e30] text-white font-bold shadow-md"
                            onClick={() => handleEditReturned(currentReq)}
                          >
                            <EditIcon className="mr-2 h-4 w-4" /> Edit & Resubmit
                          </Button>
                        )}
                        <Badge variant="secondary" className={`px-4 py-2 text-sm justify-center ${getStatusColor(currentReq.emp_reqStatusId)}`}>
                          {currentReq.status}
                        </Badge>
                      </div>
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
                                : [3, 4, 6, 8, 9, 10, 11, 12].includes(currentReq.emp_reqTypeId)
                                  ? (() => {
                                      const used = currentReq.VL_NoDays || currentReq.SL_NoDays || currentReq.EL_NoDays || currentReq.ST_NoDays || 0;
                                      const start = currentReq.VL_StartDate || currentReq.SL_StartDate || currentReq.EL_DateOfLeave || currentReq.ST_StartDate;
                                      const end = currentReq.VL_EndDate || currentReq.SL_EndDate || currentReq.EL_DateOfLeave || currentReq.ST_EndDate;
                                      const original = calculateDays(start, end);
                                      return used < original 
                                        ? `${used} Day(s) Used (Original: ${original})` 
                                        : `${used} Day(s)`;
                                    })()
                                  : currentReq.emp_reqTypeId === 7 
                                    ? `Half-day (${currentReq.HD_period})`
                                    : [13, 14].includes(currentReq.emp_reqTypeId)
                                      ? `${currentReq.LR_agency} ${currentReq.LR_loanType}`
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

                      {currentReq.emp_reqTypeId !== 1 && currentReq.emp_reqTypeId !== 5 && ![13, 14].includes(currentReq.emp_reqTypeId) && (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Status</label>
                            <p className="font-semibold text-slate-800 mt-1">
                                {currentReq.VL_withPayName || currentReq.SL_withPayName || currentReq.ST_withPayName || ([1, 4].includes(currentReq.emp_reqStatusId) ? "Pending" : "N/A")}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              {[1, 4].includes(currentReq.emp_reqStatusId) ? "Remaining Balance" : "Leave Used"}
                            </label>
                            <p className="font-semibold text-slate-800 mt-1">
                              {currentReq.emp_reqTypeId === 3 
                                ? ([1, 4].includes(currentReq.emp_reqStatusId) ? `${currentReq.VL_balance || 0} VL Remaining` : `${currentReq.VL_NoDays || 0} Day(s) Used`)
                                : currentReq.emp_reqTypeId === 4 
                                ? ([1, 4].includes(currentReq.emp_reqStatusId) ? `${currentReq.SL_balance || 0} SL Remaining` : `${currentReq.SL_NoDays || 0} Day(s) Used`)
                                : currentReq.emp_reqTypeId === 10
                                ? ([1, 4].includes(currentReq.emp_reqStatusId) ? `${currentReq.SoloParent_balance || 0} SP Remaining` : `${currentReq.ST_NoDays || 0} Day(s) Used`)
                                : "N/A"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Processed By</label>
                            <p className="font-semibold text-slate-800">{currentReq.approverName ? `${currentReq.approverName} (${formatUserId(currentReq.processedBy)})` : "Pending Review"}</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date Processed</label>
                            <p className="font-semibold text-slate-800">{currentReq.date_Processed ? formatDateTime(currentReq.date_Processed) : "Pending"}</p>
                            </div>
                            </>
                            )}

                            {[13, 14].includes(currentReq.emp_reqTypeId) && (
                            <>
                            <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Processed By</label>
                            <p className="font-semibold text-slate-800">{currentReq.approverName ? `${currentReq.approverName} (${formatUserId(currentReq.processedBy)})` : "Pending Review"}</p>
                            </div>
                            <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date Processed</label>
                            <p className="font-semibold text-slate-800">{currentReq.date_Processed ? formatDateTime(currentReq.date_Processed) : "Pending"}</p>
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
                            <p className="font-semibold text-slate-800">{currentReq.date_Processed ? formatDateTime(currentReq.date_Processed) : "Pending"}</p>
                            </div>
                            </>
                            )}

                            {[13, 14].includes(currentReq.emp_reqTypeId) && (
                            <>
                            <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Agency</label>
                            <p className="font-semibold text-slate-800">{currentReq.LR_agency}</p>
                            </div>
                            <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loan Type</label>
                            <p className="font-semibold text-slate-800">{currentReq.LR_loanType}</p>
                            </div>
                            {currentReq.emp_reqTypeId === 14 && (
                            <>
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount / Balance</label>
                                <p className="font-bold text-green-700">
                                  ₱{parseFloat(
                                    (currentReq.LR_agency === "Company" || !currentReq.LR_balance || parseFloat(currentReq.LR_balance) === 0) 
                                      ? (currentReq.LR_amount || 0) 
                                      : currentReq.LR_balance
                                  ).toLocaleString()}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Repayment Term</label>
                                <p className="font-semibold text-slate-800">
                                  {currentReq.LR_agency === "Company" ? "1 Month (Full)" : `${(currentReq.LR_term && parseFloat(currentReq.LR_term) > 0) ? currentReq.LR_term : (currentReq.LR_months || 0)} Months`}
                                </p>
                              </div>
                              {currentReq.LR_amortization && parseFloat(currentReq.LR_amortization) > 0 && (
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Amortization</label>
                                  <p className="font-bold text-blue-700">₱{parseFloat(currentReq.LR_amortization).toLocaleString()}</p>
                                </div>
                              )}
                              {currentReq.LR_reference && (
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reference No.</label>
                                  <p className="font-mono text-xs font-bold text-slate-700">{currentReq.LR_reference}</p>
                                </div>
                              )}
                              {currentReq.LR_calamityArea && (
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Declared Calamity Area</label>
                                  <p className="font-semibold text-orange-600">{currentReq.LR_calamityArea}</p>
                                </div>
                              )}
                            </>
                            )}
                            </>
                            )}

                            {(currentReq.SL_proof_File || currentReq.OW_proof_File || currentReq.LC_proof_File || currentReq.ST_proof_File || currentReq.LR_proof_File || currentReq.LR_damageProof) && (
                            <div className="space-y-2 col-span-1 sm:col-span-2 xl:col-span-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attachments</label>
                            <div className="flex flex-col gap-2">
                            {(currentReq.SL_proof_File || currentReq.OW_proof_File || currentReq.LC_proof_File || currentReq.ST_proof_File || currentReq.LR_proof_File) && (
                              <a 
                                href={`/api/uploads/${currentReq.SL_proof_File || currentReq.OW_proof_File || currentReq.LC_proof_File || currentReq.ST_proof_File || currentReq.LR_proof_File}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-[#2A174E] font-semibold hover:underline w-fit"
                              >
                                <AttachmentIcon className="mr-1 h-4 w-4" /> View Primary Document (Disclosure Statement/Medical Cert)
                              </a>
                            )}
                            {currentReq.LR_damageProof && (
                              <a 
                                href={`/api/uploads/${currentReq.LR_damageProof}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-orange-600 font-semibold hover:underline w-fit"
                              >
                                <AttachmentIcon className="mr-1 h-4 w-4" /> View Property Damage Proof
                              </a>
                            )}
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

      <EditRequestModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        request={selectedRequestToEdit}
        onUpdate={handleUpdateSuccess}
      />
    </div>
  );
};

export default UserRequests;