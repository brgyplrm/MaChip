import React, { useState, useEffect } from "react";
import Sidebar from "../../../components/Sidebar";
import Navbar from "../../../components/navbar/Navbar";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import Toast from "../../../components/toast/Toast";
import { formatDateLocal, isInSamePeriod } from "../../../utils/formatTime";
import HmoCalculatorModal from "../../../components/HmoCalculatorModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SecurityIcon from '@mui/icons-material/Security';
import GroupIcon from '@mui/icons-material/Group';
import PieChartIcon from '@mui/icons-material/PieChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EventIcon from '@mui/icons-material/Event';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Maxicare = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1;

  const [toast, setToast] = useState({ message: "", type: "success" });
  const [isEditing, setIsEditing] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employerShare, setEmployerShare] = useState(50);
  
  const [config, setConfig] = useState({
    totalGross: 0,
    monthsToPay: 0,
    cycleStartDate: "",
  });

  const [batchForm, setBatchForm] = useState({
    date: "",
    amount: "",
    selectedEmployees: []
  });

  const setPremium = (val) => setConfig(prev => ({ ...prev, totalGross: val }));
  const setCutoffs = (val) => setConfig(prev => ({ ...prev, monthsToPay: val / 2 }));

  const [employeeList, setEmployeeList] = useState([]);
  const [data, setData] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [editingCell, setEditingCell] = useState(null); 
  const [editValue, setEditValue] = useState("");
  const [syncingCell, setSyncingCell] = useState(null); 

  const generateExpectedDates = (startDateStr, months) => {
    if (!startDateStr || !months) return [];
    const dates = [];
    let current = new Date(startDateStr);
    if (isNaN(current.getTime())) return [];
    
    for (let i = 0; i < months * 2; i++) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const day = current.getDate();
      
      const d = new Date(current);
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      
      if (day <= 15) {
        current = new Date(year, month + 1, 0);
      } else {
        current = new Date(year, month + 1, 15);
      }
    }
    return dates;
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const settingsRes = await fetchWithAuth("/api/system/settings");
      const settingsData = await settingsRes.json();
      if (settingsRes.ok && settingsData) {
        setConfig({
          totalGross: settingsData.maxicareTotalGross,
          monthsToPay: settingsData.maxicareMonthsToPay,
          cycleStartDate: settingsData.maxicareCycleStartDate || "",
        });

        if (settingsData.maxicareDates && settingsData.maxicareDates.length > 0) {
          setExpectedDates(settingsData.maxicareDates);
        } else if (settingsData.maxicareCycleStartDate) {
          setExpectedDates(generateExpectedDates(settingsData.maxicareCycleStartDate, settingsData.maxicareMonthsToPay));
        }
      }

      let historyMap = {}; 
      let rawHistory = [];
      const historyRes = await fetchWithAuth("/api/payroll/maxicare/history");
      if (historyRes.ok) {
        rawHistory = await historyRes.json();
        if (Array.isArray(rawHistory)) {
          rawHistory.forEach(item => {
            const uid = item.user_Id.toString();
            if (!historyMap[uid] || item.date > historyMap[uid].date) {
              historyMap[uid] = {
                amount: parseFloat(item.amount),
                date: item.date,
                status: item.status
              };
            }
          });
        }
      }

      let empRes = await fetchWithAuth("/api/users/all");
      let employees = [];
      if (empRes.ok) employees = await empRes.json();
      if (!Array.isArray(employees)) throw new Error("Could not retrieve employee list.");

      const activeParticipants = employees.filter(emp => emp.dailyRate > 0);

      const activeEmps = activeParticipants.map(emp => {
        const hist = historyMap[emp.user_Id.toString()];
        let rate = parseFloat(emp.healthCard_Amnt) || 0;
        if (rate === 0 && hist && hist.amount > 0) {
          rate = hist.amount;
        }

        return {
          id: `MACJ-${String(emp.user_Id).padStart(3, "0")}`,
          name: `${emp.user_LastName || "Unknown"}, ${emp.user_FirstName || "User"}`,
          key: emp.user_Id.toString(),
          user_Id: emp.user_Id,
          expectedDeduction: rate
        };
      });
      setEmployeeList(activeEmps);

      const dateMap = {};
      rawHistory.forEach(item => {
        if (item.date && item.user_Id) {
          const dateKey = formatDateLocal(item.date);
          if (!dateMap[dateKey]) dateMap[dateKey] = {};
          dateMap[dateKey][item.user_Id.toString()] = {
            amount: parseFloat(item.amount),
            status: item.status
          };
        }
      });

      const matrix = Object.keys(dateMap).sort().map(date => ({
        date,
        values: dateMap[date]
      }));
      setData(matrix);

    } catch (err) {
      console.error("[MAXICARE] Fatal fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleHeaderChange = (index, newDate) => {
    const updated = [...expectedDates];
    updated[index] = newDate;
    setExpectedDates(updated);
  };

  const handleCellDoubleClick = (date, empKey, currentVal) => {
    if (!isAdmin) return;
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

    const todayStr = systemToday ? formatDateLocal(systemToday) : "";
    setSyncingCell({ date, empKey });
    const updates = [];
    
    setData(prevData => {
      let newData = [...prevData];

      const targetDateIndex = expectedDates.indexOf(date);
      const currentCutoffIndex = currentCutoffDate ? expectedDates.indexOf(currentCutoffDate) : expectedDates.length;

      const shouldFill = val >= (deductionCutoff - 0.01); 

      const datesToProcess = shouldFill 
        ? expectedDates.slice(targetDateIndex, currentCutoffIndex)
        : [date];

      datesToProcess.forEach(dStr => {
        let recordIndex = newData.findIndex(d => isInSamePeriod(d.date, dStr));
        const emp = employeeList.find(e => e.key === empKey);

        if (recordIndex === -1) {
          newData.push({
            date: dStr,
            values: { [empKey]: { amount: val, status: dStr < todayStr ? 'paid' : 'estimated' } }
          });
        } else {
          const currentRecord = newData[recordIndex].values[empKey];
          const currentVal = currentRecord ? currentRecord.amount : 0;

          if (currentVal === 0 || dStr === date) {
            newData[recordIndex] = {
              ...newData[recordIndex],
              values: {
                ...newData[recordIndex].values,
                [empKey]: { amount: val, status: dStr < todayStr ? 'paid' : 'estimated' }
              }
            };
          }
        }
        if (emp) {
          updates.push({ date: dStr, user_Id: emp.user_Id, amount: val });
        }
      });

      setEmployeeList(prev => prev.map(e => 
        e.key === empKey ? { ...e, expectedDeduction: val } : e
      ));

      return newData.sort((a, b) => a.date.localeCompare(b.date));
    });

    if (updates.length > 0) {
      try {
        const res = await fetchWithAuth("/api/payroll/maxicare/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates })
        });
        
        if (res.ok) {
          setToast({ 
            message: updates.length > 1 
              ? "Employee history auto-filled and saved!" 
              : "Cell updated successfully!", 
            type: "success" 
          });
        } else {
          const errData = await res.json();
          setToast({ message: "Sync failed: " + (errData.error || "Unknown error"), type: "error" });
          fetchData(); 
        }
      } catch (err) {
        setToast({ message: "Failed to save to database", type: "error" });
        fetchData(); 
      } finally {
        setTimeout(() => setSyncingCell(null), 800); 
      }
    } else {
      setSyncingCell(null);
    }
  };

  const getSummaryStats = () => {
    const subscribers = new Set();
    let totalPaid = 0;

    data.forEach(item => {
      const recordYear = new Date(item.date).getFullYear();
      if (recordYear === parseInt(selectedYear)) {
        Object.keys(item.values).forEach(empKey => {
          const amt = item.values[empKey].amount;
          if (amt > 0) {
            subscribers.add(empKey);
            totalPaid += amt;
          }
        });
      }
    });

    return {
      subscribers: subscribers.size,
      totalPaid: totalPaid
    };
  };

  const stats = getSummaryStats();
  const dismissToast = () => setToast({ message: "", type: "success" });

  const saveSettings = async () => {
    try {
      setLoading(true);
      const settingsRes = await fetchWithAuth("/api/system/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxicareTotalGross: config.totalGross,
          maxicareMonthsToPay: config.monthsToPay,
          maxicareCycleStartDate: config.cycleStartDate,
          maxicareDates: expectedDates
        })
      });

      const userRes = await fetchWithAuth("/api/users/bulk-maxicare", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: employeeList.map(emp => ({
            user_Id: emp.user_Id,
            healthCard_Amnt: emp.expectedDeduction
          }))
        })
      });

      if (settingsRes.ok && userRes.ok) {
        setIsEditing(false);
        setIsEditingTable(false);
        fetchData();
        setToast({ message: "Maxicare configuration and employee deductions saved!", type: "success" });
      }
    } catch (err) {
      setToast({ message: "Error saving settings", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const syncHistory = async () => {
    try {
      setLoading(true);
      const updates = [];
      data.forEach(item => {
        Object.keys(item.values).forEach(empKey => {
          const emp = employeeList.find(e => e.key === empKey);
          const record = item.values[empKey];
          if (emp && record) {
            updates.push({
              date: item.date,
              user_Id: emp.user_Id,
              amount: record.amount
            });
          }
        });
      });

      const res = await fetchWithAuth("/api/payroll/maxicare/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });

      if (res.ok) {
        setToast({ message: "Payroll records updated successfully!", type: "success" });
        fetchData();
      } else {
        const err = await res.json();
        setToast({ message: "Error syncing: " + (err.error || "Unknown error"), type: "error" });
      }
    } catch (err) {
      setToast({ message: "Failed to sync with server", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeSubscribers = stats.subscribers;
  const annualPremiumTotal = config.totalGross * activeSubscribers;
  const employerShareAmount = config.totalGross * (employerShare / 100);
  const employeeShareAmount = config.totalGross * ((100 - employerShare) / 100);
  const deductionCutoff = config.monthsToPay > 0 ? employeeShareAmount / (config.monthsToPay * 2) : 0;

  const getRenewalPeriod = () => {
    if (!config.cycleStartDate) return "Not Set";
    const start = new Date(config.cycleStartDate);
    const end = new Date(start);
    end.setMonth(start.getMonth() + (config.monthsToPay || 12));
    end.setDate(end.getDate() - 1);
    
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${start.toLocaleDateString('en-PH', options)} - ${end.toLocaleDateString('en-PH', options)}`;
  };

  const handleConfigChange = (e) => {
    const { name, value, type } = e.target;
    setConfig(prev => ({ 
      ...prev, 
      [name]: type === 'number' ? parseFloat(value) || 0 : value 
    }));
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const downloadTemplate = () => {
    const csvContent = "Date,EmployeeID,EmployeeName,Amount\n2025-10-15,MACJ-001,Cruzat Jenny,487.72\n2025-10-15,MACJ-002,Monis Gracel,487.72";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'maxicare_template.csv';
    a.click();
  };

  const handleUpload = () => {
    if (!file) return setToast({ message: "Please select a file first", type: "error" });
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split("\n").filter(line => line.trim() !== "");
        
        const rawData = lines.slice(1).map(line => {
          const values = line.split(",");
          return {
            date: values[0]?.trim(),
            id: values[1]?.trim(),
            name: values[2]?.trim(),
            amount: parseFloat(values[3]?.trim() || 0)
          };
        }).filter(item => item.id && item.date);

        const uniqueDates = [...new Set(rawData.map(item => item.date))].sort();
        const uniqueEmps = [];
        const empMap = new Map();
        rawData.forEach(item => {
          if (!empMap.has(item.id)) {
            empMap.set(item.id, item.name);
            uniqueEmps.push({ id: item.id, name: item.name, key: item.id.toLowerCase().replace(/\s/g, '') });
          }
        });

        const newData = uniqueDates.map(date => {
          const values = {};
          rawData.filter(item => item.date === date).forEach(item => {
            const emp = uniqueEmps.find(e => e.id === item.id);
            if (emp) values[emp.key] = { amount: item.amount, status: 'paid' };
          });
          return { date, values };
        });

        setEmployeeList(uniqueEmps);
        setData(newData);
        setLoading(false);
        setToast({ message: "CSV Processed Successfully", type: "success" });
      } catch (err) {
        setToast({ message: "Error parsing CSV. Please ensure it follows the template.", type: "error" });
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleBatchSave = async () => {
    if (!batchForm.date || !batchForm.amount || batchForm.selectedEmployees.length === 0) {
      setToast({ message: "Please fill all fields and select at least one employee", type: "error" });
      return;
    }

    const amount = parseFloat(batchForm.amount);
    if (isNaN(amount)) {
      setToast({ message: "Invalid amount", type: "error" });
      return;
    }

    setLoading(true);
    const todayStr = systemToday ? formatDateLocal(systemToday) : "";
    const updates = [];

    setData(prevData => {
      let newData = [...prevData];
      
      batchForm.selectedEmployees.forEach(empId => {
        const emp = employeeList.find(e => e.user_Id === empId);
        if (!emp) return;

        let recordIndex = newData.findIndex(d => isInSamePeriod(d.date, batchForm.date));
        
        if (recordIndex === -1) {
          newData.push({
            date: batchForm.date,
            values: { [emp.key]: { amount: amount, status: batchForm.date < todayStr ? 'paid' : 'estimated' } }
          });
        } else {
          newData[recordIndex] = {
            ...newData[recordIndex],
            values: {
              ...newData[recordIndex].values,
              [emp.key]: { amount: amount, status: batchForm.date < todayStr ? 'paid' : 'estimated' }
            }
          };
        }
        updates.push({ date: batchForm.date, user_Id: emp.user_Id, amount: amount });
      });

      return newData.sort((a, b) => a.date.localeCompare(b.date));
    });

    try {
      const res = await fetchWithAuth("/api/payroll/maxicare/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });

      if (res.ok) {
        setToast({ message: "Batch update successful!", type: "success" });
        setShowBatchModal(false);
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

  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const currentCutoffDate = systemToday 
    ? expectedDates.find(d => d >= formatDateLocal(systemToday))
    : null;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
        <DialogContent className="max-w-4xl! p-0 overflow-hidden border-none bg-transparent shadow-none">
          <HmoCalculatorModal 
            premium={config.totalGross}
            setPremium={setPremium}
            cutoffs={config.monthsToPay * 2}
            setCutoffs={setCutoffs}
            employerShare={employerShare}
            setEmployerShare={setEmployerShare}
          />
          <div className="flex justify-center pb-6">
            <button 
              onClick={() => setShowCalculator(false)}
              className="bg-[#2A174E] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#1a0e30] transition-colors shadow-lg"
            >
              Continue to Maxicare Management
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent className="max-w-2xl bg-white p-6 rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#2A174E]">Batch Details Upload</DialogTitle>
            <DialogDescription>
              Select a method to upload multiple employee Maxicare records at once.
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
                  <label className="text-xs font-bold text-slate-500 uppercase">Target Month / Period</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50">
                    {expectedDates.map(dStr => {
                      const isSelected = batchForm.date === dStr;
                      const dObj = new Date(dStr);
                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => setBatchForm(prev => ({ ...prev, date: dStr }))}
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
                <div className="border border-slate-200 rounded-lg p-3 max-h-[200px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2">
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
      <div className="flex-1 p-4 md:p-8 w-full max-w-[1400px] mx-auto overflow-x-hidden min-w-0">
        
        {toast.message && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}
        
        {/* Main Grid Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 w-full text-left font-sans">
          
          {/* Domain A: Policy Overview */}
          <div className="md:col-span-2 border border-slate-200 bg-white p-6 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="w-full max-w-xs">
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">Total Gross Premium</p>
                {isEditing ? (
                  <Input 
                    type="number" 
                    name="totalGross" 
                    value={config.totalGross} 
                    onChange={handleConfigChange}
                    autoFocus
                    className="text-3xl font-extrabold text-slate-900 tracking-tight w-full bg-slate-50 border border-slate-300 rounded p-1 mt-1 h-auto"
                  />
                ) : (
                  <p className="text-4xl font-extrabold text-slate-900 tracking-tight">{peso(config.totalGross)}</p>
                )}
              </div>
              <div className="text-right bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100 flex items-center gap-1">
                <SecurityIcon className="text-blue-600 !text-sm" />
                <p className="text-sm font-semibold text-blue-700">Active Policy</p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 mt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 w-fit">
                <EventIcon className="text-slate-400 !text-base" />
                <span>Cycle Start: 
                  {isEditing ? (
                    <input 
                      type="date" 
                      name="cycleStartDate" 
                      value={config.cycleStartDate} 
                      onChange={handleConfigChange}
                      className="ml-2 bg-white border border-slate-300 rounded px-2 py-0.5 text-slate-900 outline-none"
                    />
                  ) : (
                    <span className="text-slate-900 font-semibold ml-1">
                      {config.cycleStartDate ? new Date(config.cycleStartDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not Set'}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 w-fit">
                <span>Renewal Period: <span className="text-slate-900 font-semibold">{getRenewalPeriod()}</span></span>
              </div>
            </div>
          </div>

          {/* Domain A.2: Active Subscribers */}
          <div className="border border-slate-200 bg-white p-6 rounded-xl shadow-sm flex flex-col justify-center items-center text-center">
            <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center mb-4 border border-indigo-100">
              <GroupIcon className="text-indigo-600" />
            </div>
            <p className="text-5xl font-extrabold text-slate-900">{activeSubscribers}</p>
            <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mt-2">Active Subscribers</p>
            <p className="text-xs text-slate-400 mt-1">({selectedYear} Cohort)</p>
          </div>

          {/* Domain B: Financial Split */}
          <div className="md:col-span-2 border border-slate-200 bg-white rounded-xl shadow-sm flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="flex-1 p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <PieChartIcon className="text-emerald-500 !text-base" />
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Employer Share ({employerShare}%)</p>
              </div>
              <p className="text-3xl font-bold text-slate-800">{peso(employerShareAmount)}</p>
            </div>
            <div className="flex-1 p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <PieChartIcon className="text-orange-500 !text-base" />
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Employee Share ({100 - employerShare}%)</p>
              </div>
              <p className="text-3xl font-bold text-slate-800">{peso(employeeShareAmount)}</p>
            </div>
          </div>

          {/* Domain C: Amortization Details */}
          <div className="border border-slate-200 bg-slate-900 text-white p-6 rounded-xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <AccountBalanceWalletIcon style={{ fontSize: '100px' }} />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">Cut-off Deduction</p>
                <p className="text-3xl font-bold text-white tracking-tight">{peso(deductionCutoff)}</p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700/50">
                <div className="text-sm text-slate-300 flex items-center gap-2">
                  Amortized over: 
                  {isEditing ? (
                    <input 
                      type="number" 
                      name="monthsToPay" 
                      value={config.monthsToPay} 
                      onChange={handleConfigChange}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-white w-20 outline-none"
                    />
                  ) : (
                    <span className="text-white font-semibold">{config.monthsToPay}</span>
                  )}
                  Months
                </div>
              </div>
            </div>
          </div>

          {/* Domain D: YTD Tracking */}
          <div className="md:col-span-3 border border-slate-200 bg-white p-6 rounded-xl shadow-sm mt-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUpIcon className="text-slate-400 !text-lg" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Year-to-Date Tracking</h2>
              </div>
              <div className="flex items-center gap-2">
                <FilterListIcon className="text-slate-400 h-5 w-5" />
                <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                  <SelectTrigger className="w-[120px] h-8 text-xs font-bold">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">Year 2025</SelectItem>
                    <SelectItem value="2026">Year 2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Annual Premium Billed</p>
                <p className="text-2xl font-bold text-slate-800">{peso(annualPremiumTotal)}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Collected via Payroll</p>
                <p className="text-2xl font-bold text-slate-800">{peso(stats.totalPaid)}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Matrix Table Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-4 mt-8">
          <h3 className="text-xl font-bold text-[#2A174E]">Employee Deduction History ({selectedYear})</h3>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowCalculator(true)}
                  className="border-[#2A174E] text-[#2A174E] hover:bg-slate-50"
                  disabled={loading}
                >
                  <EditIcon className="mr-1 h-4 w-4" /> Edit Config
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowBatchModal(true)}
                  className="border-[#2A174E] text-[#2A174E] hover:bg-slate-50"
                >
                  <GroupAddOutlinedIcon className="mr-1 h-4 w-4" /> Batch Upload
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => isEditingTable ? saveSettings() : setIsEditingTable(true)}
                  className={`${isEditingTable ? 'bg-green-500 text-white hover:bg-green-600 border-transparent' : 'border-[#2A174E] text-[#2A174E] hover:bg-slate-50'}`}
                >
                  {isEditingTable ? <><CheckIcon className="mr-1 h-4 w-4" /> Save Table</> : <><EditIcon className="mr-1 h-4 w-4" /> Edit Table</>}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-0">
          <div className="relative max-h-[65vh] overflow-auto w-full bg-white rounded-xl">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead className="sticky top-0 z-[50] shadow-sm">
                <tr>
                  <th className="sticky left-0 top-0 z-[60] bg-[#1e1136] text-yellow-400 border-r-2 border-b-2 border-[#2A174E] p-3 min-w-[120px] align-middle text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                    <div className="flex flex-col leading-tight">
                      <span className="text-[9px] font-black uppercase opacity-90">{selectedYear} Year</span>
                      <span className="text-xs text-white font-bold">MONTHS / DATE</span>
                    </div>
                  </th>
                  {employeeList.map((emp) => (
                    <th key={emp.key} className="sticky top-0 z-[50] bg-[#2A174E] text-white border-x border-b-2 border-[#3d2270] min-w-[140px] p-3 text-center align-middle">
                      <div className="flex flex-col leading-tight items-center">
                        <span className="text-[11px] font-bold uppercase">{emp.name.split(',')[0]}</span>
                        <span className="text-[9px] text-white/70 font-mono">{emp.id}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={employeeList.length + 1} className="h-32 text-center text-slate-500 italic p-6">
                      Loading Maxicare data...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={employeeList.length + 1} className="h-32 text-center text-red-500 p-6">
                      <p>Error: {error}</p>
                      <Button variant="outline" size="sm" onClick={fetchData} className="mt-2">Retry Fetching Data</Button>
                    </td>
                  </tr>
                ) : expectedDates.length > 0 ? (
                  <>
                    {expectedDates.map((dateStr, i) => {
                      const dateObj = new Date(dateStr);
                      const monthLabel = dateObj.toLocaleDateString('en-PH', { month: 'long' });
                      const dayLabel = dateObj.getDate();
                      const isCurrentRow = dateStr === currentCutoffDate;
                      
                      return (
                        <tr key={dateStr} className={`hover:bg-slate-50 transition-colors ${isCurrentRow ? "bg-blue-50/30" : ""}`}>
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
                          {employeeList.map((emp) => {
                            const actualRecord = data.find(d => isInSamePeriod(d.date, dateStr));
                            let amount = 0;
                            let status = "unpaid";
                            let isProjection = false;

                            const userRate = parseFloat(emp.expectedDeduction) || 0;
                            const todayStr = systemToday ? formatDateLocal(systemToday) : "";

                            if (actualRecord && actualRecord.values[emp.key]) {
                              const record = actualRecord.values[emp.key];
                              if (record.status === 'paid' && record.amount > 0) {
                                amount = record.amount;
                                status = 'paid';
                              } else if (record.amount === 0) {
                                amount = 0;
                                status = 'removed';
                              } else {
                                amount = userRate;
                                status = 'estimated';
                                isProjection = true;
                              }
                            } else {
                              if (dateStr >= todayStr) {
                                amount = userRate;
                                status = 'estimated';
                                isProjection = true;
                              } else {
                                amount = 0;
                                status = 'unpaid';
                              }
                            }

                            const isEditing = editingCell?.date === dateStr && editingCell?.empKey === emp.key;
                            const isSyncing = syncingCell?.date === dateStr && syncingCell?.empKey === emp.key;

                            let cellClass = "border-r border-b border-slate-100 p-2 text-center align-middle font-mono text-[13px] relative select-none cursor-pointer ";
                            if (isEditing) cellClass += "bg-white p-0 ";
                            else if (isSyncing) cellClass += "bg-yellow-50 ";
                            else if (status === 'paid') cellClass += "text-green-800 font-bold ";
                            else if (status === 'estimated') cellClass += "text-slate-400 italic ";
                            else if (status === 'removed') cellClass += "text-red-600 font-semibold opacity-80 ";
                            else cellClass += "text-slate-300 ";

                            return (
                              <td 
                                key={emp.key} 
                                className={cellClass}
                                onDoubleClick={() => handleCellDoubleClick(dateStr, emp.key, amount)}
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
                                  <>
                                    {amount > 0 ? parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                                    {isProjection && amount > 0 && <span className="absolute top-[2px] right-[2px] text-[8px] font-black bg-slate-200 text-slate-500 px-0.5 rounded leading-none not-italic">EST</span>}
                                  </>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </>
                ) : (
                  <tr>
                    <td colSpan={employeeList.length + 1} className="h-32 text-center text-slate-500 italic p-6">
                      No periods defined.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Footer Rows */}
              {expectedDates.length > 0 && !loading && !error && (
                <tfoot className="sticky bottom-0 z-[50] shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                  {/* Subtotal Row */}
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <td className="sticky left-0 z-[60] bg-slate-100 border-r-2 border-t-2 border-[#2A174E] p-3 align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                      <span className="text-[11px] font-black tracking-wider text-[#2A174E]">SUBTOTAL</span>
                    </td>
                    {employeeList.map((emp) => {
                      const historicalDates = currentCutoffDate ? expectedDates.filter(d => d < currentCutoffDate) : expectedDates;
                      const empSubtotal = historicalDates.reduce((acc, dateStr) => {
                        const period = data.find(d => isInSamePeriod(d.date, dateStr));
                        const val = (period && period.values[emp.key]) ? period.values[emp.key].amount : 0;
                        return acc + val;
                      }, 0);
                      return (
                        <td key={emp.key} className="border-r border-t-2 border-[#2A174E] border-slate-200 p-3 text-center align-middle font-mono text-[13px] font-bold text-slate-900">
                          {parseFloat(empSubtotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Balance Row */}
                  <tr className="bg-slate-50">
                    <td className="sticky left-0 z-[60] bg-slate-50 border-r-2 border-t border-slate-300 p-3 align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                      <span className="text-[11px] font-black tracking-wider text-[#2A174E]">BALANCE</span>
                    </td>
                    {employeeList.map((emp) => {
                      const historicalDates = currentCutoffDate ? expectedDates.filter(d => d < currentCutoffDate) : expectedDates;
                      const empSubtotal = historicalDates.reduce((acc, dateStr) => {
                        const period = data.find(d => isInSamePeriod(d.date, dateStr));
                        const val = (period && period.values[emp.key]) ? period.values[emp.key].amount : 0;
                        return acc + val;
                      }, 0);
                      
                      const isSubscriber = (parseFloat(emp.expectedDeduction) || 0) > 0 || empSubtotal > 0;
                      const balance = isSubscriber ? (employeeShareAmount - empSubtotal) : 0;

                      return (
                        <td key={emp.key} className={`border-r border-t border-slate-200 p-3 text-center align-middle font-mono text-[13px] font-black ${balance < 0 ? 'text-rose-600' : 'text-green-600'}`}>
                          {parseFloat(balance).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}

            </table>
          </div>
        </div>
      </div>
      </Sidebar>
    </div>
  );
};

export default Maxicare;