import React, { useState, useEffect } from "react";
import Sidebar from "../../../components/Sidebar";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import FilterListIcon from '@mui/icons-material/FilterList';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import GroupIcon from '@mui/icons-material/Group';
import EventIcon from '@mui/icons-material/Event';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import Toast from "../../../components/toast/Toast";
import { formatDateLocal, isInSamePeriod } from "../../../utils/formatTime";
import { Link } from "react-router-dom";
import { HistoryIcon } from "lucide-react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";


// shadcn/ui components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GovLoans = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1 || userData?.user_RoleId === 4;

  const [activeTab, setActiveTab] = useState("summary"); 
  const [activeMainTab, setActiveMainTab] = useState("summary"); 
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState(null);
  
  // Batch Upload States
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({
    dates: [],
    amount: "",
    selectedEmployees: []
  });

  const toggleDateSelection = (dateStr) => {
    setBatchForm(prev => {
      const isSelected = prev.dates.includes(dateStr);
      return {
        ...prev,
        dates: isSelected 
          ? prev.dates.filter(d => d !== dateStr)
          : [...prev.dates, dateStr]
      };
    });
  };

  const selectAllDates = () => {
    setBatchForm(prev => ({
      ...prev,
      dates: [...expectedDates]
    }));
  };

  const deselectAllDates = () => {
    setBatchForm(prev => ({
      ...prev,
      dates: []
    }));
  };
  
  const [employeeList, setEmployeeList] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [allData, setAllData] = useState({}); 
  const [activeLoans, setActiveLoans] = useState([]);
  
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [syncingCell, setSyncingCell] = useState(null);

  const govTypes = [
    { id: "sss_salary", label: "SSS Salary Loan", dbType: "SSS" },
    { id: "sss_calamity", label: "SSS Calamity Loan", dbType: "SSS Calamity" },
    { id: "sss_emergency", label: "SSS Emergency Loan", dbType: "SSS Emergency" },
    { id: "sss_conso", label: "SSS Conso Loan", dbType: "SSS Conso Loan" },
    { id: "pagibig_mpl", label: "Pag-IBIG MPL", dbType: "Pag-IBIG MPL" },
    { id: "pagibig_calamity", label: "Pag-IBIG Calamity", dbType: "Pag-IBIG Calamity" }
  ];

  const fetchCutoffDates = () => {
    const dates = [];
    const year = selectedYear;
    for (let m = 0; m < 12; m++) {
      const d15 = new Date(year, m, 15);
      dates.push(`${d15.getFullYear()}-${String(d15.getMonth() + 1).padStart(2, '0')}-15`);
      const last = new Date(year, m + 1, 0);
      dates.push(`${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`);
    }
    setExpectedDates(dates);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      fetchCutoffDates();
      
      const empRes = await fetchWithAuth("/api/users/all");
      const employees = await empRes.json();
      const activeEmps = employees.filter(e => e.dailyRate > 0).map(emp => ({
        user_Id: emp.user_Id,
        name: `${emp.user_LastName}, ${emp.user_FirstName}`,
        id: `MACJ-${String(emp.user_Id).padStart(3, "0")}`,
        key: emp.user_Id.toString(),
      }));
      setEmployeeList(activeEmps);

      const activeLoansRes = await fetchWithAuth("/api/payroll/loans/active");
      if (activeLoansRes.ok) {
        setActiveLoans(await activeLoansRes.json());
      }

      const combinedData = {};
      for (const type of govTypes) {
        const historyRes = await fetchWithAuth(`/api/payroll/loans/history?type=${type.dbType}`);
        const history = await historyRes.json();
        
        if (Array.isArray(history)) {
          const dateMap = {};
          history.forEach(item => {
            const dKey = formatDateLocal(item.date);
            if (!dateMap[dKey]) dateMap[dKey] = {};
            dateMap[dKey][item.user_Id.toString()] = {
              amount: parseFloat(item.amount),
              status: 'paid',
              payrollId: item.payrollId
            };
          });
          combinedData[type.id] = Object.keys(dateMap).sort().map(date => ({
            date,
            values: dateMap[date]
          }));
        }
      }
      setAllData(combinedData);
    } catch (err) {
      console.error("Error fetching governmental loans data", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  // Batch Form Functions
  const handleBatchSave = async () => {
    if (batchForm.dates.length === 0 || !batchForm.amount || batchForm.selectedEmployees.length === 0) {
      setToast({ message: "Please select at least one period, one employee, and an amount", type: "error" });
      return;
    }

    const amount = parseFloat(batchForm.amount);
    if (isNaN(amount)) {
      setToast({ message: "Invalid amount", type: "error" });
      return;
    }

    const currentType = govTypes.find(t => t.id === activeTab);
    if (!currentType) return;

    setLoading(true);
    const updates = [];

    batchForm.dates.forEach(dStr => {
      batchForm.selectedEmployees.forEach(empId => {
        updates.push({ date: dStr, user_Id: empId, amount: amount, type: currentType.dbType });
      });
    });

    try {
      const res = await fetchWithAuth("/api/payroll/loans/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });

      if (res.ok) {
        setToast({ message: `Successfully updated ${updates.length} records for ${currentType.label}!`, type: "success" });
        setShowBatchModal(false);
        setBatchForm({ dates: [], amount: "", selectedEmployees: [] });
        fetchData();
      } else {
        const errData = await res.json();
        setToast({ message: "Batch update failed: " + (errData.error || "Unknown error"), type: "error" });
        fetchData();
      }
    } catch (err) {
      setToast({ message: "Failed to sync batch update", type: "error" });
      fetchData();
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployeeSelection = (userId) => {
    setBatchForm(prev => {
      const isSelected = prev.selectedEmployees.includes(userId);
      return {
        ...prev,
        selectedEmployees: isSelected 
          ? prev.selectedEmployees.filter(id => id !== userId)
          : [...prev.selectedEmployees, userId]
      };
    });
  };

  const selectAllEmployees = () => {
    setBatchForm(prev => ({
      ...prev,
      selectedEmployees: employeeList.map(e => e.user_Id)
    }));
  };

  const deselectAllEmployees = () => {
    setBatchForm(prev => ({
      ...prev,
      selectedEmployees: []
    }));
  };

  const handleHeaderChange = (index, newDate) => {
    const updated = [...expectedDates];
    updated[index] = newDate;
    setExpectedDates(updated);
  };

  const handleCellDoubleClick = (date, empKey, currentVal) => {
    if (!isAdmin || activeTab === "summary") return;
    setEditingCell({ date, empKey });
    setEditValue(currentVal > 0 ? currentVal.toString() : "");
  };

  const handleCellSave = async (date, empKey) => {
    if (!editingCell) return;
    
    const sanitizedValue = editValue.replace(/,/g, "").trim();
    const val = sanitizedValue === "" ? 0 : parseFloat(sanitizedValue);
    
    setEditingCell(null);

    if (isNaN(val)) {
      setToast({ message: "Invalid amount entered", type: "error" });
      return;
    }

    const currentDbType = govTypes.find(t => t.id === activeTab)?.dbType;
    if (!currentDbType) return;

    setSyncingCell({ date, empKey });
    const updates = [{ date, user_Id: parseInt(empKey), amount: val, type: currentDbType }];

    setAllData(prev => {
      const typeData = [...(prev[activeTab] || [])];
      let recordIndex = typeData.findIndex(d => isInSamePeriod(d.date, date));
      if (recordIndex === -1) {
        typeData.push({ date, values: { [empKey]: { amount: val, status: 'paid' } } });
      } else {
        const updatedRecord = {
          ...typeData[recordIndex],
          values: { ...typeData[recordIndex].values, [empKey]: { amount: val, status: 'paid' } }
        };
        typeData[recordIndex] = updatedRecord;
      }
      return { ...prev, [activeTab]: typeData.sort((a, b) => a.date.localeCompare(b.date)) };
    });

    try {
      const res = await fetchWithAuth("/api/payroll/loans/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      if (res.ok) {
        setToast({ message: `${currentDbType} updated!`, type: "success" });
      } else {
        const errData = await res.json();
        setToast({ message: "Sync failed: " + (errData.error || "Unknown error"), type: "error" });
        fetchData();
      }
    } catch (err) {
      setToast({ message: "Sync failed", type: "error" });
      fetchData();
    } finally {
      setTimeout(() => setSyncingCell(null), 500);
    }
  };

  const downloadTemplate = () => {
    const templateId = `GOV_LOAN_${activeTab.toUpperCase()}_TEMPLATE`;
    const headers = [templateId, ...employeeList.map(emp => `${emp.name} #${emp.id}`)];
    const headerLine = headers.join(",");
    const rows = expectedDates.map(date => {
      const emptyValues = employeeList.map(() => "").join(",");
      return `${date},${emptyValues}`;
    });
    const csvContent = "\uFEFF" + [headerLine, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `gov_loan_${activeTab}_matrix_${selectedYear}.csv`;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setToast({ message: "Please select a file first", type: "error" });
      return;
    }
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const rawText = e.target.result;
        const text = rawText.replace(/^\uFEFF/, '');
        const lines = text.split("\n").filter(line => line.trim() !== "");
        if (lines.length < 2) throw new Error("File is empty or missing data.");

        const headers = lines[0].split(",");
        const templateId = headers[0]?.trim();
        const expectedId = `GOV_LOAN_${activeTab.toUpperCase()}_TEMPLATE`;

        if (templateId !== expectedId) {
          setToast({ 
            message: `Invalid template. You are trying to upload a file for "${templateId.replace(/_/g, ' ')}" into the "${activeTab.replace(/_/g, ' ')}" section. Please download the latest template.`, 
            type: "error" 
          });
          setLoading(false);
          return;
        }

        const currentType = govTypes.find(t => t.id === activeTab);
        if (!currentType) {
          setToast({ message: "Invalid tab selected", type: "error" });
          setLoading(false);
          return;
        }

        const empMappings = []; 

        for (let i = 1; i < headers.length; i++) {
          const header = headers[i];
          const match = header.match(/#MACJ-(\d+)/i);
          if (match) {
            empMappings.push({ colIndex: i, user_Id: parseInt(match[1]) });
          }
        }

        const updates = [];
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(",");
          const date = columns[0]?.trim();
          if (!date) continue;

          empMappings.forEach(mapping => {
            const amount = parseFloat(columns[mapping.colIndex]?.trim() || 0);
            const isValidDate = !isNaN(new Date(date).getTime());
            
            if (amount > 0 && isValidDate) {
              updates.push({
                date,
                user_Id: mapping.user_Id,
                amount,
                type: currentType.dbType
              });
            }
          });
        }

        if (updates.length === 0) {
          setToast({ message: "No non-zero amounts found in CSV", type: "error" });
          setLoading(false);
          return;
        }

        const res = await fetchWithAuth("/api/payroll/loans/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates })
        });

        if (res.ok) {
          setToast({ message: `Successfully synced ${updates.length} records to ${currentType.label}!`, type: "success" });
          setShowBatchModal(false);
          fetchData();
          setFile(null);
        } else {
          const err = await res.json();
          setToast({ message: "Error syncing: " + (err.error || "Unknown error"), type: "error" });
        }
      } catch (err) {
        setToast({ message: "Failed to parse CSV", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const currentCutoffDate = systemToday 
    ? expectedDates.find(d => d >= formatDateLocal(systemToday))
    : null;

  const currentCutoffIndex = expectedDates.indexOf(currentCutoffDate);
  const summaryDates = expectedDates.slice(
    Math.max(0, currentCutoffIndex - 2),
    Math.min(expectedDates.length, currentCutoffIndex + 2)
  );

  const getSummaryStats = (typeId) => {
    const typeData = allData[typeId] || [];
    const subscribers = new Set();
    let totalPaid = 0;

    typeData.forEach(item => {
      const recordYear = new Date(item.date).getFullYear();
      
      if (recordYear === selectedYear) {
        Object.keys(item.values).forEach(empKey => {
          const record = item.values[empKey];
          const amt = record.amount;
          if (amt > 0) {
            subscribers.add(empKey);
            // Only count towards totalPaid if it has a payrollId (meaning it was deducted)
            if (record.payrollId) totalPaid += amt;
          }
        });
      }
    });

    return {
      subscribers: subscribers.size,
      totalPaid: totalPaid
    };
  };

  const activeStats = activeTab === "summary" ? { subscribers: 0, totalPaid: 0 } : getSummaryStats(activeTab);
  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const currentTypeName = govTypes.find(t => t.id === activeTab)?.label || "";
  const typeDataForStats = activeTab !== "summary" ? (allData[activeTab] || []) : [];
  const totalAllTime = typeDataForStats.reduce((acc, item) => {
    // Only count loans that have a payrollId
    const deductedInThisPeriod = Object.values(item.values).reduce((sum, v) => sum + (v.payrollId ? (v.amount || 0) : 0), 0);
    return acc + deductedInThisPeriod;
  }, 0);

  const renderSummaryTable = (typeObj) => {
    const typeData = allData[typeObj.id] || [];
    return (
      <Card key={typeObj.id} className="shadow-sm border-0 bg-white pb-0 pt-4">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-50">
          <CardTitle className="text-base text-[#2A174E]">{typeObj.label} Summary</CardTitle>
          <Button variant="link" onClick={() => {
            if (typeObj.id.startsWith("sss")) setActiveMainTab("sss");
            else if (typeObj.id.startsWith("pagibig")) setActiveMainTab("pagibig");
            setActiveTab(typeObj.id);
          }} className="text-blue-500 font-bold uppercase text-[11px] hover:underline">View Details</Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative max-h-[400px] overflow-auto w-full bg-white rounded-b-xl custom-scrollbar">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead className="sticky top-0 z-[50] shadow-sm bg-[#1e1136]">
                <tr>
                  <th className="sticky left-0 top-0 z-[60] bg-[#1e1136] text-white font-bold text-left min-w-[150px] p-3 border-b border-r border-[#2A174E] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                    Employee Name
                  </th>
                  {summaryDates.map(d => {
                    const dateObj = new Date(d);
                    const isCurrent = d === currentCutoffDate;
                    return (
                      <th key={d} className={`sticky top-0 z-[50] p-3 text-center align-middle font-bold border-b border-[#2A174E] ${isCurrent ? "bg-[#2A174E] text-yellow-400" : "bg-[#1e1136] text-slate-300"}`}>
                        <div className="flex flex-col relative pb-3">
                          {dateObj.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                          {isCurrent && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] bg-yellow-400 text-[#2A174E] px-1 rounded">CURR</span>}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {employeeList.map(emp => {
                  const totalRowDeducted = summaryDates.reduce((acc, d) => {
                    const record = typeData.find(item => item.date === d);
                    const val = record?.values[emp.key];
                    return acc + (val?.payrollId ? (val.amount || 0) : 0);
                  }, 0);

                  const hasAnyValue = summaryDates.some(d => (typeData.find(item => item.date === d)?.values[emp.key]?.amount || 0) > 0);

                  if (!hasAnyValue && activeTab === "summary") return null;

                  return (
                    <tr key={emp.user_Id} className="hover:bg-slate-50">
                      <td className="sticky left-0 z-[40] bg-white border-r border-b border-slate-100 p-3 align-middle font-semibold text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)]">
                        {emp.name}
                      </td>
                      {summaryDates.map(d => {
                        const record = typeData.find(item => item.date === d);
                        const val = record?.values[emp.key];
                        const amount = val?.amount || 0;
                        const isDeducted = val?.payrollId != null;
                        const isCurrent = d === currentCutoffDate;
                        return (
                          <td key={d} className={`p-3 text-center align-middle font-mono text-[12px] border-r border-b border-slate-100 ${amount > 0 ? (isDeducted ? 'text-green-800 font-bold' : 'text-blue-600 font-bold') : 'text-slate-300'} ${isCurrent ? "bg-blue-50/30" : ""}`}>
                            <div className="flex flex-col items-center">
                              <span>{amount.toFixed(2)}</span>
                              {isDeducted && <span className="text-[7px] text-green-700 font-black uppercase tracking-tighter">Deducted</span>}
                              {!isDeducted && amount > 0 && <span className="text-[7px] text-blue-700 font-black uppercase tracking-tighter">Ledger</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      
      {/* Batch Upload Modal */}
      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent className="max-w-2xl bg-white p-6 rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#2A174E]">Batch Details Upload ({currentTypeName})</DialogTitle>
            <DialogDescription>
              Select a method to upload multiple employee loan repayment records at once.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="form" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="form">Manual Entry Form</TabsTrigger>
              <TabsTrigger value="csv">CSV File Upload</TabsTrigger>
            </TabsList>

            <TabsContent value="form" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Target Month / Period</label>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="xs" onClick={selectAllDates} className="text-[10px] h-6 px-2 text-blue-600">All</Button>
                      <Button variant="ghost" size="xs" onClick={deselectAllDates} className="text-[10px] h-6 px-2 text-slate-400">Clear</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50 custom-scrollbar">
                    {expectedDates.map(dStr => {
                      const isSelected = batchForm.dates.includes(dStr);
                      const dObj = new Date(dStr);
                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => toggleDateSelection(dStr)}
                          className={`text-[11px] py-2 px-3 rounded-lg border transition-all text-left flex flex-col ${
                            isSelected 
                              ? "bg-[#2A174E] border-[#2A174E] text-white shadow-md font-bold" 
                              : "bg-white border-slate-200 text-slate-600 hover:border-[#2A174E] hover:text-[#2A174E]"
                          }`}
                        >
                          <span className={isSelected ? "text-yellow-400" : "text-slate-400"}>
                            {dObj.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
                          </span>
                          <span>{dObj.toLocaleDateString('en-PH', { day: 'numeric', month: 'short' })}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Amount (₱)</label>
                  <Input 
                    type="number" 
                    placeholder="0.00"
                    value={batchForm.amount}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Select Employees</label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="xs" onClick={selectAllEmployees} className="text-[10px] h-6 px-2 text-blue-600">Select All</Button>
                    <Button variant="ghost" size="xs" onClick={deselectAllEmployees} className="text-[10px] h-6 px-2 text-slate-400">Clear</Button>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 max-h-[200px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2 custom-scrollbar">
                  {employeeList.map(emp => (
                    <div 
                      key={emp.user_Id} 
                      onClick={() => toggleEmployeeSelection(emp.user_Id)}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${batchForm.selectedEmployees.includes(emp.user_Id) ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-transparent hover:bg-slate-100'}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${batchForm.selectedEmployees.includes(emp.user_Id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                        {batchForm.selectedEmployees.includes(emp.user_Id) && <CheckIcon className="text-white !text-[10px]" />}
                      </div>
                      <span className="text-xs font-medium text-slate-700">{emp.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleBatchSave} className="w-full bg-[#2A174E] hover:bg-[#1a0e30] text-white" disabled={loading}>
                {loading ? "Processing..." : "Apply Batch Update"}
              </Button>
            </TabsContent>

            <TabsContent value="csv" className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex flex-col items-center text-center">
                <p className="text-sm text-blue-800 mb-4">Download our CSV template, fill it out with employee data, and upload it here.</p>
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="border-blue-600 text-blue-600 hover:bg-blue-100">
                  <DownloadIcon className="mr-2 h-4 w-4" /> Download CSV Template
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-[#2A174E] transition-colors cursor-pointer relative">
                  <Input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileChange} 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <CloudUploadIcon className="text-slate-400 h-12 w-12 mb-2" />
                  <p className="text-sm font-medium text-slate-600">{file ? file.name : "Click or drag CSV file here"}</p>
                </div>
                <Button onClick={handleUpload} className="w-full bg-[#2A174E] hover:bg-[#1a0e30] text-white" disabled={!file || loading}>
                  {loading ? "Uploading..." : "Upload and Process CSV"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Sidebar>
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        
        {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:"", type:"success"})} />}
        
        {/* Top Header */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-6">
  
        {/* Left Section: Back Button + Title */}
        <div className="group flex items-center gap-0 w-full xl:w-auto">
          
          {/* Back Button Container */}
          <div className="w-0 overflow-hidden group-hover:w-10 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out">
            <Button 
              variant="ghost" 
              size="icon" 
              asChild 
              className="text-[#2A174E]"
            >
              <Link to="/loanmanagement">
                <ArrowBackIcon className="h-6 w-6" />
              </Link>
            </Button>
          </div>

          {/* Title Group: Adds margin-left only when hovered */}
          <div className="ml-0 group-hover:ml-2 transition-all duration-300 ease-in-out">
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Governmental Loans</h1>
            <span className="text-sm text-slate-500 mt-1 block">
              Manage statutory loans like SSS, Pag-IBIG, and other government deductions.
            </span>
          </div>
        </div>

        {/* Right Section: Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* <Button variant="outline" asChild className="border-[#2A174E] text-[#2A174E]">
            <Link to="/govloans/history">
              <HistoryIcon className="mr-2 h-4 w-4" /> View Agency History
            </Link>
          </Button> */}
          
          <div className="flex items-center gap-2">
            <FilterListIcon className="text-slate-400 h-5 w-5" />
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
              <SelectTrigger className="w-[160px] h-9 bg-white font-bold text-slate-700">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 21 }, (_, i) => 2020 + i).map(year => (
                  <SelectItem key={year} value={year.toString()}>Fiscal Year {year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

        {/* Main Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-2">
          <Button
            variant="ghost"
            className={`h-9 text-sm font-semibold rounded-lg ${activeMainTab === "summary" ? "bg-[#2A174E] text-white hover:bg-[#2A174E] hover:text-white" : "text-slate-500 hover:text-[#2A174E] hover:bg-slate-100"}`}
            onClick={() => {setActiveMainTab("summary"); setActiveTab("summary"); setIsEditingTable(false);}}
          >
            <DashboardIcon className="mr-2 h-4 w-4" /> Summary Overview
          </Button>
          <Button
            variant="ghost"
            className={`h-9 text-sm font-semibold rounded-lg ${activeMainTab === "sss" ? "bg-[#2A174E] text-white hover:bg-[#2A174E] hover:text-white" : "text-slate-500 hover:text-[#2A174E] hover:bg-slate-100"}`}
            onClick={() => {setActiveMainTab("sss"); setActiveTab("sss_salary"); setIsEditingTable(false);}}
          >
            <AccountBalanceIcon className="mr-2 h-4 w-4" /> SSS
          </Button>
          <Button
            variant="ghost"
            className={`h-9 text-sm font-semibold rounded-lg ${activeMainTab === "pagibig" ? "bg-[#2A174E] text-white hover:bg-[#2A174E] hover:text-white" : "text-slate-500 hover:text-[#2A174E] hover:bg-slate-100"}`}
            onClick={() => {setActiveMainTab("pagibig"); setActiveTab("pagibig_mpl"); setIsEditingTable(false);}}
          >
            <AccountBalanceIcon className="mr-2 h-4 w-4" /> Pag-IBIG
          </Button>
        </div>

        {/* Sub Tab Navigation */}
        {activeMainTab !== "summary" && (
          <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-4">
            {activeMainTab === "sss" && (
              <>
                <Button
                  variant="ghost"
                  className={`h-8 text-xs font-semibold rounded-lg border ${activeTab === "sss_salary" ? "bg-slate-100 border-[#2A174E] text-[#2A174E]" : "border-transparent text-slate-500 hover:bg-slate-50"}`}
                  onClick={() => {setActiveTab("sss_salary"); setIsEditingTable(false);}}
                >
                  Salary Loan
                </Button>
                <Button
                  variant="ghost"
                  className={`h-8 text-xs font-semibold rounded-lg border ${activeTab === "sss_calamity" ? "bg-slate-100 border-[#2A174E] text-[#2A174E]" : "border-transparent text-slate-500 hover:bg-slate-50"}`}
                  onClick={() => {setActiveTab("sss_calamity"); setIsEditingTable(false);}}
                >
                  Calamity Loan
                </Button>
                <Button
                  variant="ghost"
                  className={`h-8 text-xs font-semibold rounded-lg border ${activeTab === "sss_emergency" ? "bg-slate-100 border-[#2A174E] text-[#2A174E]" : "border-transparent text-slate-500 hover:bg-slate-50"}`}
                  onClick={() => {setActiveTab("sss_emergency"); setIsEditingTable(false);}}
                >
                  Emergency Loan
                </Button>
                <Button
                  variant="ghost"
                  className={`h-8 text-xs font-semibold rounded-lg border ${activeTab === "sss_conso" ? "bg-slate-100 border-[#2A174E] text-[#2A174E]" : "border-transparent text-slate-500 hover:bg-slate-50"}`}
                  onClick={() => {setActiveTab("sss_conso"); setIsEditingTable(false);}}
                >
                  Conso Loan
                </Button>
              </>
            )}
            {activeMainTab === "pagibig" && (
              <>
                <Button
                  variant="ghost"
                  className={`h-8 text-xs font-semibold rounded-lg border ${activeTab === "pagibig_mpl" ? "bg-slate-100 border-[#2A174E] text-[#2A174E]" : "border-transparent text-slate-500 hover:bg-slate-50"}`}
                  onClick={() => {setActiveTab("pagibig_mpl"); setIsEditingTable(false);}}
                >
                  MPL
                </Button>
                <Button
                  variant="ghost"
                  className={`h-8 text-xs font-semibold rounded-lg border ${activeTab === "pagibig_calamity" ? "bg-slate-100 border-[#2A174E] text-[#2A174E]" : "border-transparent text-slate-500 hover:bg-slate-50"}`}
                  onClick={() => {setActiveTab("pagibig_calamity"); setIsEditingTable(false);}}
                >
                  Calamity Loan
                </Button>
              </>
            )}
          </div>
        )}
        {activeMainTab === "summary" && (
          <div className="mb-6 border-b border-slate-200 pb-4"></div>
        )}

        {/* Conditional Dashboard Stats for Specific Loans */}
        {activeTab !== "summary" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 w-full text-left font-sans animate-in fade-in zoom-in-95 duration-200">
            
            {/* Card 1: Total Repaid This Year */}
            <div className="md:col-span-2 border border-slate-200 bg-white p-6 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div className="w-full max-w-xs">
                  <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">Total Repaid ({selectedYear})</p>
                  <p className="text-4xl font-extrabold text-slate-900 tracking-tight">{peso(activeStats.totalPaid)}</p>
                </div>
                <div className="text-right bg-green-50 px-3 py-1.5 rounded-md border border-green-100 flex items-center gap-1">
                  <AccountBalanceIcon className="text-green-600 !text-sm" />
                  <p className="text-sm font-semibold text-green-700">{currentTypeName}</p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-4 mt-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 w-fit">
                  <EventIcon className="text-slate-400 !text-base" />
                  <span>Fiscal Year: <span className="text-slate-900 font-semibold ml-1">{selectedYear}</span></span>
                </div>
              </div>
            </div>

            {/* Card 2: Active Borrowers */}
            <div className="border border-slate-200 bg-white p-6 rounded-xl shadow-sm flex flex-col justify-center items-center text-center">
              <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center mb-4 border border-indigo-100">
                <GroupIcon className="text-indigo-600" />
              </div>
              <p className="text-5xl font-extrabold text-slate-900">{activeStats.subscribers}</p>
              <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mt-2">Active Deductions</p>
              <p className="text-xs text-slate-400 mt-1">({selectedYear} Cohort)</p>
            </div>

            {/* Card 3: All-Time Stats */}
            <div className="md:col-span-3 border border-slate-200 bg-[#2A174E] text-white p-6 rounded-xl shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <AccountBalanceWalletIcon style={{ fontSize: '100px' }} />
              </div>
              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 w-full">
                <div className="bg-[#2A174E] p-4 rounded-lg border border-[#7A52B5]/30 flex-1 w-full">
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Total Collections (All-Time)</p>
                  <p className="text-3xl font-bold text-white tracking-tight">{peso(totalAllTime)}</p>
                </div>
                <div className="bg-[#2A174E] p-4 rounded-lg border border-[#7A52B5]/30 flex-1 w-full">
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Collections ({selectedYear})</p>
                  <p className="text-3xl font-bold text-white tracking-tight">{peso(activeStats.totalPaid)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Matrix / Summary Content */}
        <div className="w-full">
          {activeTab === "summary" ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {govTypes.map(type => renderSummaryTable(type))}
            </div>
          ) : (
            <>
              {/* Detailed View Table Header Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-4 mt-8">
                <h3 className="text-xl font-bold text-[#2A174E]">{currentTypeName} History ({selectedYear})</h3>
                <div className="flex flex-wrap gap-2">
                  {isAdmin && (
                    <>
                      {/* <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setBatchForm(prev => ({ ...prev, dates: [], amount: "" }));
                          setShowBatchModal(true);
                        }}
                        className="border-[#2A174E] text-[#2A174E] hover:bg-slate-50 h-9"
                      >
                        <GroupAddOutlinedIcon className="mr-1 h-4 w-4" /> Batch Upload
                      </Button> */}
                      {/* <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsEditingTable(!isEditingTable)}
                        className={`h-9 ${isEditingTable ? "bg-green-500 hover:bg-green-600 text-white border-transparent" : "border-[#2A174E] text-[#2A174E] hover:bg-slate-50"}`}
                      >
                        {isEditingTable ? <><CheckIcon className="mr-1 h-4 w-4" /> Save Matrix</> : <><EditIcon className="mr-1 h-4 w-4" /> Edit Matrix</>}
                      </Button> */}
                    </>
                  )}
                </div>
              </div>

              <Card className="shadow-sm border-0 bg-white py-0">
                <CardContent className="p-0">
                  <div className="relative max-h-[65vh] overflow-auto w-full bg-white rounded-xl custom-scrollbar">
                    <table className="w-full min-w-max border-collapse text-sm">
                      
                      <thead className="sticky top-0 z-[50] shadow-sm">
                        <tr>
                          {/* Top-Left Header Cell */}
                          <th className="sticky left-0 top-0 z-[60] bg-[#1e1136] text-yellow-400 border-r-2 border-b-2 border-[#2A174E] p-3 min-w-[120px] align-middle text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                            <div className="flex flex-col leading-tight">
                              <span className="text-[9px] font-black uppercase opacity-90">{selectedYear} Year</span>
                              <span className="text-xs text-white font-bold">MONTHS / DATE</span>
                            </div>
                          </th>
                          
                          {/* Middle Header Cells (Employees) */}
                          {employeeList.map((emp) => (
                            <th key={emp.key} className="sticky top-0 z-[50] bg-[#2A174E] text-white border-x border-b-2 border-[#3d2270] min-w-[140px] p-3 text-center align-middle">
                              <div className="flex flex-col leading-tight items-center">
                                <span className="text-[11px] font-bold uppercase">{emp.name.split(',')[0]}</span>
                                <span className="text-[9px] text-white/70 font-mono">{emp.id}</span>
                              </div>
                            </th>
                          ))}

                          {/* Top-Right Header Cells (Totals) */}
                          <th className="sticky right-[120px] top-0 z-[60] bg-[#1e1136] text-yellow-400 border-l-2 border-b-2 border-[#2A174E] min-w-[120px] p-3 text-center align-middle shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                            <div className="flex flex-col leading-tight">
                              <span className="text-[9px] font-black uppercase">SUB</span>
                              <span className="text-xs text-white font-bold">TOTAL</span>
                            </div>
                          </th>
                          <th className="sticky right-0 top-0 z-[60] bg-[#1a0f2e] text-yellow-400 border-l border-b-2 border-[#3d2270] min-w-[120px] p-3 text-center align-middle shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                            <div className="flex flex-col leading-tight">
                              <span className="text-[9px] font-black uppercase">MONTHLY</span>
                              <span className="text-xs text-white font-bold">TOTAL</span>
                            </div>
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={employeeList.length + 3} className="h-32 text-center text-slate-500 italic p-6">
                              Loading data...
                            </td>
                          </tr>
                        ) : expectedDates.length > 0 ? (
                          <>
                          {(() => {
                            const typeData = allData[activeTab] || [];
                            const rowTotals = {};
                            
                            // Pre-calculate row totals (only deducted)
                            expectedDates.forEach(dStr => {
                              const period = typeData.find(d => isInSamePeriod(d.date, dStr));
                              rowTotals[dStr] = period ? Object.values(period.values).reduce((acc, v) => acc + (v.payrollId ? (v.amount || 0) : 0), 0) : 0;
                            });

                            // Function to get monthly total (only deducted)
                            const getMonthlyTotal = (dStr) => {
                              const date = new Date(dStr);
                              const m = date.getMonth();
                              const y = date.getFullYear();

                              const monthDates = expectedDates.filter(d => {
                                const rd = new Date(d);
                                return rd.getFullYear() === y && rd.getMonth() === m;
                              });
                              
                              const isLastOfMonth = dStr === monthDates[monthDates.length - 1];

                              if (!isLastOfMonth) return null;

                              return monthDates
                                .filter(d => d <= dStr)
                                .reduce((sum, d) => sum + (rowTotals[d] || 0), 0);
                            };

                            return expectedDates.map((dateStr, i) => {
                              const dateObj = new Date(dateStr);
                              const monthLabel = dateObj.toLocaleDateString('en-PH', { month: 'long' });
                              const dayLabel = dateObj.getDate();
                              const isCurrentRow = dateStr === currentCutoffDate;
                              
                              const rowTotal = rowTotals[dateStr] || 0;
                              const monthlyTotal = getMonthlyTotal(dateStr);

                              return (
                                <tr key={dateStr} className={`hover:bg-slate-50 transition-colors ${isCurrentRow ? "bg-blue-50/30" : ""}`}>
                                  {/* Left Column Cell */}
                                  <td className="sticky left-0 z-[40] bg-white border-r-2 border-b border-[#2A174E] p-3 align-top shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    {isEditingTable ? (
                                      <Input 
                                        type="date" 
                                        value={dateStr}
                                        onChange={(e) => handleHeaderChange(i, e.target.value)}
                                        className="h-8 text-xs font-bold text-[#2A174E] focus-visible:ring-blue-500"
                                      />
                                    ) : (
                                      <div className="flex flex-col">
                                        <span className="font-bold text-[13px] text-[#2A174E]">{monthLabel}</span>
                                        <span className="text-[10px] font-semibold text-slate-500">{dayLabel}</span>
                                        {isCurrentRow && <span className="bg-yellow-400 text-[#2A174E] text-[9px] font-black px-1 py-0.5 rounded w-fit mt-1">CURR</span>}
                                      </div>
                                    )}
                                  </td>
                                  
                                  {/* Data Cells */}
                                  {employeeList.map((emp) => {
                                    const actualRecord = typeData.find(d => isInSamePeriod(d.date, dateStr));
                                    const record = actualRecord ? actualRecord.values[emp.key] : null;
                                    const amount = record ? record.amount : 0;
                                    const isDeducted = record?.payrollId != null;
                                    
                                    const isEditing = editingCell?.date === dateStr && editingCell?.empKey === emp.key;
                                    const isSyncing = syncingCell?.date === dateStr && syncingCell?.empKey === emp.key;

                                    let cellClass = "border-r border-b border-slate-100 p-2 text-center align-middle font-mono text-[13px] relative select-none cursor-pointer ";
                                    if (isEditing) cellClass += "bg-white p-0 ";
                                    else if (isSyncing) cellClass += "bg-yellow-50 ";
                                    else if (amount > 0) {
                                      if (isDeducted) cellClass += "text-green-800 font-bold bg-green-50/50 ";
                                      else cellClass += "text-blue-600 font-bold ";
                                    }
                                    else if (record) cellClass += "text-red-600 font-semibold opacity-80 ";
                                    else cellClass += "text-slate-400 "; 

                                    return (
                                      <td 
                                        key={emp.key} 
                                        className={cellClass}
                                        onDoubleClick={() => !isDeducted && handleCellDoubleClick(dateStr, emp.key, amount)}
                                      >
                                        {isEditing ? (
                                          <input 
                                            type="text" 
                                            value={editValue} 
                                            onChange={(e) => setEditValue(e.target.value)} 
                                            onBlur={() => handleCellSave(dateStr, emp.key)} 
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleCellSave(dateStr, emp.key);
                                              }
                                            }} 
                                            autoFocus 
                                            className="w-full h-10 border-2 border-[#2A174E] bg-white text-center font-mono text-[13px] text-black font-bold outline-none" 
                                          />
                                        ) : isSyncing ? (
                                          <span className="text-[8px] font-black text-yellow-600 animate-pulse">SAVING...</span>
                                        ) : (
                                          <div className="flex flex-col items-center">
                                            <span>{amount > 0 ? parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</span>
                                            {isDeducted && <span className="text-[8px] text-green-700 font-black uppercase tracking-tighter">Deducted</span>}
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })}

                                  {/* Right Column Cells (Row Totals) */}
                                  <td className={`sticky right-[120px] z-[40] border-l-2 border-b border-[#2A174E] p-3 text-center align-middle font-bold text-[#2A174E] min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isCurrentRow ? "bg-blue-50" : "bg-white"}`}>
                                    {rowTotal > 0 ? parseFloat(rowTotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                                  </td>
                                  <td className={`sticky right-0 z-[40] border-l border-b border-slate-200 p-3 text-center align-middle font-bold text-[#2A174E] min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isCurrentRow ? "bg-blue-50" : "bg-slate-50"}`}>
                                    {monthlyTotal !== null && monthlyTotal > 0
                                      ? parseFloat(monthlyTotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                      : monthlyTotal !== null ? "—" : ""}
                                  </td>
                                </tr>
                              );
                            });
                          })()}

                            {/* Footer Row (Total Paid - Current Year) */}
                            <tr className="sticky bottom-[49px] z-[45] bg-slate-100 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
                              <td className="sticky left-0 z-[50] bg-slate-100 border-r-2 border-t-2 border-b border-[#2A174E] p-3 align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                                <span className="text-[11px] font-black tracking-wider text-[#2A174E]">TOTAL PAID ({selectedYear})</span>
                              </td>
                              {employeeList.map((emp) => {
                                const typeData = allData[activeTab] || [];
                                const empSubtotal = expectedDates.reduce((acc, dateStr) => {
                                  const period = typeData.find(d => isInSamePeriod(d.date, dateStr));
                                  const record = period?.values[emp.key];
                                  return acc + (record?.payrollId ? (record.amount || 0) : 0);
                                }, 0);
                                return (
                                  <td key={emp.key} className="border-r border-t-2 border-b border-[#2A174E] border-slate-200 p-3 text-center align-middle font-mono text-[13px] font-bold text-slate-900">
                                    {empSubtotal > 0 ? parseFloat(empSubtotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                                  </td>
                                );
                              })}
                              <td className="sticky right-[120px] z-[50] bg-[#2A174E] text-yellow-400 border-l-2 border-t-2 border-b border-[#2A174E] p-3 text-center align-middle font-mono text-[13px] font-black min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                                {(() => {
                                   const typeData = allData[activeTab] || [];
                                   const stats = expectedDates.reduce((acc, dateStr) => {
                                     const period = typeData.find(d => isInSamePeriod(d.date, dateStr));
                                     return acc + (period ? Object.values(period.values).reduce((sum, v) => sum + (v.payrollId ? (v.amount || 0) : 0), 0) : 0);
                                   }, 0);
                                   return stats > 0 ? parseFloat(stats).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
                                })()}
                              </td>
                              <td className="sticky right-0 z-[50] bg-[#2A174E] text-yellow-400 border-l border-t-2 border-b border-[#2A174E] p-3 text-center align-middle font-mono text-[13px] font-black min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                                {(() => {
                                   const typeData = allData[activeTab] || [];
                                   const stats = expectedDates.reduce((acc, dateStr) => {
                                     const period = typeData.find(d => isInSamePeriod(d.date, dateStr));
                                     return acc + (period ? Object.values(period.values).reduce((sum, v) => sum + (v.payrollId ? (v.amount || 0) : 0), 0) : 0);
                                   }, 0);
                                   return stats > 0 ? parseFloat(stats).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
                                })()}
                              </td>
                            </tr>

                            {/* Footer Row (Total Paid - All Time) */}
                            <tr className="sticky bottom-0 z-[45] bg-slate-200 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                              <td className="sticky left-0 z-[50] bg-slate-200 border-r-2 border-t border-[#2A174E] p-3 align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                                <span className="text-[11px] font-black tracking-wider text-[#2A174E]">TOTAL LOANS (ALL-TIME)</span>
                              </td>
                              {employeeList.map((emp) => {
                                const typeData = allData[activeTab] || [];
                                const totalLoans = typeData.reduce((acc, item) => {
                                  const record = item.values[emp.key];
                                  return acc + (record?.payrollId ? (record.amount || 0) : 0);
                                }, 0);
                                return (
                                  <td key={emp.key} className="border-r border-t border-slate-300 p-3 text-center align-middle font-mono text-[13px] font-bold text-slate-900">
                                    {totalLoans > 0 ? parseFloat(totalLoans).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                                  </td>
                                );
                              })}
                              <td className="sticky right-[120px] z-[50] bg-white text-[#2A174E] border-l-2 border-t border-[#2A174E] p-3 text-center align-middle font-mono text-[13px] font-black min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                                {(() => {
                                   const typeData = allData[activeTab] || [];
                                   const totalAllTimeDeducted = typeData.reduce((acc, item) => acc + Object.values(item.values).reduce((sum, v) => sum + (v.payrollId ? (v.amount || 0) : 0), 0), 0);
                                   return totalAllTimeDeducted > 0 ? parseFloat(totalAllTimeDeducted).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
                                })()}
                              </td>
                              <td className="sticky right-0 z-[50] bg-white text-[#2A174E] border-l border-t border-[#2A174E] p-3 text-center align-middle font-mono text-[13px] font-black min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                                {(() => {
                                   const typeData = allData[activeTab] || [];
                                   const totalAllTimeDeducted = typeData.reduce((acc, item) => acc + Object.values(item.values).reduce((sum, v) => sum + (v.payrollId ? (v.amount || 0) : 0), 0), 0);
                                   return totalAllTimeDeducted > 0 ? parseFloat(totalAllTimeDeducted).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
                                })()}
                              </td>
                            </tr>

                          </>
                        ) : (
                          <tr>
                            <td colSpan={employeeList.length + 3} className="h-32 text-center text-slate-500 italic p-6">
                              No periods defined.
                            </td>
                          </tr>
                        )}
                      </tbody>

                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Global styling for custom scrollbars */}
        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar {
            height: 10px;
            width: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f5f9; 
            border-radius: 4px;
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

export default GovLoans;