import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../../components/Sidebar";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import { formatDateLocal, isInSamePeriod } from "../../../utils/formatTime";
import { formatUserId } from "../../../utils/formatUserId";
import Toast from "../../../components/toast/Toast";

// Material UI Icons
import FilterListIcon from '@mui/icons-material/FilterList';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import GroupIcon from '@mui/icons-material/Group';
import EventIcon from '@mui/icons-material/Event';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import SecurityIcon from '@mui/icons-material/Security';
import PieChartIcon from '@mui/icons-material/PieChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DashboardIcon from '@mui/icons-material/Dashboard';

// Lucide Icons
import { HistoryIcon, Landmark, Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";

// shadcn/ui components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const INITIAL_LOAN_REGISTRY = [
  { id: "cash_advance", dbType: "Cash Advance", label: "Cash Advances", category: "Internal", templateId: "CASH_ADVANCE_TEMPLATE", hasRowTotals: false, isCore: true },
  { id: "eastwest_loan", dbType: "Eastwest Loan", label: "Eastwest Bank Loan", category: "External Partner", templateId: "EASTWEST_LOAN_TEMPLATE", hasRowTotals: true, isCore: true },
  { id: "sss_loan", dbType: "SSS Loan", label: "SSS Statutory Loan", category: "Government", templateId: "GOV_LOAN_SSS_LOAN_TEMPLATE", hasRowTotals: true, isCore: true },
  { id: "pagibig_loan", dbType: "Pag-IBIG Loan", label: "Pag-IBIG Loan", category: "Government", templateId: "GOV_LOAN_PAGIBIG_LOAN_TEMPLATE", hasRowTotals: true, isCore: true },
  { id: "multipurpose", dbType: "Multi-Purpose", label: "Multipurpose Savings", category: "Government", templateId: "GOV_LOAN_MULTIPURPOSE_TEMPLATE", hasRowTotals: true, isCore: true },
  { id: "calamity", dbType: "Calamity Loan", label: "Calamity Loan", category: "Government", templateId: "GOV_LOAN_CALAMITY_TEMPLATE", hasRowTotals: true, isCore: true },
  { id: "maxicare_hmo", dbType: "Maxicare HMO", label: "Maxicare HMO Plan", category: "Insurance", templateId: "MAXICARE_HMO_TEMPLATE", hasRowTotals: false, isCore: true }
];

const LoanManagement = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1 || userData?.user_RoleId === 4;

  // Master States
  const [loanRegistry, setLoanRegistry] = useState(INITIAL_LOAN_REGISTRY);
  const [activeLoanId, setActiveLoanId] = useState("cash_advance");
  const [selectedYear, setSelectedYear] = useState(systemToday ? new Date(systemToday).getFullYear() : new Date().getFullYear());
  
  // Data State Repositories
  const [employeeList, setEmployeeList] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [loanMatrices, setLoanMatrices] = useState({});
  const [excludedDates, setExcludedDates] = useState([]);

  // Maxicare Specific Configuration Fallbacks & Configuration Maps
  const [cycleConfigs, setCycleConfigs] = useState({});
  const [employerShare, setEmployerShare] = useState(50);
  const [maxicareConfig, setMaxicareConfig] = useState({ totalGross: 0, monthsToPay: 12, cycleStartDate: "" });

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [syncingCell, setSyncingCell] = useState(null);

  // Modals & Forms States
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [file, setFile] = useState(null);
  const [batchForm, setBatchForm] = useState({ dates: [], amount: "", selectedEmployees: [] });
  const [newChannelForm, setNewChannelForm] = useState({ label: "", category: "External Partner", hasRowTotals: true });

  const activeLoan = useMemo(() => {
    return loanRegistry.find(l => l.id === activeLoanId) || loanRegistry[0];
  }, [activeLoanId, loanRegistry]);

  // Handle Event Input State Changes Safely
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewChannelForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleMaxicareConfigChange = (e) => {
    const { name, value } = e.target;
    let sanitized = value;
    if (name === "totalGross") {
      sanitized = value.replace(/,/g, "");
      if (isNaN(sanitized) && sanitized !== "") return;
      sanitized = sanitized === "" ? 0 : parseFloat(sanitized);
    }
    setMaxicareConfig(prev => ({ ...prev, [name]: sanitized }));
    if (name === "cycleStartDate" && value) {
      const yr = new Date(value).getFullYear();
      if (!isNaN(yr)) setSelectedYear(yr);
    }
  };

  // Instantiates a Completely Custom Loan Entity Track on the Fly
  const handleCreateNewChannel = () => {
    if (!newChannelForm.label.trim()) {
      setToast({ message: "Please provide a valid name for the new institution.", type: "error" });
      return;
    }
    const cleanId = newChannelForm.label.toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (loanRegistry.some(l => l.id === cleanId || l.dbType === newChannelForm.label)) {
      setToast({ message: "A loan program or partner with this title already exists.", type: "error" });
      return;
    }

    const createdChannel = {
      id: cleanId,
      dbType: newChannelForm.label.trim(),
      label: newChannelForm.label.trim(),
      category: newChannelForm.category,
      templateId: `DYNAMIC_LOAN_${cleanId.toUpperCase()}_TEMPLATE`,
      hasRowTotals: newChannelForm.hasRowTotals,
      isCore: false
    };

    setLoanRegistry(prev => [...prev, createdChannel]);
    setActiveLoanId(createdChannel.id);
    setShowNewChannelModal(false);
    setNewChannelForm({ label: "", category: "External Partner", hasRowTotals: true });
    setToast({ message: `Successfully initialized dashboard for ${createdChannel.label}!`, type: "success" });
  };

  // Deletes an entirely dynamically provisioned channel partner track
  const handleDeleteChannel = (e, targetId, targetLabel) => {
    e.stopPropagation(); // Stop click from activating tab during execution
    if (!window.confirm(`Are you sure you want to delete the "${targetLabel}" track? This will remove its access module view frame layout from your active registry.`)) return;

    setLoanRegistry(prev => prev.filter(item => item.id !== targetId));
    setLoanMatrices(prev => {
      const updated = { ...prev };
      delete updated[targetId];
      return updated;
    });

    if (activeLoanId === targetId) {
      setActiveLoanId("cash_advance");
    }

    setToast({ message: `Successfully unlinked and removed ${targetLabel} channel pipeline.`, type: "success" });
  };

  // Generates Standard Semi-Monthly Interval Blocks
  const computeCutoffIntervals = () => {
    const dates = [];
    for (let m = 0; m < 12; m++) {
      const d15 = new Date(selectedYear, m, 15);
      dates.push(`${d15.getFullYear()}-${String(d15.getMonth() + 1).padStart(2, '0')}-15`);
      const last = new Date(selectedYear, m + 1, 0);
      dates.push(`${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`);
    }
    setExpectedDates(dates);
  };

  // Safe Parameter Generation for Maxicare Cycle Matrix Calculations
  const getMaxicareCycleRange = (year = selectedYear) => {
    const startDate = cycleConfigs[year]?.cycleStartDate || maxicareConfig.cycleStartDate;
    if (!startDate) return null;
    
    const baseStart = new Date(startDate);
    const startMonth = baseStart.getUTCMonth();
    const startDay = baseStart.getUTCDate();
    
    const start = new Date(year, startMonth, startDay, 0, 0, 0);
    const end = new Date(start);
    const months = cycleConfigs[year]?.monthsToPay || maxicareConfig.monthsToPay || 12;
    end.setMonth(start.getMonth() + parseInt(months));
    
    const deductionEnd = new Date(end);
    deductionEnd.setMonth(deductionEnd.getMonth() + 1, 0);
    deductionEnd.setHours(23, 59, 59, 999);
    
    return { start, end, deductionEnd };
  };

  const mCycle = useMemo(() => getMaxicareCycleRange(), [selectedYear, cycleConfigs, maxicareConfig.cycleStartDate, maxicareConfig.monthsToPay]);

  // Master Data Ingestion Pipeline
  const fetchPayrollCoreData = async () => {
    setLoading(true);
    setError(null);
    try {
      computeCutoffIntervals();
      
      const empRes = await fetchWithAuth("/api/users/all");
      const employees = await empRes.json();
      
      const activeEmps = employees.filter(e => e.dailyRate > 0).map(emp => ({
        user_Id: emp.user_Id,
        name: `${emp.user_LastName}, ${emp.user_FirstName}`,
        id: `MACJ-${String(emp.user_Id).padStart(3, "0")}`,
        key: emp.user_Id.toString(),
        healthCard_Amnt: parseFloat(emp.healthCard_Amnt) || 0
      }));
      setEmployeeList(activeEmps);

      const comprehensiveMatrices = {};

      // System settings load configuration for Maxicare HMO rules
      const settingsRes = await fetchWithAuth("/api/system/settings");
      const settingsData = await settingsRes.json();
      if (settingsRes.ok && settingsData) {
        let configs = {};
        if (!Array.isArray(settingsData.maxicareDates) && settingsData.maxicareDates && typeof settingsData.maxicareDates === 'object') {
          configs = settingsData.maxicareDates.configs || {};
          setCycleConfigs(configs);
        }
        const currentYearConfig = configs[selectedYear] || {
          totalGross: 0, monthsToPay: 12, cycleStartDate: settingsData.maxicareCycleStartDate || ""
        };
        setMaxicareConfig({
          totalGross: currentYearConfig.totalGross,
          monthsToPay: currentYearConfig.monthsToPay,
          cycleStartDate: currentYearConfig.cycleStartDate || settingsData.maxicareCycleStartDate || ""
        });
      }

      // Fetch running totals and data across registered channels
      for (const channel of loanRegistry) {
        const targetRoute = channel.id === "maxicare_hmo" 
          ? "/api/payroll/maxicare/history" 
          : `/api/payroll/loans/history?type=${encodeURIComponent(channel.dbType)}`;
          
        const res = await fetchWithAuth(targetRoute);
        const json = await res.json();
        const rawHistory = channel.id === "maxicare_hmo" ? (json.history || []) : (json || []);

        if (Array.isArray(rawHistory)) {
          const innerDateMap = {};
          rawHistory.forEach(item => {
            const dateKey = formatDateLocal(item.date);
            if (!innerDateMap[dateKey]) innerDateMap[dateKey] = {};
            innerDateMap[dateKey][item.user_Id.toString()] = {
              amount: parseFloat(item.amount),
              status: item.status || 'paid'
            };
          });

          comprehensiveMatrices[channel.id] = Object.keys(innerDateMap).sort().map(date => ({
            date, values: innerDateMap[date]
          }));
        } else {
          comprehensiveMatrices[channel.id] = [];
        }
      }

      setLoanMatrices(comprehensiveMatrices);
    } catch (err) {
      console.error("Unified Loader Pipeline Anomaly:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollCoreData();
  }, [selectedYear, loanRegistry.length]);

  const activeMatrixData = useMemo(() => {
    return loanMatrices[activeLoan.id] || [];
  }, [loanMatrices, activeLoan.id]);

  // Master Amortization Calculation Properties
  const maxicareSubscribers = useMemo(() => {
    let count = 0;
    employeeList.forEach(e => {
      if (e.healthCard_Amnt > 0) count++;
    });
    return count || employeeList.length;
  }, [employeeList]);

  const hmoCutoffDeduction = useMemo(() => {
    const employeeShareAmount = maxicareConfig.totalGross * ((100 - employerShare) / 100);
    return maxicareConfig.monthsToPay > 0 ? employeeShareAmount / (maxicareConfig.monthsToPay * 2) : 0;
  }, [maxicareConfig.totalGross, maxicareConfig.monthsToPay, employerShare]);

  // Dynamic Date Array Filtration View State Generator
  const displayDates = useMemo(() => {
    const baseSet = new Set([...expectedDates, ...activeMatrixData.map(d => d.date)]);
    
    // Auto-generate virtual extensions if managing Maxicare HMO timelines
    if (activeLoan.id === "maxicare_hmo" && mCycle) {
      const baseDate = new Date(maxicareConfig.cycleStartDate);
      let curr = new Date(selectedYear, baseDate.getUTCMonth(), baseDate.getUTCDate() <= 15 ? 15 : new Date(selectedYear, baseDate.getUTCMonth() + 1, 0).getDate());
      while (curr <= mCycle.deductionEnd) {
        baseSet.add(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`);
        if (curr.getDate() === 15) {
          curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
        } else {
          curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 15);
        }
      }
    }

    return [...baseSet].filter(d => {
      if (excludedDates.includes(d)) return false;
      const dDate = new Date(d);
      if (activeLoan.id === "maxicare_hmo" && mCycle) {
        return dDate >= mCycle.start && dDate <= mCycle.deductionEnd;
      }
      return dDate.getFullYear() === selectedYear;
    }).sort();
  }, [expectedDates, activeMatrixData, activeLoan.id, mCycle, maxicareConfig.cycleStartDate, selectedYear, excludedDates]);

  // Handles Single Cell Double-Click Mutations & Mass Auto-Fills Forwards
  const handleCellSave = async (dateStr, empKey) => {
    if (!editingCell) return;
    const sanitizedValue = editValue.replace(/,/g, "").trim();
    const numericVal = sanitizedValue === "" ? 0 : parseFloat(sanitizedValue);
    setEditingCell(null);

    if (isNaN(numericVal)) {
      setToast({ message: "Invalid numerical format notation schema entry.", type: "error" });
      return;
    }

    setSyncingCell({ date: dateStr, empKey });
    const todayStr = systemToday ? formatDateLocal(systemToday) : "";
    const updates = [];

    // Maxicare forward-filling algorithm rule implementation preservation
    const isMaxicareFill = activeLoan.id === "maxicare_hmo" && numericVal > 0 && numericVal >= (hmoCutoffDeduction - 0.01);
    const targetDatesIndex = displayDates.indexOf(dateStr);
    const currentCutoffIndex = currentCutoffDate ? displayDates.indexOf(currentCutoffDate) : displayDates.length;

    const intervalsToProcess = isMaxicareFill 
      ? displayDates.slice(targetDatesIndex, currentCutoffIndex) 
      : [dateStr];

    setLoanMatrices(prev => {
      const activeArr = [...(prev[activeLoan.id] || [])];
      
      intervalsToProcess.forEach(dStr => {
        let rowIdx = activeArr.findIndex(d => isInSamePeriod(d.date, dStr));
        if (rowIdx === -1) {
          activeArr.push({ date: dStr, values: { [empKey]: { amount: numericVal, status: dStr < todayStr ? 'paid' : 'estimated' } } });
        } else {
          const currentVal = activeArr[rowIdx].values[empKey]?.amount || 0;
          if (currentVal === 0 || dStr === dateStr) {
            activeArr[rowIdx] = {
              ...activeArr[rowIdx],
              values: { ...activeArr[rowIdx].values, [empKey]: { amount: numericVal, status: dStr < todayStr ? 'paid' : 'estimated' } }
            };
          }
        }
        updates.push({ date: dStr, user_Id: parseInt(empKey), amount: numericVal, type: activeLoan.dbType });
      });

      return { ...prev, [activeLoan.id]: activeArr.sort((a, b) => a.date.localeCompare(b.date)) };
    });

    try {
      const syncRoute = activeLoan.id === "maxicare_hmo" ? "/api/payroll/maxicare/sync" : "/api/payroll/loans/sync";
      const res = await fetchWithAuth(syncRoute, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      if (res.ok) {
        setToast({ message: "Changes captured and synced successfully.", type: "success" });
      } else {
        fetchPayrollCoreData();
      }
    } catch (err) {
      setToast({ message: "Network synchronization error.", type: "error" });
      fetchPayrollCoreData();
    } finally {
      setTimeout(() => setSyncingCell(null), 500);
    }
  };

  // Commits Complete Configurations & Matrix Parameters to Database Engine
  const saveGlobalTableConfigurations = async () => {
    try {
      setLoading(true);
      if (activeLoan.id === "maxicare_hmo") {
        const finalDates = displayDates.filter(d => !excludedDates.includes(d)).sort();
        const updatedConfigs = { ...cycleConfigs, [selectedYear]: { ...maxicareConfig } };

        await fetchWithAuth("/api/system/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxicareDates: { dates: finalDates, configs: updatedConfigs }
          })
        });
      }
      setToast({ message: "Master transaction matrix layout and parameters saved.", type: "success" });
      setIsEditingTable(false);
      setExcludedDates([]);
      fetchPayrollCoreData();
    } catch (err) {
      setToast({ message: "Failed configuration sync write execution.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Clears out active structural selections inside columns
  const emptyColumnData = async (empKey) => {
    if (!window.confirm("Are you sure you want to completely clear the values inside this personnel track column?")) return;
    const updates = displayDates.map(dateStr => ({
      date: dateStr, user_Id: parseInt(empKey), amount: 0, status: 'removed', type: activeLoan.dbType
    }));

    try {
      const route = activeLoan.id === "maxicare_hmo" ? "/api/payroll/maxicare/sync" : "/api/payroll/loans/sync";
      await fetchWithAuth(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      setToast({ message: "Column metrics set to zero.", type: "success" });
      fetchPayrollCoreData();
    } catch (err) {
      setToast({ message: "Failed runtime clear command execution.", type: "error" });
    }
  };

  // Execution engine for batch adjustments
  const handleExecuteBatchForm = async () => {
    if (batchForm.dates.length === 0 || !batchForm.amount || batchForm.selectedEmployees.length === 0) {
      setToast({ message: "Please select target intervals, personnel, and a valid amount value.", type: "error" });
      return;
    }
    const amt = parseFloat(batchForm.amount);
    if (isNaN(amt)) return;

    setLoading(true);
    const updates = [];
    batchForm.dates.forEach(d => {
      batchForm.selectedEmployees.forEach(uid => {
        updates.push({ date: d, user_Id: uid, amount: amt, type: activeLoan.dbType });
      });
    });

    try {
      const route = activeLoan.id === "maxicare_hmo" ? "/api/payroll/maxicare/sync" : "/api/payroll/loans/sync";
      const res = await fetchWithAuth(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      if (res.ok) {
        setToast({ message: `Successfully executed mass update for ${updates.length} entries!`, type: "success" });
        setShowBatchModal(false);
        setBatchForm({ dates: [], amount: "", selectedEmployees: [] });
        fetchPayrollCoreData();
      }
    } catch (err) {
      setToast({ message: "Failed complete execution run batch command.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // CSV Template Generation
  const triggerCSVTemplateDownload = () => {
    const headers = [activeLoan.templateId, ...employeeList.map(e => `${e.name} #${e.id}`)];
    const csvRows = [headers.join(",")];
    displayDates.forEach(d => {
      csvRows.push(`${d},${employeeList.map(() => "").join(",")}`);
    });
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeLoan.id}_matrix_fy_${selectedYear}.csv`;
    link.click();
  };

  // Ingests CSV File Streams
  const handleCSVUploadProcessing = async () => {
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result.replace(/^\uFEFF/, '');
        const lines = text.split("\n").filter(l => l.trim() !== "");
        const headers = lines[0].split(",");
        const fileTemplateId = headers[0]?.trim();

        if (fileTemplateId !== activeLoan.templateId) {
          setToast({ message: `Template signature validation error. Expected mapping format for: ${activeLoan.templateId}`, type: "error" });
          setLoading(false);
          return;
        }

        const empMappings = [];
        for (let i = 1; i < headers.length; i++) {
          const match = headers[i].match(/#MACJ-(\d+)/i);
          if (match) empMappings.push({ columnIndex: i, user_Id: parseInt(match[1]) });
        }

        const updates = [];
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(",");
          const rowDate = columns[0]?.trim();
          if (!rowDate) continue;

          empMappings.forEach(map => {
            const val = parseFloat(columns[map.columnIndex]?.trim() || 0);
            if (val > 0) updates.push({ date: rowDate, user_Id: map.user_Id, amount: val, type: activeLoan.dbType });
          });
        }

        const route = activeLoan.id === "maxicare_hmo" ? "/api/payroll/maxicare/sync" : "/api/payroll/loans/sync";
        const res = await fetchWithAuth(route, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates })
        });
        if (res.ok) {
          setToast({ message: `CSV Ingestion Stream completed! Synced ${updates.length} statements.`, type: "success" });
          setShowBatchModal(false);
          setFile(null);
          fetchPayrollCoreData();
        }
      } catch (err) {
        setToast({ message: "Parsing validation structural failure.", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // Matrix Mathematical Cross-Section Subtotal Calculators
  const computedMetrics = useMemo(() => {
    const subscriberSet = new Set();
    let currentYearTotal = 0;
    let allTimeTotal = 0;

    activeMatrixData.forEach(item => {
      const year = new Date(item.date).getFullYear();
      Object.keys(item.values).forEach(empKey => {
        const amt = item.values[empKey]?.amount || 0;
        if (amt > 0) {
          allTimeTotal += amt;
          if (year === selectedYear) {
            subscriberSet.add(empKey);
            currentYearTotal += amt;
          }
        }
      });
    });

    return {
      activeSubscribers: activeLoan.id === "maxicare_hmo" ? maxicareSubscribers : subscriberSet.size,
      yearCollected: currentYearTotal,
      allTimeCollected: allTimeTotal
    };
  }, [activeMatrixData, selectedYear, activeLoan.id, maxicareSubscribers]);

  const getRowIntervalSum = (dateStr) => {
    const row = activeMatrixData.find(d => isInSamePeriod(d.date, dateStr));
    if (!row) return 0;
    return Object.values(row.values).reduce((sum, v) => sum + (v.amount || 0), 0);
  };

  const getEmployeeVerticalSum = (empKey) => {
    return displayDates.reduce((acc, dStr) => {
      const period = activeMatrixData.find(item => isInSamePeriod(item.date, dStr));
      return acc + (period?.values[empKey]?.amount || 0);
    }, 0);
  };

  const currentCutoffDate = systemToday ? expectedDates.find(d => d >= formatDateLocal(systemToday)) : null;
  const renderMoney = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "success" })} />}

      {/* --- INTRALEDGER ADDITION PROVISIONER MODAL --- */}
      <Dialog open={showNewChannelModal} onOpenChange={setShowNewChannelModal}>
        <DialogContent className="max-w-md bg-white p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#2A174E] flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" /> Loan Program Channel Provisioner
            </DialogTitle>
            <DialogDescription>Add a new company or statutory channel to dynamically generate standard track components.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Institution Name</label>
              <Input name="label" placeholder="e.g., SSS Salary Loan, BDO Loan Partner" value={newChannelForm.label} onChange={handleConfigChange} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">System Categorization Mapping</label>
              <Select value={newChannelForm.category} onValueChange={(val) => setNewChannelForm(prev => ({ ...prev, category: val }))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Internal">Internal Organization Ledger</SelectItem>
                  <SelectItem value="External Partner">External Commercial Bank Partner</SelectItem>
                  <SelectItem value="Government">Statutory Government Bureau</SelectItem>
                  <SelectItem value="Insurance">Corporate Medical/HMO Provider</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateNewChannel} className="w-full bg-[#2A174E] hover:bg-[#1a0e30] text-white font-semibold mt-2">Initialize Deductions Track</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- REUSABLE MASTER BATCH UPLOADER OVERLAY --- */}
      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent className="max-w-2xl bg-white p-6 rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#2A174E]">Batch Entry Control — {activeLoan.label}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="form" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="form">Manual Entry Form</TabsTrigger>
              <TabsTrigger value="csv">CSV File Upload</TabsTrigger>
            </TabsList>
            <TabsContent value="form" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Target Cut-off Periods</label>
                  <div className="border border-slate-200 rounded-lg p-2.5 max-h-[140px] overflow-y-auto bg-slate-50 space-y-1.5 custom-scrollbar text-xs">
                    {displayDates.map(d => (
                      <label key={d} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-white rounded transition-colors">
                        <input type="checkbox" checked={batchForm.dates.includes(d)} onChange={() => setBatchForm(p => ({ ...p, dates: p.dates.includes(d) ? p.dates.filter(x => x !== d) : [...p.dates, d] }))} />
                        {d}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Deduction Value (₱)</label>
                  <Input type="number" placeholder="0.00" value={batchForm.amount} onChange={(e) => setBatchForm(p => ({ ...p, amount: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Target Personnel Roster</label>
                <div className="border border-slate-200 rounded-lg p-3 max-h-[180px] overflow-y-auto bg-slate-50 text-xs grid grid-cols-1 md:grid-cols-2 gap-2 custom-scrollbar">
                  {employeeList.map(e => (
                    <label key={e.user_Id} className="flex items-center gap-2.5 cursor-pointer p-1.5 hover:bg-white rounded transition-colors">
                      <input type="checkbox" checked={batchForm.selectedEmployees.includes(e.user_Id)} onChange={() => setBatchForm(p => ({ ...p, selectedEmployees: p.selectedEmployees.includes(e.user_Id) ? p.selectedEmployees.filter(x => x !== e.user_Id) : [...p.selectedEmployees, e.user_Id] }))} />
                      <span className="font-medium text-slate-700">{e.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={handleExecuteBatchForm} className="w-full bg-[#2A174E] text-white hover:bg-[#1a0e30]">Commit Batch Execution</Button>
            </TabsContent>
            <TabsContent value="csv" className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex flex-col items-center text-center">
                <p className="text-sm text-blue-800 mb-4">Extract layout signature template explicitly structural parameters matching ledger context matching rules.</p>
                <Button variant="outline" size="sm" onClick={triggerCSVTemplateDownload} className="border-blue-600 text-blue-600 hover:bg-blue-100">
                  <DownloadIcon className="mr-2 h-4 w-4" /> Download CSV Framework Struct
                </Button>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-[#2A174E] transition-colors cursor-pointer relative">
                  <Input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <CloudUploadIcon className="text-slate-400 h-12 w-12 mb-2" />
                  <p className="text-sm font-medium text-slate-600">{file ? file.name : "Click or drag verification CSV file here"}</p>
                </div>
                <Button onClick={handleCSVUploadProcessing} disabled={!file} className="w-full bg-[#2A174E] text-white">Execute Processing Upload</Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Sidebar>
        <div className="p-4 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Top Operational Navigation Blocks */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-[#2A174E] tracking-tight">Unified Loan & Financial Deductions Platform</h1>
              <p className="text-sm text-slate-500 mt-1">Configure structural variables, view distributed matrix collections maps, and track custom partner balances.</p>
            </div>
            <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
              <Button onClick={() => setShowNewChannelModal(true)} className="bg-gradient-to-r from-indigo-600 to-[#2A174E] text-white font-bold h-9 shadow-sm">
                + Provision New Partner
              </Button>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-[150px] h-9 bg-white font-bold text-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 15 }, (_, i) => 2020 + i).map(y => (
                    <SelectItem key={y} value={y.toString()}>Fiscal Year {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* --- ACTIVE TAB CHANNELS NAVIGATION BAR --- */}
          <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200/60 overflow-x-auto custom-scrollbar flex gap-1">
            {loanRegistry.map(ch => (
              <button
                key={ch.id}
                onClick={() => { setActiveLoanId(ch.id); setIsEditingTable(false); }}
                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all flex items-center gap-2 pr-3 group relative ${activeLoanId === ch.id ? 'bg-[#2A174E] text-white shadow' : 'text-slate-500 hover:bg-slate-100 hover:text-[#2A174E]'}`}
              >
                <Landmark className="h-3.5 w-3.5 opacity-80" />
                {ch.label}
                <span className="text-[9px] px-1.5 py-0.2 bg-black/10 rounded font-mono text-slate-400">{ch.category}</span>
                
                {/* Delete button option - explicitly bound to dynamic non-core extensions */}
                {!ch.isCore && isAdmin && (
                  <span 
                    onClick={(e) => handleDeleteChannel(e, ch.id, ch.label)}
                    className="ml-1 p-0.5 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                    title="Remove Dynamic Program Track"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Dynamic Core Analytics Metric Framework Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeLoan.id === "maxicare_hmo" ? (
              <>
                <Card className="bg-white shadow-sm border-l-4 border-l-[#2A174E]">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-slate-100 text-[#2A174E]"><SecurityIcon /></div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block truncate">Gross Premium Configured</span>
                      <p className="text-2xl font-black text-slate-800 truncate">{renderMoney(maxicareConfig.totalGross)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white shadow-sm border-l-4 border-l-emerald-500">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-slate-100 text-emerald-600"><PieChartIcon /></div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block truncate">Cutoff Deduction Amortization</span>
                      <p className="text-2xl font-black text-slate-800 truncate">{renderMoney(hmoCutoffDeduction)}</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card className="bg-white shadow-sm border-l-4 border-l-[#2A174E]">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-slate-100 text-[#2A174E]"><GroupIcon /></div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block truncate">Active Deductions Cohort</span>
                      <p className="text-2xl font-black text-slate-800 truncate">{computedMetrics.activeSubscribers} Accounts</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white shadow-sm border-l-4 border-l-emerald-500">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-slate-100 text-emerald-600"><AccountBalanceIcon /></div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block truncate">Remitted This Year ({selectedYear})</span>
                      <p className="text-2xl font-black text-slate-800 truncate">{renderMoney(computedMetrics.yearCollected)}</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
            <Card className="bg-[#2A174E] text-white shadow-sm">
              <CardContent className="p-4 flex items-center gap-4 h-full">
                <div className="p-3 rounded-xl bg-white/10 text-yellow-400"><AccountBalanceWalletIcon /></div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider block truncate">Accumulated Remittances Ledger (All-Time)</span>
                  <p className="text-xl font-black text-white tracking-tight truncate">{renderMoney(computedMetrics.allTimeCollected)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Configuration Forms Box (Appears only when active context is Maxicare HMO configuration) */}
          {activeLoan.id === "maxicare_hmo" && isEditingTable && (
            <Card className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4 animate-in fade-in-50 duration-200 text-left">
              <h4 className="text-sm font-bold text-[#2A174E] uppercase tracking-wider border-b pb-2">Maxicare Amortization Plan Parameters</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Gross Premium (₱)</label>
                  <Input name="totalGross" type="text" value={maxicareConfig.totalGross} onChange={handleMaxicareConfigChange} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Amortization Length (Months)</label>
                  <Input name="monthsToPay" type="number" value={maxicareConfig.monthsToPay} onChange={handleMaxicareConfigChange} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Cycle Start Date</label>
                  <Input name="cycleStartDate" type="date" value={maxicareConfig.cycleStartDate} onChange={handleMaxicareConfigChange} />
                </div>
              </div>
            </Card>
          )}

          {/* Action Context Menu Links Block */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
            <h3 className="text-lg font-bold text-[#2A174E] flex items-center gap-2">{activeLoan.label} Dynamic History Matrix</h3>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button size="sm" variant="outline" onClick={() => { setBatchForm({ dates: [], amount: "", selectedEmployees: [] }); setShowBatchModal(true); }} className="border-[#2A174E] text-[#2A174E]"><GroupAddOutlinedIcon className="h-4 w-4 mr-1"/> Mass Upload</Button>
              <Button size="sm" onClick={() => { if (isEditingTable) { saveGlobalTableConfigurations(); } else { setIsEditingTable(true); } }} className={isEditingTable ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-white border border-[#2A174E] text-[#2A174E] hover:bg-slate-50"}>
                {isEditingTable ? <><CheckIcon className="h-4 w-4 mr-1"/> Save Matrix Ledger</> : <><EditIcon className="h-4 w-4 mr-1"/> Modify Grid</>}
              </Button>
            </div>
          </div>

          {/* --- COMPREHENSIVE COMPANION DATA MATRIX TABLE --- */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="relative max-h-[62vh] overflow-auto w-full custom-scrollbar">
              <table className="w-full min-w-max border-collapse text-xs">
                <thead>
                  <tr className="bg-[#2A174E] text-white text-center sticky top-0 z-30 shadow-sm">
                    <th className="sticky left-0 bg-[#1e1136] text-yellow-400 p-3 text-left font-bold border-r border-[#2A174E] shadow-[2px_0_5px_rgba(0,0,0,0.1)] min-w-[150px]">
                      INTERVALS SET / DATE
                    </th>
                    {employeeList.map(emp => (
                      <th key={emp.key} className="p-3 border-x border-slate-700 font-semibold min-w-[135px]">
                        <div className="flex flex-col items-center justify-center relative group">
                          <span>{emp.name.split(',')[0]}</span>
                          <span className="text-[10px] text-white/50 font-mono font-light mt-0.5">{emp.id}</span>
                          {isEditingTable && (
                            <button onClick={() => emptyColumnData(emp.key)} className="mt-1 bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white px-1.5 py-0.5 rounded transition-colors text-[9px] font-bold">
                              Clear
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    {activeLoan.hasRowTotals && (
                      <th className="sticky right-0 bg-[#1e1136] text-yellow-400 p-3 font-bold border-l border-[#2A174E] shadow-[-2px_0_5px_rgba(0,0,0,0.1)] min-w-[120px]">
                        INTERVAL SUM
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={employeeList.length + 2} className="p-12 text-center text-slate-400 italic">Compiling relational run configurations matrix parameters framework...</td></tr>
                  ) : displayDates.length === 0 ? (
                    <tr><td colSpan={employeeList.length + 2} className="p-12 text-center text-slate-400 italic">No historical log definitions mapped for target parameters.</td></tr>
                  ) : displayDates.map(dateStr => {
                    const rowRecord = activeMatrixData.find(d => isInSamePeriod(d.date, dateStr));
                    const isCurrent = dateStr === currentCutoffDate;

                    return (
                      <tr key={dateStr} className={`hover:bg-slate-50/80 transition-colors border-b border-slate-100 ${isCurrent ? 'bg-blue-50/20' : ''}`}>
                        
                        {/* Static Interval Block Cell */}
                        <td className="sticky left-0 bg-white font-bold p-3 text-[#2A174E] border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)] text-left flex items-center justify-between">
                          <div className="flex flex-col">
                            <span>{new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            {isCurrent && <span className="bg-yellow-400 text-[#2A174E] text-[8px] font-black px-1 rounded w-fit mt-0.5 leading-tight">CURRENT</span>}
                          </div>
                          {isEditingTable && (
                            <button onClick={() => setExcludedDates(p => [...p, dateStr])} className="text-red-500 hover:text-red-700 p-1 opacity-40 hover:opacity-100 transition-opacity">
                              <DeleteIcon className="!text-sm" />
                            </button>
                          )}
                        </td>

                        {/* Interactive Data Ledger Points */}
                        {employeeList.map(emp => {
                          const recordCell = rowRecord?.values[emp.key];
                          let amount = recordCell ? recordCell.amount : 0;
                          let status = recordCell?.status || 'unpaid';
                          let isProjection = false;

                          // Maintain automated baseline calculation features for Maxicare matrices
                          if (activeLoan.id === "maxicare_hmo" && amount === 0 && status !== 'removed') {
                            const todayStr = systemToday ? formatDateLocal(systemToday) : "";
                            if (dateStr >= todayStr && emp.healthCard_Amnt > 0) {
                              amount = hmoCutoffDeduction;
                              status = 'estimated';
                              isProjection = true;
                            }
                          }

                          const isCellEditing = editingCell?.date === dateStr && editingCell?.empKey === emp.key;
                          const isCellSyncing = syncingCell?.date === dateStr && syncingCell?.empKey === emp.key;

                          return (
                            <td
                              key={emp.key}
                              onDoubleClick={() => isAdmin && !isEditingTable && (setEditingCell({ date: dateStr, empKey: emp.key }) || setEditValue(amount ? amount.toString() : ""))}
                              className={`p-2 text-center font-mono text-xs border-r border-slate-100 relative group transition-all select-none ${isCellEditing ? 'p-0 bg-white' : isCellSyncing ? 'bg-yellow-50 animate-pulse' : amount > 0 && status === 'paid' ? 'text-green-700 font-bold bg-green-50/10' : isProjection ? 'text-slate-400 italic' : amount > 0 ? 'text-slate-700 font-medium' : 'text-slate-200'}`}
                            >
                              {isCellEditing ? (
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => handleCellSave(dateStr, emp.key)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleCellSave(dateStr, emp.key)}
                                  autoFocus
                                  className="w-full h-8 text-center bg-white border-2 border-[#2A174E] outline-none font-bold text-slate-800"
                                />
                              ) : isCellSyncing ? (
                                <span className="text-[9px] font-bold text-yellow-600">SYNC...</span>
                              ) : (
                                <>
                                  {amount > 0 ? amount.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : "—"}
                                  {isProjection && amount > 0 && <span className="absolute top-[2px] right-[2px] text-[7px] font-black bg-slate-200 text-slate-500 px-0.5 rounded leading-none">EST</span>}
                                </>
                              )}
                            </td>
                          );
                        })}

                        {/* Calculated Row Summary Aggregations */}
                        {activeLoan.hasRowTotals && (
                          <td className="sticky right-0 bg-slate-50 font-bold text-center p-3 text-[#2A174E] border-l border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.02)] font-mono">
                            {getRowIntervalSum(dateStr).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>

                {/* Grid Accumulator Footers */}
                {!loading && displayDates.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20 font-bold bg-slate-100 border-t-2 border-slate-300 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
                    <tr>
                      <td className="sticky left-0 bg-slate-100 p-3 border-r border-slate-200 text-[#2A174E] text-left">TOTAL PAID ({selectedYear})</td>
                      {employeeList.map(emp => (
                        <td key={emp.key} className="p-3 text-center font-mono text-slate-800 bg-slate-100/60 border-r border-slate-200">
                          {getEmployeeVerticalSum(emp.key).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                      ))}
                      {activeLoan.hasRowTotals && (
                        <td className="sticky right-0 bg-yellow-400 text-[#2A174E] p-3 text-center font-black font-mono">
                          {renderMoney(computedMetrics.yearCollected)}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>
      </Sidebar>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
};

export default LoanManagement;