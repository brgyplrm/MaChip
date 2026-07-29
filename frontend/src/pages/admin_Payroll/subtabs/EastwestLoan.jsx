import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../../components/Sidebar";
import Navbar from "../../../components/navbar/Navbar";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import FilterListIcon from '@mui/icons-material/FilterList';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { HistoryIcon } from "lucide-react";
import Toast from "../../../components/toast/Toast";
import { formatDateLocal, isInSamePeriod } from "../../../utils/formatTime";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TableChartIcon from '@mui/icons-material/TableChart';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import GroupIcon from '@mui/icons-material/Group';
import EventIcon from '@mui/icons-material/Event';

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableHeader, TableRow, TableHead, TableBody } from "@/components/ui/table";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer
} from 'recharts';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const EastwestLoan = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1 || userData?.user_RoleId === 4;

  const [toast, setToast] = useState({ message: "", type: "success" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [file, setFile] = useState(null);
  
  const [employeeList, setEmployeeList] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [data, setData] = useState([]);

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
  
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [syncingCell, setSyncingCell] = useState(null);

  const type = "Eastwest Loan";

  const fetchCutoffDates = () => {
    const dates = [];
    const year = parseInt(selectedYear);
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
      
      const historyRes = await fetchWithAuth(`/api/payroll/loans/history?type=${type}`);
      const history = await historyRes.json();

      const activeEmps = employees.filter(e => e.dailyRate > 0).map(emp => ({
        user_Id: emp.user_Id,
        name: `${emp.user_LastName}, ${emp.user_FirstName}`,
        id: `MACJ-${String(emp.user_Id).padStart(3, "0")}`,
        key: emp.user_Id.toString(),
        eastwest_Loan: parseFloat(emp.eastwest_Loan || 0),
      }));
      setEmployeeList(activeEmps);

      if (Array.isArray(history)) {
        const dateMap = {};
        history.forEach(item => {
          const dKey = formatDateLocal(item.date);
          if (!dateMap[dKey]) dateMap[dKey] = {};
          dateMap[dKey][item.user_Id.toString()] = {
            amount: parseFloat(item.amount),
            status: 'paid'
          };
        });
        const matrix = Object.keys(dateMap).sort().map(date => ({
          date,
          values: dateMap[date]
        }));
        setData(matrix);
      }
    } catch (err) {
      console.error("Error fetching Eastwest loan data", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

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

    setLoading(true);
    const updates = [];

    batchForm.dates.forEach(dStr => {
      batchForm.selectedEmployees.forEach(empId => {
        updates.push({ date: dStr, user_Id: empId, amount: amount, type });
      });
    });

    try {
      const res = await fetchWithAuth("/api/payroll/loans/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });

      if (res.ok) {
        setToast({ message: `Successfully updated ${updates.length} records!`, type: "success" });
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
    if (!isAdmin) return;
    setEditingCell({ date, empKey });
    setEditValue(currentVal > 0 ? currentVal.toString() : "");
  };

  const handleCellSave = async (date, empKey) => {
    if (!editingCell) return;
    
    // Sanitize input: remove commas and whitespace
    const sanitizedValue = editValue.replace(/,/g, "").trim();
    const val = sanitizedValue === "" ? 0 : parseFloat(sanitizedValue);
    
    setEditingCell(null);

    if (isNaN(val)) {
      setToast({ message: "Invalid amount entered", type: "error" });
      return;
    }

    setSyncingCell({ date, empKey });
    const updates = [{ date, user_Id: parseInt(empKey), amount: val, type }];

    setData(prevData => {
      let newData = [...prevData];
      let recordIndex = newData.findIndex(d => isInSamePeriod(d.date, date));
      if (recordIndex === -1) {
        newData.push({ date, values: { [empKey]: { amount: val, status: 'paid' } } });
      } else {
        const updatedRecord = { 
          ...newData[recordIndex], 
          values: { ...newData[recordIndex].values, [empKey]: { amount: val, status: 'paid' } } 
        };
        newData[recordIndex] = updatedRecord;
      }
      return newData.sort((a, b) => a.date.localeCompare(b.date));
    });

    try {
      const res = await fetchWithAuth("/api/payroll/loans/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      if (res.ok) {
        setToast({ message: "Eastwest Loan cell updated!", type: "success" });
      } else {
        const errData = await res.json();
        setToast({ message: "Sync failed: " + (errData.error || "Unknown error"), type: "error" });
        fetchData(); 
      }
    } catch (err) {
      setToast({ message: "Failed to sync update", type: "error" });
      fetchData(); 
    } finally {
      setTimeout(() => setSyncingCell(null), 500);
    }
  };

  const downloadTemplate = () => {
    const templateId = "EASTWEST_LOAN_TEMPLATE";
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
    const filename = `eastwest_loan_matrix_${selectedYear}.csv`;
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

        if (templateId !== "EASTWEST_LOAN_TEMPLATE") {
          setToast({ 
            message: `Invalid template. You are trying to upload a file for "${templateId.replace(/_/g, ' ')}" into the Eastwest Loan section. Please download the latest template.`, 
            type: "error" 
          });
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
            if (amount > 0) {
              updates.push({
                date,
                user_Id: mapping.user_Id,
                amount,
                type: type
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
          setToast({ message: `Successfully synced ${updates.length} records!`, type: "success" });
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
  const expectedTotal = employeeList.reduce((sum, emp) => sum + (parseFloat(emp.eastwest_Loan) || 0), 0) * expectedDates.length;
  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getRowTotal = (dateStr) => {
    const period = data.find(d => isInSamePeriod(d.date, dateStr));
    if (!period) return 0;
    return Object.values(period.values).reduce((acc, val) => acc + (val.amount || 0), 0);
  };

  const totalAllTime = data.reduce((acc, item) => acc + Object.values(item.values).reduce((sum, v) => sum + (v.amount || 0), 0), 0);


  const EmployeeLoanDashboard = ({ data, employeeList, expectedDates, isInSamePeriod }) => {
  const [selectedEmp, setSelectedEmp] = useState(employeeList[0]?.key || "");

  // Extract data for the selected employee
  const employeeData = useMemo(() => {
    return expectedDates.map(dateStr => {
      const period = data.find(d => isInSamePeriod(d.date, dateStr));
      const record = period ? period.values[selectedEmp] : null;
      return {
        date: new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        amount: record ? record.amount : 0
      };
    });
  }, [data, selectedEmp, expectedDates]);

  return (
    <div className="space-y-6">
      {/* Selector */}
      <Card className="p-4 flex items-center gap-4">
        <label className="text-sm font-bold text-slate-600">Viewing Records For:</label>
        <Select value={selectedEmp} onValueChange={setSelectedEmp}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {employeeList.map(emp => (
              <SelectItem key={emp.key} value={emp.key}>{emp.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Visual Trend */}
        <Card className="p-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Loan Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeData}>
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="amount" fill="#2A174E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Detailed Breakdown List */}
        <Card className="overflow-hidden">
          <div className="p-4 bg-slate-50 font-bold text-slate-600 border-b">History Detail</div>
          <div className="max-h-64 overflow-y-auto">
            {employeeData.map((d, i) => (
              <div key={i} className="flex justify-between p-3 border-b text-sm">
                <span className="text-slate-500">{d.date}</span>
                <span className={`font-mono ${d.amount > 0 ? "font-bold text-emerald-600" : "text-slate-300"}`}>
                  {d.amount > 0 ? d.amount.toLocaleString() : "—"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

const HeatmapLoanMatrix = ({ data, employeeList, expectedDates, isInSamePeriod }) => {
  // Helper to determine cell intensity
  const getIntensity = (amount) => {
    if (amount === 0) return "bg-slate-50";
    if (amount < 5000) return "bg-blue-100";
    if (amount < 15000) return "bg-blue-300";
    return "bg-[#2A174E] text-white"; // High impact
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="p-2 text-[10px] uppercase text-slate-400">Date</th>
            {employeeList.map(emp => (
              <th key={emp.key} className="p-2 text-[10px] text-[#2A174E]">{emp.name.split(',')[0]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {expectedDates.map((dateStr) => (
            <tr key={dateStr}>
              <td className="p-2 text-xs font-bold text-slate-600">
                {new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
              </td>
              {employeeList.map((emp) => {
                const actualRecord = data.find(d => isInSamePeriod(d.date, dateStr));
                const amount = actualRecord?.values[emp.key]?.amount || 0;
                
                return (
                  <td 
                    key={emp.key} 
                    title={`₱${amount.toLocaleString()}`} // Simple hover to show value
                    className={`h-8 w-12 rounded-sm transition-all cursor-pointer ${getIntensity(amount)}`}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const [displayLayout, setDisplayLayout] = useState("card"); // "table" or "card"
  const [selectedSheetMonth, setSelectedSheetMonth] = useState("ALL");
  
  // Card View Controls
  const [cardSearchQuery, setCardSearchQuery] = useState("");
  const [cardCurrentPage, setCardCurrentPage] = useState(1);
  const cardItemsPerPage = 6;

  // Table View Controls
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [tableCurrentPage, setTableCurrentPage] = useState(1);
  const [tableItemsPerPage, setTableItemsPerPage] = useState(10);

  // Reset page position if search query changes
  useEffect(() => {
    setCardCurrentPage(1);
  }, [cardSearchQuery]);

  useEffect(() => {
    setTableCurrentPage(1);
  }, [tableSearchQuery, tableItemsPerPage]);

  // Pivot data matrix down to an employee-first format
  const employeeCardsData = useMemo(() => {
    return employeeList.map(emp => {
      let totalCollectedInCycle = 0;

      const individualLogMatrix = expectedDates.map(dateStr => {
        const actualRecord = data.find(d => isInSamePeriod(d.date, dateStr));
        let amount = 0;
        let status = "unpaid";

        if (actualRecord && actualRecord.values[emp.key]) {
          const record = actualRecord.values[emp.key];
          amount = record.amount;
          status = record.status;
        }

        if (status === 'paid') {
          totalCollectedInCycle += amount;
        }

        return { dateStr, amount, status };
      });

      return {
        ...emp,
        totalHistoricalPaid: totalCollectedInCycle,
        logs: individualLogMatrix
      };
    });
  }, [employeeList, expectedDates, data]);

  // Handle local searching inside the Cards Layout option
  const filteredCardEmployees = useMemo(() => {
    return employeeCardsData.filter(emp => 
      emp.name.toLowerCase().includes(cardSearchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(cardSearchQuery.toLowerCase())
    );
  }, [employeeCardsData, cardSearchQuery]);

  // Compute boundaries for card pagination
  const totalCardPages = Math.ceil(filteredCardEmployees.length / cardItemsPerPage);
  const cardStartIndex = (cardCurrentPage - 1) * cardItemsPerPage;
  const cardEndIndex = Math.min(cardStartIndex + cardItemsPerPage, filteredCardEmployees.length);
  
  const paginatedCardEmployees = useMemo(() => {
    return filteredCardEmployees.slice(cardStartIndex, cardStartIndex + cardItemsPerPage);
  }, [filteredCardEmployees, cardStartIndex]);

  // Handle local searching and pagination inside the Table Matrix Layout
  const filteredTableEmployees = useMemo(() => {
    return employeeList.filter(emp => 
      emp.name.toLowerCase().includes(tableSearchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(tableSearchQuery.toLowerCase())
    );
  }, [employeeList, tableSearchQuery]);

  const totalTablePages = Math.ceil(filteredTableEmployees.length / tableItemsPerPage) || 1;
  const tableStartIndex = (tableCurrentPage - 1) * tableItemsPerPage;
  const tableEndIndex = Math.min(tableStartIndex + tableItemsPerPage, filteredTableEmployees.length);

  const paginatedTableEmployees = useMemo(() => {
    return filteredTableEmployees.slice(tableStartIndex, tableStartIndex + tableItemsPerPage);
  }, [filteredTableEmployees, tableStartIndex, tableItemsPerPage]);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent className="max-w-2xl bg-white p-6 rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#2A174E]">Batch Details Upload ({type})</DialogTitle>
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
                  <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50">
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
        <TooltipProvider>
          <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        
        {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:"", type:"success"})} />}
        
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-6">
  
        {/* Header Text Group */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Employee Personal Loan Management</h1>
          <span className="text-sm text-slate-500 mt-1 block">
            Manage employee company loan deductions, track repayments, and configure matrix schedules.
          </span>
        </div>

        {/* Control Group: View History + Fiscal Year Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block w-full md:w-auto">
                <Button 
                  variant="outline" 
                  asChild
                  className="w-full border-[#2A174E]/20 hover:text-[#2A174E] text-[#2A174E]/70 font-semibold shadow-sm transition-all"
                >
                  <Link 
                    to="/eastwestloan/history" 
                    state={{ activeTab: "requests" }}
                  >
                  <HistoryIcon className="mr-2 h-4 w-4" /> View History
                  </Link>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-slate-800">
              View loan history and archive records
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
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

        {/* Dashboard-Style Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 w-full text-left font-sans">
          
          {/* Card 1: Total Repaid This Year */}
          <div className="border-t-5 border-[#2A174E] bg-white p-6 rounded-xl shadow-sm flex flex-row items-center justify-between gap-4 relative overflow-hidden">
            <div className="text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Total Repaid ({selectedYear})</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                    Total amount collected/repaid for Eastwest loans in the selected fiscal year.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-4xl font-extrabold text-slate-900 tracking-tight">{peso(stats.totalPaid)}</p>
              <div className="mt-2 text-right bg-green-50 px-2 py-0.5 rounded-md border border-green-100 flex items-center gap-1 w-fit">
                <AccountBalanceIcon className="text-green-600 !text-[11px]" />
                <p className="text-[10px] font-semibold text-green-700">Eastwest Partner</p>
              </div>
            </div>
          </div>

          {/* Card 2: Active Borrowers */}
          <div className="border-t-5 border-[#2A174E] border-x border-x-slate-200 bg-white p-6 rounded-xl shadow-sm flex flex-row items-center justify-between gap-4">
            <div className="text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                  {stats.subscribers <= 1 ? "Active Borrower" : "Active Borrowers"}
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                    Count of employees currently repaying Eastwest loans.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-4xl font-extrabold text-slate-900 tracking-tight">{stats.subscribers}</p>
              <p className="text-[10px] text-slate-400 mt-2">({selectedYear} Cohort)</p>
            </div>
            <div className="h-12 w-12 bg-[#2A174E]/5 rounded-full flex items-center justify-center border border-[#2A174E]/50 shrink-0">
              <GroupIcon className="text-indigo-600" />
            </div>
          </div>

          {/* Card 3: Total Expected Collections (selectedYear) */}
          <div className="border border-slate-200 bg-[#2A174E] text-white p-6 rounded-xl shadow-sm relative overflow-hidden flex flex-row items-center justify-between gap-4">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <AccountBalanceWalletIcon style={{ fontSize: '70px' }} />
            </div>
            <div className="relative z-10 text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-bold text-purple-200 tracking-wider uppercase">Total Expected ({selectedYear})</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-purple-300 hover:text-white cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                    Total amount expected to be collected from employees for their Eastwest loans in the selected fiscal year.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-4xl font-extrabold text-white tracking-tight">{peso(expectedTotal)}</p>
              <p className="text-[10px] text-purple-200 mt-2">Expected Collections</p>
            </div>
          </div>
        </div>

        {/* Matrix Table Toolbar Section */}
        <h3 className="text-xl font-bold text-[#2A174E] mb-4">Employee Deduction ({selectedYear})</h3>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full mt-4 mb-6">
          
          {/* Left Side Grouping: Layout Switcher + Search Field stacked vertically */}
          <div className="flex flex-row items-start gap-3 w-full md:w-auto">
            
            {/* Layout View Switcher Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
              <Button
                size="sm"
                variant={displayLayout === "card" ? "default" : "ghost"}
                onClick={() => setDisplayLayout("card")}
                className={`h-7 text-xs font-bold transition-all ${
                  displayLayout === "card" ? "bg-white text-[#2A174E] shadow-sm hover:bg-white" : "text-slate-500 hover:text-[#2A174E]"
                }`}
              >
                Employee Cards
              </Button>
              <Button
                size="sm"
                variant={displayLayout === "table" ? "default" : "ghost"}
                onClick={() => setDisplayLayout("table")}
                className={`h-7 text-xs font-bold transition-all ${
                  displayLayout === "table" ? "bg-white text-[#2A174E] shadow-sm hover:bg-white" : "text-slate-500 hover:text-[#2A174E]"
                }`}
              >
                Matrix Table
              </Button>
            </div>
            {/* Conditional Cards Search Input Box */}
            {displayLayout === "card" && (
              <div className="relative w-full sm:w-[320px] animate-in fade-in slide-in-from-top-1 duration-200">
                <Input
                  placeholder="Search card profile name or ID..."
                  value={cardSearchQuery}
                  onChange={(e) => setCardSearchQuery(e.target.value)}
                  className="w-full bg-white text-slate-700 border-slate-200 focus-visible:ring-[#2A174E] pr-8 pl-3 h-9 text-xs shadow-sm"
                />
                {cardSearchQuery && (
                  <button 
                    onClick={() => setCardSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-rose-500 font-semibold transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Conditional Table Search Input Box */}
            {displayLayout === "table" && (
              <div className="relative w-full sm:w-[320px] animate-in fade-in slide-in-from-top-1 duration-200">
                <Input
                  placeholder="Search matrix table employee..."
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  className="w-full bg-white text-slate-700 border-slate-200 focus-visible:ring-[#2A174E] pr-8 pl-3 h-9 text-xs shadow-sm"
                />
                {tableSearchQuery && (
                  <button 
                    onClick={() => setTableSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-rose-500 font-semibold transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Side Grouping: Admin Controls */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 md:ml-auto w-full md:w-auto justify-start md:justify-end">
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
                className={`h-9 ${isEditingTable ? 'bg-green-500 text-white hover:bg-green-600 border-transparent' : 'border-[#2A174E] text-[#2A174E] hover:bg-slate-50'}`}
              >
                {isEditingTable ? <><CheckIcon className="mr-1 h-4 w-4" /> Save Matrix</> : <><EditIcon className="mr-1 h-4 w-4" /> Edit Matrix</>}
              </Button> */}
            </div>
          )}
        </div>
        {/* --- DYNAMIC CONDITIONAL LAYOUT INJECTION --- */}
        {displayLayout === "table" ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#2A174E]">
                  12-Month Matrix Visual Table ({selectedYear})
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Compact 12-month bird's-eye view for all active employees. Hover over month chips for cutoff details.
                </span>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-md border border-slate-200">
                {employeeList.length} Active Employees
              </span>
            </div>

            <div className="w-full bg-white overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-xs">
                <thead className="bg-[#2A174E] text-white">
                  <tr>
                    <th className="sticky left-0 top-0 z-[50] bg-[#1e1136] text-yellow-400 border-r border-b border-[#2A174E] p-2.5 text-left min-w-[170px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">
                      EMPLOYEE
                    </th>
                    <th className="text-white font-bold text-xs uppercase text-right p-2.5 min-w-[100px]">
                      CUTOFF RATE
                    </th>
                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => (
                      <th key={m} className="text-white font-bold text-xs uppercase text-center p-2 min-w-[65px]">
                        {m}
                      </th>
                    ))}
                    <th className="text-white font-bold text-xs uppercase text-right p-2.5 min-w-[110px]">
                      YTD PAID ({selectedYear})
                    </th>
                    <th className="text-white font-bold text-xs uppercase text-center p-2.5 min-w-[90px]">
                      PROGRESS
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={16} className="h-32 text-center text-slate-500 italic p-6">
                        Loading 12-month matrix visual data...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={16} className="h-32 text-center text-red-500 p-6">
                        <p>Error: {error}</p>
                        <Button variant="outline" size="sm" onClick={fetchData} className="mt-2">Retry Fetching Data</Button>
                      </td>
                    </tr>
                  ) : filteredTableEmployees.length > 0 ? (
                    <>
                      {paginatedTableEmployees.map((emp) => {
                        const monthlyData = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((mName, mIdx) => {
                          const mDates = expectedDates.filter(dStr => new Date(dStr).getMonth() === mIdx);
                          let mAmount = 0;
                          let cutoffsPaid = 0;
                          mDates.forEach(dateStr => {
                            const actualRecord = data.find(d => isInSamePeriod(d.date, dateStr));
                            const amt = actualRecord?.values[emp.key]?.amount || 0;
                            if (amt > 0) {
                              mAmount += amt;
                              cutoffsPaid += 1;
                            }
                          });
                          return { monthIndex: mIdx, monthName: mName, mAmount, cutoffsPaid };
                        });

                        const empYtdPaid = expectedDates.reduce((acc, dateStr) => {
                          const period = data.find(d => isInSamePeriod(d.date, dateStr));
                          return acc + ((period && period.values[emp.key]) ? period.values[emp.key].amount : 0);
                        }, 0);

                        const empExpectedAnnual = (parseFloat(emp.eastwest_Loan) || 0) * expectedDates.length;
                        const completionPercent = empExpectedAnnual > 0 ? Math.min(100, (empYtdPaid / empExpectedAnnual) * 100) : 0;
                        const targetMonthlyFull = emp.eastwest_Loan * 2;

                        return (
                          <tr key={emp.key} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                            {/* Sticky Left Employee Info */}
                            <td className="sticky left-0 z-[40] bg-white border-r border-b border-slate-200 p-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-[#2A174E]/10 text-[#2A174E] rounded-md shrink-0">
                                  <User className="h-3.5 w-3.5" />
                                </div>
                                <div className="text-left truncate">
                                  <span className="font-bold text-[#2A174E] text-xs block truncate">{emp.name}</span>
                                  <span className="text-[10px] font-mono text-slate-400">{emp.id}</span>
                                </div>
                              </div>
                            </td>

                            {/* Monthly Cutoff Rate */}
                            <td className="p-2 text-right font-mono font-bold text-slate-700 border-r border-slate-100">
                              {peso(emp.eastwest_Loan)}
                            </td>

                            {/* 12 Month Status Pills */}
                            {monthlyData.map((m) => {
                              const isFullMonth = targetMonthlyFull > 0 && m.mAmount >= targetMonthlyFull;
                              const isPartialMonth = m.mAmount > 0 && !isFullMonth;

                              return (
                                <td key={m.monthIndex} className="p-1 text-center font-mono border-r border-slate-100 align-middle">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`py-1 px-1 rounded text-[10px] font-mono font-bold transition-all cursor-help ${
                                          isFullMonth
                                            ? "bg-emerald-500 text-white shadow-2xs"
                                            : isPartialMonth
                                            ? "bg-amber-400 text-slate-900 shadow-2xs"
                                            : "bg-slate-100 text-slate-300"
                                        }`}
                                      >
                                        {m.mAmount > 0 ? `₱${(m.mAmount / 1000).toFixed(m.mAmount % 1000 === 0 ? 0 : 1)}k` : "—"}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white text-xs border-slate-800">
                                      <p className="font-bold">{m.monthName} {selectedYear}</p>
                                      <p>Total Collected: {peso(m.mAmount)}</p>
                                      <p>Paid Cutoffs: {m.cutoffsPaid} / 2</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </td>
                              );
                            })}

                            {/* YTD Total Paid */}
                            <td className="p-2 text-right font-mono font-bold text-xs text-emerald-700 bg-emerald-50/40 border-r border-slate-100">
                              {peso(empYtdPaid)}
                            </td>

                            {/* Completion Progress Bar */}
                            <td className="p-2 text-center align-middle">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-bold text-[#2A174E]">
                                  {completionPercent.toFixed(0)}%
                                </span>
                                <div className="w-14 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-full rounded-full"
                                    style={{ width: `${completionPercent}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Footer Row (Monthly Totals for All Employees) */}
                      <tr className="bg-slate-100 font-bold border-t-2 border-[#2A174E]">
                        <td className="sticky left-0 z-[40] bg-slate-100 border-r border-[#2A174E] p-2.5 text-left font-black text-[#2A174E] text-xs shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">
                          TOTAL PAID ({selectedYear})
                        </td>
                        <td className="p-2.5 text-right font-mono text-xs text-slate-500">—</td>
                        {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((_, mIdx) => {
                          const mDates = expectedDates.filter(dStr => new Date(dStr).getMonth() === mIdx);
                          const monthSum = mDates.reduce((sum, dStr) => {
                            const actualRecord = data.find(d => isInSamePeriod(d.date, dStr));
                            if (!actualRecord) return sum;
                            return sum + Object.values(actualRecord.values).reduce((acc, v) => acc + (v.amount || 0), 0);
                          }, 0);

                          return (
                            <td key={mIdx} className="p-1.5 text-center font-mono text-xs font-black text-[#2A174E] border-r border-slate-200">
                              {monthSum > 0 ? `₱${(monthSum / 1000).toFixed(1)}k` : "—"}
                            </td>
                          );
                        })}
                        <td className="p-2.5 text-right font-mono text-xs font-black text-emerald-800 bg-emerald-100/60 border-r border-slate-200">
                          {peso(stats.totalPaid)}
                        </td>
                        <td className="p-2.5 text-center text-[10px] text-slate-400 font-bold">ANNUAL</td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan={16} className="h-32 text-center text-slate-500 italic p-6">
                        No periods defined.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Matrix Table Pagination Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-100 border-t border-slate-200 gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-medium">
                  Showing <strong className="text-slate-800">{filteredTableEmployees.length > 0 ? tableStartIndex + 1 : 0}</strong> to{" "}
                  <strong className="text-slate-800">{tableEndIndex}</strong> of{" "}
                  <strong className="text-slate-800">{filteredTableEmployees.length}</strong> employees
                </span>

                <Select value={tableItemsPerPage.toString()} onValueChange={(val) => setTableItemsPerPage(parseInt(val))}>
                  <SelectTrigger className="w-[85px] h-7 text-xs bg-white border-slate-300 font-bold">
                    <SelectValue placeholder="Per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / pg</SelectItem>
                    <SelectItem value="25">25 / pg</SelectItem>
                    <SelectItem value="50">50 / pg</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setTableCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={tableCurrentPage === 1}
                  className="h-8 text-xs font-semibold px-3"
                >
                  Previous
                </Button>
                <div className="flex items-center justify-center min-w-[2rem] h-8 text-xs font-bold text-[#2A174E] bg-[#2A174E]/10 rounded-md px-2">
                  {tableCurrentPage} / {totalTablePages}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setTableCurrentPage(p => Math.min(totalTablePages, p + 1))} 
                  disabled={tableCurrentPage >= totalTablePages}
                  className="h-8 text-xs font-semibold px-3"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Employee-First Cards View Framework Container */
          <div className="space-y-4 animate-in fade-in duration-200">
            {paginatedCardEmployees.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-medium border border-dashed rounded-xl bg-slate-50/50 text-sm">
                No active employee card records found matching "{cardSearchQuery}".
              </div>
            ) : (
              <>
                {/* Responsive Card Deck */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {paginatedCardEmployees.map((emp) => {
                    return (
                      <Card key={emp.key} className="py-0 border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
                        <CardHeader className="pt-6 bg-slate-50/60 pb-4 border-b border-slate-100 border-t-4 flex flex-row items-center justify-between space-y-0">
                          <div className="flex items-center gap-3 truncate mr-2">
                            <div className="p-2 bg-[#2A174E]/10 rounded-lg text-[#2A174E] shrink-0">
                              <User className="h-5 w-5" />
                            </div>
                            <div className="truncate text-left">
                              <CardTitle className="text-sm md:text-base font-bold text-[#2A174E] truncate">{emp.name}</CardTitle>
                              <span className="text-xs font-mono text-slate-400 block mt-0.5">{emp.id}</span>
                            </div>
                          </div>

                          {/* Individual Matrix Sliders Drawer */}
                          <Sheet>
                            <SheetTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-[#2A174E] hover:bg-[#2A174E]/5 rounded-full shrink-0">
                                <OpenInNewIcon fontSize="small" />
                              </Button>
                            </SheetTrigger>
                            <SheetContent className="w-full sm:max-w-2xl lg:max-w-xl! xl:max-w-xl! bg-white overflow-y-auto custom-scrollbar p-6">
                              <SheetHeader className="pb-4 border-b border-slate-100 text-left">
                                <SheetTitle className="text-xl font-bold text-[#2A174E]">
                                  {emp.name}'s Repayment Ledger
                                </SheetTitle>
                                <SheetDescription className="text-xs text-slate-400 font-mono">
                                  ID Ref: {emp.id} | Active Fiscal Tracking Year: {selectedYear}
                                </SheetDescription>
                              </SheetHeader>

                              {/* Consolidated Financial Card Subtotals inside Drawer */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 text-left">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block mb-1">Deductions Collected This Term</span>
                                  <span className="text-2xl font-black text-green-700">₱{emp.totalHistoricalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1">
                                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 text-left">Deductions Ledger Matrix</h3>
                                  
                                  {/* Interval Date Filter Dropdown */}
                                  <div className="w-full sm:w-[160px]">
                                    <Select value={selectedSheetMonth} onValueChange={setSelectedSheetMonth}>
                                      <SelectTrigger className="h-8 text-[11px] bg-slate-50 border-slate-200 font-semibold text-slate-600 focus-visible:ring-[#2A174E]">
                                        <SelectValue placeholder="Filter by Month" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ALL">All Cut-offs</SelectItem>
                                        <SelectItem value="0">January</SelectItem>
                                        <SelectItem value="1">February</SelectItem>
                                        <SelectItem value="2">March</SelectItem>
                                        <SelectItem value="3">April</SelectItem>
                                        <SelectItem value="4">May</SelectItem>
                                        <SelectItem value="5">June</SelectItem>
                                        <SelectItem value="6">July</SelectItem>
                                        <SelectItem value="7">August</SelectItem>
                                        <SelectItem value="8">September</SelectItem>
                                        <SelectItem value="9">October</SelectItem>
                                        <SelectItem value="10">November</SelectItem>
                                        <SelectItem value="11">December</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="border border-slate-100 rounded-lg overflow-hidden shadow-sm">
                                  <Table>
                                    <TableHeader className="bg-[#2B174F]">
                                      <TableRow className="hover:bg-transparent border-b-0">
                                        <TableHead className="font-semibold text-white uppercase text-[10px] tracking-wider py-3 px-4">Payroll Interval Point</TableHead>
                                        <TableHead className="font-semibold text-white text-center uppercase text-[10px] tracking-wider py-3">Deduction Amount</TableHead>
                                        <TableHead className="font-semibold text-white text-center uppercase text-[10px] tracking-wider py-3">Posting Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {(() => {
                                        const filteredLogs = emp.logs.filter(log => {
                                          if (selectedSheetMonth === "ALL") return true;
                                          return new Date(log.dateStr).getMonth().toString() === selectedSheetMonth;
                                        });

                                        if (filteredLogs.length === 0) {
                                          return (
                                            <TableRow>
                                              <td colSpan={3} className="text-center py-8 text-xs text-slate-400 font-medium italic bg-slate-50/50">
                                                No logs found for the selected month window.
                                              </td>
                                            </TableRow>
                                          );
                                        }

                                        return filteredLogs.map((log) => {
                                          const dObj = new Date(log.dateStr);
                                          return (
                                            <TableRow key={log.dateStr} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors">
                                              <td className="font-bold text-[#2A174E] text-xs py-2.5 px-4 text-left">
                                                {dObj.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                {log.dateStr === currentCutoffDate && <span className="bg-yellow-400 text-[#2A174E] text-[8px] font-black px-1.5 py-0.2 rounded ml-2">CURRENT</span>}
                                              </td>
                                              <td className="text-center text-xs font-mono font-bold text-slate-700">
                                                {log.amount > 0 ? `₱${log.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                                              </td>
                                              <td className="text-center text-xs">
                                                <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                                  log.status === 'paid' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-400'
                                                }`}>
                                                  {log.status}
                                                </span>
                                              </td>
                                            </TableRow>
                                          );
                                        });
                                      })()}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </SheetContent>
                          </Sheet>
                        </CardHeader>

                        {/* Card Sub-Metrics Section */}
                        <CardContent className="p-5 space-y-4 flex-1 text-left">
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col justify-between">
                            <div className="flex items-center gap-1 text-emerald-600 mb-1">
                              <AccountBalanceWalletIcon className="!text-xs shrink-0" />
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Remitted ({selectedYear})</span>
                            </div>
                            <div>
                              <span className="text-lg font-black text-slate-800 block">
                                ₱{emp.totalHistoricalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Dashboard Pagination System */}
                <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-slate-100 gap-4 mt-2">
                  <div className="text-xs font-medium text-slate-500">
                    Showing <span className="text-slate-800 font-bold">{cardStartIndex + 1}</span> to{" "}
                    <span className="text-slate-800 font-bold">{cardEndIndex}</span> of{" "}
                    <span className="text-slate-800 font-bold">{filteredCardEmployees.length}</span> profiles
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCardCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={cardCurrentPage === 1}
                      className="h-8 text-xs font-semibold px-3"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center justify-center min-w-[2rem] h-8 text-xs font-bold text-[#2A174E] bg-[#2A174E]/10 rounded-md px-2">
                      {cardCurrentPage} / {totalCardPages || 1}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCardCurrentPage(p => Math.min(totalCardPages, p + 1))} 
                      disabled={cardCurrentPage >= totalCardPages}
                      className="h-8 text-xs font-semibold px-3"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
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
        </TooltipProvider>
      </Sidebar>
    </div>
  );
};

export default EastwestLoan;