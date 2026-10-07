import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../../components/Sidebar";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import { formatDateLocal, isInSamePeriod } from "../../../utils/formatTime";
import { formatUserId } from "../../../utils/formatUserId";
import Toast from "../../../components/toast/Toast";

// Material UI Icons
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
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

// Lucide Icons
import { 
  Landmark, 
  Sparkles, 
  X, 
  LayoutGrid, 
  Table2, 
  Eye,
  CircleDollarSign,
  TrendingUp,
  ChevronRight,
  ArrowRightLeft
} from "lucide-react";

// shadcn/ui components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const CORE_LOAN_REGISTRY = [
  { id: "cash_advance", dbType: "Cash Advance", label: "Cash Advance", category: "Internal", templateId: "CASH_ADVANCE_TEMPLATE", hasRowTotals: false },
  { id: "eastwest_loan", dbType: "Eastwest Loan", label: "Eastwest Bank Loan", category: "External Partner", templateId: "EASTWEST_LOAN_TEMPLATE", hasRowTotals: true },
  { id: "sss_loan", dbType: "SSS Loan", label: "SSS Statutory Loan", category: "Government", templateId: "GOV_LOAN_SSS_LOAN_TEMPLATE", hasRowTotals: true },
  { id: "pagibig_loan", dbType: "Pag-IBIG Loan", label: "Pag-IBIG Loan", category: "Government", templateId: "GOV_LOAN_PAGIBIG_LOAN_TEMPLATE", hasRowTotals: true },
  { id: "multipurpose", dbType: "Multi-Purpose", label: "Multipurpose Savings", category: "Government", templateId: "GOV_LOAN_MULTIPURPOSE_TEMPLATE", hasRowTotals: true },
  { id: "calamity", dbType: "Calamity Loan", label: "Calamity Loan", category: "Government", templateId: "GOV_LOAN_CALAMITY_TEMPLATE", hasRowTotals: true },
  { id: "maxicare_hmo", dbType: "Maxicare HMO", label: "Maxicare HMO Plan", category: "Insurance", templateId: "MAXICARE_HMO_TEMPLATE", hasRowTotals: false }
];

const LoanManagementHub = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1 || userData?.user_RoleId === 4;

  // Layout Configuration States
  const [viewMode, setViewMode] = useState("cards"); // "cards" or "table"
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState(systemToday ? new Date(systemToday).getFullYear() : new Date().getFullYear());

  // Master Repositories
  const [loanRegistry, setLoanRegistry] = useState(CORE_LOAN_REGISTRY);
  const [employeeList, setEmployeeList] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [loanMatrices, setLoanMatrices] = useState({});
  const [excludedDates, setExcludedDates] = useState([]);

  // Active Audit State target within Detail Modals/Sheets
  const [auditLoanTab, setAuditLoanTab] = useState("cash_advance");

  // Maxicare Configuration Context Maps
  const [cycleConfigs, setCycleConfigs] = useState({});
  const [employerShare, setEmployerShare] = useState(50);
  const [maxicareConfig, setMaxicareConfig] = useState({ totalGross: 0, monthsToPay: 12, cycleStartDate: "" });

  // UI Flow Controllers
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [syncingCell, setSyncingCell] = useState(null);
  const [isEditingTable, setIsEditingTable] = useState(false);

  // Reusable Overlay triggers
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [file, setFile] = useState(null);
  const [batchForm, setBatchForm] = useState({ dates: [], amount: "", selectedEmployees: [] });
  const [newChannelForm, setNewChannelForm] = useState({ label: "", category: "External Partner", hasRowTotals: true });

  // Compute targeted context properties for downloads matching active selection tags
  const activeTemplateLoan = useMemo(() => {
    return loanRegistry.find(l => l.id === auditLoanTab) || loanRegistry[0];
  }, [auditLoanTab, loanRegistry]);

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

  // Instantiates new institution records on the fly
  const handleCreateNewChannel = () => {
    if (!newChannelForm.label.trim()) {
      setToast({ message: "Please enter a valid partner title name.", type: "error" });
      return;
    }
    const cleanId = newChannelForm.label.toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (loanRegistry.some(l => l.id === cleanId)) {
      setToast({ message: "A partner track with this signature already exists.", type: "error" });
      return;
    }

    const customChannel = {
      id: cleanId,
      dbType: newChannelForm.label.trim(),
      label: newChannelForm.label.trim(),
      category: newChannelForm.category,
      templateId: `DYNAMIC_LOAN_${cleanId.toUpperCase()}_TEMPLATE`,
      hasRowTotals: newChannelForm.hasRowTotals,
      isCore: false
    };

    setLoanRegistry(prev => [...prev, customChannel]);
    setAuditLoanTab(customChannel.id);
    setShowNewChannelModal(false);
    setNewChannelForm({ label: "", category: "External Partner", hasRowTotals: true });
    setToast({ message: `Successfully registered profile matrix infrastructure for ${customChannel.label}!`, type: "success" });
  };

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

  const hmoCutoffDeduction = useMemo(() => {
    const employeeShareAmount = maxicareConfig.totalGross * ((100 - employerShare) / 100);
    return maxicareConfig.monthsToPay > 0 ? employeeShareAmount / (maxicareConfig.monthsToPay * 2) : 0;
  }, [maxicareConfig.totalGross, maxicareConfig.monthsToPay, employerShare]);

  // Master Query Pipeline Loader Ingestion
  const fetchPayrollCoreHubData = async () => {
    setLoading(true);
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
      
      // Load standard global configuration schemas for HMO elements
      const settingsRes = await fetchWithAuth("/api/system/settings");
      const settingsData = await settingsRes.json();
      if (settingsRes.ok && settingsData) {
        let configs = {};
        if (settingsData.maxicareDates && typeof settingsData.maxicareDates === 'object') {
          configs = settingsData.maxicareDates.configs || {};
          setCycleConfigs(configs);
        }
        const targetYearConfig = configs[selectedYear] || { totalGross: 0, monthsToPay: 12, cycleStartDate: "" };
        setMaxicareConfig({
          totalGross: targetYearConfig.totalGross,
          monthsToPay: targetYearConfig.monthsToPay,
          cycleStartDate: targetYearConfig.cycleStartDate || settingsData.maxicareCycleStartDate || ""
        });
      }

      // Loop fetch iterations down across all channels inside structural maps
      for (const channel of loanRegistry) {
        const route = channel.id === "maxicare_hmo" 
          ? "/api/payroll/maxicare/history" 
          : `/api/payroll/loans/history?type=${encodeURIComponent(channel.dbType)}`;
          
        const res = await fetchWithAuth(route);
        const json = await res.json();
        const historyData = channel.id === "maxicare_hmo" ? (json.history || []) : (json || []);

        if (Array.isArray(historyData)) {
          const innerDateMap = {};
          historyData.forEach(item => {
            const dKey = formatDateLocal(item.date);
            if (!innerDateMap[dKey]) innerDateMap[dKey] = {};
            innerDateMap[dKey][item.user_Id.toString()] = {
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
      console.error("Hub Pipeline execution fault:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollCoreHubData();
  }, [selectedYear, loanRegistry.length]);

  // Sync mutations inside rows/drawers
  const handleCellSave = async (dateStr, empKey) => {
    if (!editingCell) return;
    const sanitizedValue = editValue.replace(/,/g, "").trim();
    const numericVal = sanitizedValue === "" ? 0 : parseFloat(sanitizedValue);
    setEditingCell(null);

    if (isNaN(numericVal)) return;

    setSyncingCell({ date: dateStr, empKey });
    const updates = [{ date: dateStr, user_Id: parseInt(empKey), amount: numericVal, type: activeTemplateLoan.dbType }];

    setLoanMatrices(prev => {
      const targetArr = [...(prev[auditLoanTab] || [])];
      let rowIdx = targetArr.findIndex(d => isInSamePeriod(d.date, dateStr));
      if (rowIdx === -1) {
        targetArr.push({ date: dateStr, values: { [empKey]: { amount: numericVal, status: 'paid' } } });
      } else {
        targetArr[rowIdx] = {
          ...targetArr[rowIdx],
          values: { ...targetArr[rowIdx].values, [empKey]: { amount: numericVal, status: 'paid' } }
        };
      }
      return { ...prev, [auditLoanTab]: targetArr.sort((a, b) => a.date.localeCompare(b.date)) };
    });

    try {
      const syncRoute = auditLoanTab === "maxicare_hmo" ? "/api/payroll/maxicare/sync" : "/api/payroll/loans/sync";
      await fetchWithAuth(syncRoute, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      setToast({ message: "Deduction entry synchronized successfully.", type: "success" });
    } catch (err) {
      fetchPayrollCoreHubData();
    } finally {
      setTimeout(() => setSyncingCell(null), 400);
    }
  };

  // Mass Updates Multi-form processor execution
  const handleExecuteBatchForm = async () => {
    if (batchForm.dates.length === 0 || !batchForm.amount || batchForm.selectedEmployees.length === 0) {
      setToast({ message: "Incomplete configuration metrics criteria selection parameters.", type: "error" });
      return;
    }
    const amt = parseFloat(batchForm.amount);
    if (isNaN(amt)) return;

    setLoading(true);
    const updates = [];
    batchForm.dates.forEach(d => {
      batchForm.selectedEmployees.forEach(uid => {
        updates.push({ date: d, user_Id: uid, amount: amt, type: activeTemplateLoan.dbType });
      });
    });

    try {
      const route = auditLoanTab === "maxicare_hmo" ? "/api/payroll/maxicare/sync" : "/api/payroll/loans/sync";
      const res = await fetchWithAuth(route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updates }) });
      if (res.ok) {
        setToast({ message: "Mass updates committed successfully across active rosters.", type: "success" });
        setShowBatchModal(false);
        setBatchForm({ dates: [], amount: "", selectedEmployees: [] });
        fetchPayrollCoreHubData();
      }
    } catch (err) {
      setToast({ message: "Failed batch runtime update run execution.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const triggerCSVTemplateDownload = () => {
    const headers = [activeTemplateLoan.templateId, ...employeeList.map(e => `${e.name} #${e.id}`)];
    const csvRows = [headers.join(",")];
    displayDates.forEach(d => csvRows.push(`${d},${employeeList.map(() => "").join(",")}`));
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTemplateLoan.id}_matrix_fy_${selectedYear}.csv`;
    link.click();
  };

  const handleCSVUploadProcessing = async () => {
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result.replace(/^\uFEFF/, '');
        const lines = text.split("\n").filter(l => l.trim() !== "");
        const headers = lines[0].split(",");
        if (headers[0]?.trim() !== activeTemplateLoan.templateId) {
          setToast({ message: "Template signature verification validation fault status conflict.", type: "error" });
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
            if (val > 0) updates.push({ date: rowDate, user_Id: map.user_Id, amount: val, type: activeTemplateLoan.dbType });
          });
        }

        const route = auditLoanTab === "maxicare_hmo" ? "/api/payroll/maxicare/sync" : "/api/payroll/loans/sync";
        const res = await fetchWithAuth(route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updates }) });
        if (res.ok) {
          setToast({ message: "Ingestion data stream processing sync completed.", type: "success" });
          setShowBatchModal(false);
          setFile(null);
          fetchPayrollCoreHubData();
        }
      } catch (err) {
        setToast({ message: "Parsing stream read execution exception.", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // Mathematical Sum Aggregations Maps
  const getEmployeeSingleLoanSum = (empKey, loanId) => {
    const matrix = loanMatrices[loanId] || [];
    return matrix.reduce((acc, currentCutoff) => {
      return acc + (currentCutoff.values[empKey]?.amount || 0);
    }, 0);
  };

  const getEmployeeCombinedTotalAllLoans = (empKey) => {
    return loanRegistry.reduce((acc, ch) => acc + getEmployeeSingleLoanSum(empKey, ch.id), 0);
  };

  const globalSummaryMetrics = useMemo(() => {
    let ytdTotal = 0;
    const distinctActiveEmpKeys = new Set();

    Object.keys(loanMatrices).forEach(loanId => {
      const arr = loanMatrices[loanId] || [];
      arr.forEach(cutoff => {
        Object.keys(cutoff.values).forEach(empKey => {
          const amt = cutoff.values[empKey]?.amount || 0;
          if (amt > 0) {
            ytdTotal += amt;
            distinctActiveEmpKeys.add(empKey);
          }
        });
      });
    });

    return {
      activeAccounts: distinctActiveEmpKeys.size,
      remittedYTD: ytdTotal
    };
  }, [loanMatrices]);

  // Client-Side Live Filtration
  const searchedEmployees = useMemo(() => {
    return employeeList.filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employeeList, searchTerm]);

  // Correct implementation of global system timeline range checking context maps
  const getCycleRange = (year = selectedYear) => {
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

  const cycle = getCycleRange();

  // FIX: Aggregate timestamps across ALL matrices to generate standard display dates safely
  const displayDates = useMemo(() => {
    const baseSet = new Set([...expectedDates]);
    
    Object.values(loanMatrices).forEach(matrixArray => {
      if (Array.isArray(matrixArray)) {
        matrixArray.forEach(d => baseSet.add(d.date));
      }
    });

    if (auditLoanTab === "maxicare_hmo" && cycle) {
      const baseDate = new Date(maxicareConfig.cycleStartDate);
      let curr = new Date(selectedYear, baseDate.getUTCMonth(), baseDate.getUTCDate() <= 15 ? 15 : new Date(selectedYear, baseDate.getUTCMonth() + 1, 0).getDate());
      while (curr <= cycle.deductionEnd) {
        baseSet.add(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`);
        curr = curr.getDate() === 15 
          ? new Date(curr.getFullYear(), curr.getMonth() + 1, 0)
          : new Date(curr.getFullYear(), curr.getMonth() + 1, 15);
      }
    }
    return [...baseSet].filter(d => {
      if (excludedDates.includes(d)) return false;
      const dDate = new Date(d);
      if (auditLoanTab === "maxicare_hmo" && cycle) {
        return dDate >= cycle.start && dDate <= cycle.deductionEnd;
      }
      return dDate.getFullYear() === selectedYear;
    }).sort();
  }, [expectedDates, loanMatrices, auditLoanTab, cycle, maxicareConfig.cycleStartDate, selectedYear, excludedDates]);

  const currentCutoffDate = systemToday ? expectedDates.find(d => d >= formatDateLocal(systemToday)) : null;
  const formatValuePeso = (v) => `₱${parseFloat(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50/60">
      {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "success" })} />}

      {/* --- ADD NEW INSTITUTION PROVIDER OVERLAY --- */}
      <Dialog open={showNewChannelModal} onOpenChange={setShowNewChannelModal}>
        <DialogContent className="max-w-md bg-white p-6 rounded-xl border-0 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-brand-primary flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" /> Register Partner Company
            </DialogTitle>
            <DialogDescription>Instantiate a dynamic claim/loan tracking infrastructure tab context for your employee dashboard views.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-1 text-left">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Partner Title Name</label>
              <Input name="label" placeholder="e.g., Eastwest Personal Loan, BDO Claims" value={newChannelForm.label} onChange={handleConfigChange} />
            </div>
            <div className="space-y-1 text-left">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Categorization Group</label>
              <Select value={newChannelForm.category} onValueChange={(v) => setNewChannelForm(prev => ({ ...prev, category: v }))}>
                <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Internal">Internal Organization Ledger</SelectItem>
                  <SelectItem value="External Partner">External Bank Partner Channel</SelectItem>
                  <SelectItem value="Government">Statutory Government Bureau</SelectItem>
                  <SelectItem value="Insurance">Corporate Medical Provider</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateNewChannel} className="w-full bg-brand-primary hover:bg-[#190d30] text-white font-bold h-10 shadow mt-2">Initialize Allocation Channel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- REUSABLE STREAM BATCH ADJUSTMENTS --- */}
      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent className="max-w-2xl bg-white p-6 rounded-xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-brand-primary">Batch Ledger Distribution Loader</DialogTitle>
          </DialogHeader>
          
          <div className="mb-4 text-left">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Allocation Channel Stream Context</label>
            <Select value={auditLoanTab} onValueChange={setAuditLoanTab}>
              <SelectTrigger className="bg-white border-slate-200 font-bold text-brand-primary mt-1 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {loanRegistry.map(ch => <SelectItem key={ch.id} value={ch.id}>{ch.label} ({ch.category})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="form" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="form" className="font-bold">Manual Distribution Entry</TabsTrigger>
              <TabsTrigger value="csv" className="font-bold">CSV Document Stream</TabsTrigger>
            </TabsList>
            
            <TabsContent value="form" className="space-y-6 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Target Cut-offs</label>
                  <div className="border border-slate-200 rounded-lg p-2.5 max-h-[140px] overflow-y-auto bg-slate-50 space-y-1.5 custom-scrollbar text-xs">
                    {displayDates.map(d => (
                      <label key={d} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-white rounded transition-colors">
                        <input type="checkbox" checked={batchForm.dates.includes(d)} onChange={() => setBatchForm(p => ({ ...p, dates: p.dates.includes(d) ? p.dates.filter(x => x !== d) : [...p.dates, d] }))} />
                        <span className="font-mono text-slate-700">{d}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Deduction Value (₱)</label>
                  <Input type="number" placeholder="0.00" value={batchForm.amount} onChange={(e) => setBatchForm(p => ({ ...p, amount: e.target.value }))} className="h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Roster Selections</label>
                <div className="border border-slate-200 rounded-lg p-3 max-h-[180px] overflow-y-auto bg-slate-50 text-xs grid grid-cols-1 md:grid-cols-2 gap-2 custom-scrollbar">
                  {employeeList.map(e => (
                    <label key={e.user_Id} className="flex items-center gap-2.5 cursor-pointer p-1.5 hover:bg-white rounded transition-colors">
                      <input type="checkbox" checked={batchForm.selectedEmployees.includes(e.user_Id)} onChange={() => setBatchForm(p => ({ ...p, selectedEmployees: p.selectedEmployees.includes(e.user_Id) ? p.selectedEmployees.filter(x => x !== e.user_Id) : [...p.selectedEmployees, e.user_Id] }))} />
                      <span className="font-medium text-slate-700">{e.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={handleExecuteBatchForm} className="w-full bg-brand-primary text-white hover:bg-[#190d30] h-10 font-bold">Commit Mass Update Distribution</Button>
            </TabsContent>
            
            <TabsContent value="csv" className="space-y-6">
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-lg text-center">
                <p className="text-xs text-blue-800 mb-3 font-medium">Export the system dynamic spreadsheet template configured for the validation schemas parser engine.</p>
                <Button variant="outline" size="sm" onClick={triggerCSVTemplateDownload} className="border-blue-600 text-blue-600 hover:bg-blue-100">
                  <DownloadIcon className="mr-2 h-4 w-4" /> Download Template Structure
                </Button>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 hover:border-brand-primary transition-colors relative cursor-pointer">
                  <Input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <CloudUploadIcon className="text-slate-400 h-10 w-10 mb-2" />
                  <p className="text-xs font-semibold text-slate-500">{file ? file.name : "Click or drag your validation .csv structure sheet file here"}</p>
                </div>
                <Button onClick={handleCSVUploadProcessing} disabled={!file} className="w-full bg-brand-primary text-white h-10 font-bold">Execute Document Processing Parse</Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Sidebar>
        <div className="p-4 md:p-6 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Top Panel Brand & Dynamic Controls Container */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-5">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-brand-primary tracking-tight">Loan Management Hub</h1>
              <p className="text-sm text-slate-500 mt-1">Unified lifecycle tracking, corporate partner claims entries, and employee deduction streams dashboard frames.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto justify-end">
              <Input
                placeholder="Search employee or ID code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-[240px] h-9 bg-white text-slate-700 border-slate-200 focus-visible:ring-brand-primary shadow-sm"
              />
              <Button onClick={() => setShowNewChannelModal(true)} className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary-hover text-white font-bold h-9 shadow-sm transition-all">
                + Create Custom Loan
              </Button>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-full sm:w-[130px] h-9 bg-white font-bold text-brand-primary border-slate-200 shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 8 }, (_, i) => 2023 + i).map(y => (
                    <SelectItem key={y} value={y.toString()}>{y} Ledger</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Unified Global Operational Overview Summary Widget Grid Deck */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border border-slate-100 shadow-sm border-l-4 border-l-brand-primary">
              <CardContent className="p-4 flex items-center gap-4 text-left">
                <div className="p-3 rounded-xl bg-slate-50 text-brand-primary"><GroupIcon /></div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total Active Borrowers</span>
                  <p className="text-2xl font-black text-slate-800 mt-0.5">{globalSummaryMetrics.activeAccounts} Accounts</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border border-slate-100 shadow-sm border-l-4 border-l-accent-green">
              <CardContent className="p-4 flex items-center gap-4 text-left">
                <div className="p-3 rounded-xl bg-slate-50 text-accent-green"><TrendingUp /></div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total Collected ({selectedYear})</span>
                  <p className="text-2xl font-black text-slate-800 mt-0.5">{formatValuePeso(globalSummaryMetrics.remittedYTD)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border border-slate-100 shadow-sm border-l-4 border-l-accent-gold">
              <CardContent className="p-4 flex items-center gap-4 h-full text-left">
                <div className="p-3 rounded-xl bg-slate-50 text-accent-gold"><CircleDollarSign /></div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Dynamic Ecosystem Layout</span>
                  <p className="text-lg font-bold text-slate-800 tracking-tight mt-0.5 uppercase">Employee-First Track</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls Presentation Action Header Row */}
          <div className="flex justify-between items-center pt-2">
            <div className="text-left">
              <h3 className="text-lg font-bold text-brand-primary tracking-tight">Active Employee Loan Roster</h3>
              <p className="text-xs text-slate-400">Scan parameters or select specific items to unlock detailed history matrix tables.</p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* --- PRESENTATION SWITCHER MODE CONTROLLER --- */}
              <div className="bg-slate-200/60 p-1 rounded-lg flex gap-1 border border-slate-300/10 shadow-inner">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === "cards" ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-brand-primary"}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Cards Grid
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === "table" ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-brand-primary"}`}
                >
                  <Table2 className="h-3.5 w-3.5" /> Master Spreadsheet
                </button>
              </div>

              <Button size="sm" variant="outline" onClick={() => setShowBatchModal(true)} className="border-brand-primary text-brand-primary h-9 font-semibold">
                <GroupAddOutlinedIcon className="h-4 w-4 mr-1"/> Mass Upload Action
              </Button>
            </div>
          </div>

          {/* --- RENDERING SYSTEM COMPONENT VIEWPORTS VIEWS CONTENT --- */}
          {loading ? (
            <div className="py-24 text-center text-slate-400 italic font-medium">Executing system pipeline operational components parsing runtime arrays...</div>
          ) : searchedEmployees.length === 0 ? (
            <div className="bg-white border border-dashed rounded-xl py-12 text-center text-slate-400 font-medium">No active personnel tracks matching search criteria.</div>
          ) : viewMode === "cards" ? (
            
            /* =========================================================================
               APPROACH 1: DYNAMIC HIGH-FIDELITY PROFILE CARD GRID INTERFACE (DEFAULT)
               ========================================================================= */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {searchedEmployees.map(emp => {
                const combinedTotalPaid = getEmployeeCombinedTotalAllLoans(emp.key);

                return (
                  <Card key={emp.key} className="border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
                    <CardHeader className="bg-slate-50/50 pb-3.5 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3 truncate text-left">
                        <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary shrink-0">
                          <AccountCircleIcon />
                        </div>
                        <div className="truncate">
                          <h4 className="text-sm font-bold text-brand-primary truncate">{emp.name}</h4>
                          <span className="text-xs font-mono text-slate-400 block mt-0.5">{formatUserId(emp.user_Id)}</span>
                        </div>
                      </div>

                      {/* --- SHEET DRAWER TRIGGER PER EMPLOYEE FOR MULTI-MATRIX CONTROL --- */}
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/5">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </SheetTrigger>
                        <SheetContent className="w-full sm:max-w-3xl bg-white overflow-y-auto custom-scrollbar p-6">
                          <SheetHeader className="pb-4 border-b border-slate-100 text-left">
                            <SheetTitle className="text-xl font-black text-brand-primary">{emp.name}</SheetTitle>
                            <SheetDescription className="font-mono text-xs text-slate-400">
                              System ID: {formatUserId(emp.user_Id)} | Matrix Reference Target Calendar Year: {selectedYear}
                            </SheetDescription>
                          </SheetHeader>

                          {/* Individual liability context cards internal block layout */}
                          <div className="my-6 p-4 rounded-xl border border-indigo-100 bg-indigo-50/20 text-left">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Consolidated Annual Liabilities Collected</span>
                            <span className="text-2xl font-black text-brand-primary block mt-1">{formatValuePeso(getEmployeeCombinedTotalAllLoans(emp.key))}</span>
                          </div>

                          {/* Sub-channel ledger tab controls layout nested inside person profile */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Allocation Register</h4>
                              <div className="flex items-center gap-2">
                                <Button size="xs" variant={isEditingTable ? "default" : "outline"} onClick={() => setIsEditingTable(!isEditingTable)} className={isEditingTable ? "bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-[11px]" : "border-brand-primary text-brand-primary h-7 text-[11px]"}>
                                  {isEditingTable ? "Lock Cells" : "Unlock Cells"}
                                </Button>
                              </div>
                            </div>

                            <div className="bg-slate-100 p-1 rounded-lg overflow-x-auto custom-scrollbar flex gap-1">
                              {loanRegistry.map(ch => (
                                <button
                                  key={ch.id}
                                  onClick={() => { setAuditLoanTab(ch.id); }}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-all ${auditLoanTab === ch.id ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
                                >
                                  {ch.label}
                                </button>
                              ))}
                            </div>

                            {/* Months-Cutoff Data Ledger Matrix for Employee Selection */}
                            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-brand-primary text-white font-bold">
                                    <th className="p-3">Payroll Cutoff Interval Point</th>
                                    <th className="p-3 text-center">Remitted Status</th>
                                    <th className="p-3 text-right pr-4">Value Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {displayDates.map(dateStr => {
                                    const targetMatrix = loanMatrices[auditLoanTab] || [];
                                    const rowRecord = targetMatrix.find(d => isInSamePeriod(d.date, dateStr));
                                    let cellAmount = rowRecord?.values[emp.key]?.amount || 0;
                                    let status = rowRecord?.values[emp.key]?.status || 'unpaid';
                                    let isProjection = false;

                                    if (auditLoanTab === "maxicare_hmo" && cellAmount === 0 && status !== 'removed' && dateStr >= (systemToday ? formatDateLocal(systemToday) : "") && emp.healthCard_Amnt > 0) {
                                      cellAmount = hmoCutoffDeduction;
                                      status = 'estimated';
                                      isProjection = true;
                                    }

                                    const isCellEditing = editingCell?.date === dateStr && editingCell?.empKey === emp.key;
                                    const isCellSyncing = syncingCell?.date === dateStr && syncingCell?.empKey === emp.key;

                                    return (
                                      <tr key={dateStr} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-semibold text-slate-700">
                                          {new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          {dateStr === currentCutoffDate && <span className="bg-yellow-400 text-brand-primary text-[8px] font-black px-1.5 py-0.2 rounded ml-2">CURRENT</span>}
                                        </td>
                                        <td className="p-3 text-center">
                                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${status === 'paid' ? 'bg-green-50 text-green-700 border border-green-200' : isProjection ? 'bg-slate-100 text-slate-400 italic' : 'bg-slate-50 text-slate-300'}`}>
                                            {status}
                                          </span>
                                        </td>
                                        <td 
                                          onDoubleClick={() => isAdmin && isEditingTable && (setEditingCell({ date: dateStr, empKey: emp.key }) || setEditValue(cellAmount ? cellAmount.toString() : ""))}
                                          className={`p-3 text-right pr-4 font-mono font-bold cursor-pointer transition-all ${isCellEditing ? 'p-1 bg-white' : isCellSyncing ? 'bg-yellow-50 animate-pulse' : cellAmount > 0 ? 'text-green-700' : 'text-slate-200'}`}
                                        >
                                          {isCellEditing ? (
                                            <input
                                              type="text"
                                              value={editValue}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              onBlur={() => handleCellSave(dateStr, emp.key)}
                                              onKeyDown={(e) => e.key === 'Enter' && handleCellSave(dateStr, emp.key)}
                                              autoFocus
                                              className="w-24 h-7 text-right bg-white border-2 border-brand-primary outline-none font-bold text-slate-800 pr-1 text-xs"
                                            />
                                          ) : isCellSyncing ? (
                                            <span className="text-[9px] font-bold text-yellow-600">SYNC...</span>
                                          ) : (
                                            cellAmount > 0 ? cellAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : "—"
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-800">
                                  <tr>
                                    <td className="p-3">ACCOUNT CHANNEL RUNNING SUM</td>
                                    <td></td>
                                    <td className="p-3 text-right pr-4 font-mono text-slate-900">{formatValuePeso(getEmployeeSingleLoanSum(emp.key, auditLoanTab))}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </SheetContent>
                      </Sheet>
                    </CardHeader>

                    <CardContent className="p-5 space-y-4 flex-1 text-left">
                      {/* Nested micro loan rows summary block inside card frame container context */}
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Active Ledger Distributions Accounts</span>
                      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                        {loanRegistry.map(ch => {
                          const amtPaid = getEmployeeSingleLoanSum(emp.key, ch.id);
                          if (amtPaid === 0) return null;
                          return (
                            <div key={ch.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" /> {ch.label}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-800">{amtPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                            </div>
                          );
                        })}
                        {combinedTotalPaid === 0 && (
                          <span className="text-xs italic text-slate-300 block py-2">No active deduction allocations for this selection interval range parameters.</span>
                        )}
                      </div>

                      {/* Cumulative footer segment */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-brand-primary">Aggregated Payout Remitted</span>
                        <span className="text-base font-black text-emerald-700">{formatValuePeso(combinedTotalPaid)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            
            /* =========================================================================
               APPROACH 2: TRANSFORMABLE SPREADSHEET LEDGER DATA GRID MATRIX VIEW
               ========================================================================= */
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="relative max-h-[62vh] overflow-auto w-full custom-scrollbar">
                <table className="w-full min-w-max border-collapse text-xs text-left">
                  <thead>
                    <tr className="bg-brand-primary text-white sticky top-0 z-30 shadow-sm font-bold text-center">
                      <th className="sticky left-0 bg-[#1e1136] text-yellow-400 p-3 text-left shadow-[2px_0_5px_rgba(0,0,0,0.1)] min-w-[200px]">
                        EMPLOYEE NAME ROSTER
                      </th>
                      {loanRegistry.map(ch => (
                        <th key={ch.id} className="p-3 border-x border-slate-700 min-w-[130px]">
                          <div className="flex flex-col items-center">
                            <span>{ch.label}</span>
                            <span className="text-[9px] text-white/50 font-mono tracking-wider mt-0.5">{ch.category}</span>
                          </div>
                        </th>
                      ))}
                      <th className="sticky right-0 bg-[#1e1136] text-yellow-400 p-3 shadow-[-2px_0_5px_rgba(0,0,0,0.1)] min-w-[140px]">
                        COMBINED BALANCES
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchedEmployees.map(emp => {
                      const finalAccumulationTotal = getEmployeeCombinedTotalAllLoans(emp.key);

                      return (
                        <tr key={emp.key} className="hover:bg-slate-50 border-b border-slate-100 transition-colors text-center">
                          {/* Left Sticky Identity Anchor */}
                          <td className="sticky left-0 bg-white font-bold p-3 text-brand-primary text-left border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">{emp.name}</span>
                              <span className="text-xs text-slate-400 font-mono mt-0.5">{formatUserId(emp.user_Id)}</span>
                            </div>
                          </td>

                          {/* Render horizontal channel summation points cells matching keys */}
                          {loanRegistry.map(ch => {
                            const subtotalVal = getEmployeeSingleLoanSum(emp.key, ch.id);
                            return (
                              <td key={ch.id} className={`p-3 font-mono font-semibold text-center border-r border-slate-100 ${subtotalVal > 0 ? "text-green-700 font-bold bg-green-50/5" : "text-slate-300"}`}>
                                {subtotalVal > 0 ? subtotalVal.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : "—"}
                              </td>
                            );
                          })}

                          {/* Right Combined Calculations Sum total column cell */}
                          <td className="sticky right-0 bg-slate-50 font-black text-center p-3 text-brand-primary border-l border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.02)] font-mono text-xs">
                            {finalAccumulationTotal > 0 ? finalAccumulationTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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

export default LoanManagementHub;