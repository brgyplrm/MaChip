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
import Toast from "../../../components/toast/Toast";
import { formatDateLocal, isInSamePeriod } from "../../../utils/formatTime";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GovLoans = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1;

  const [activeTab, setActiveTab] = useState("summary"); 
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState(null);
  
  const [employeeList, setEmployeeList] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [allData, setAllData] = useState({}); 
  
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [syncingCell, setSyncingCell] = useState(null);

  const govTypes = [
    { id: "sss_loan", label: "SSS Loan", dbType: "SSS Loan" },
    { id: "pagibig_loan", label: "Pag-IBIG Loan", dbType: "Pag-IBIG Loan" },
    { id: "multipurpose", label: "Multipurpose Savings", dbType: "Multi-Purpose" },
    { id: "calamity", label: "Calamity Loan", dbType: "Calamity Loan" }
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
              status: 'paid'
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
    const headers = ["month/year", ...employeeList.map(emp => `${emp.name} #${emp.id}`)];
    const headerLine = headers.join(",");
    const rows = expectedDates.map(date => {
      const emptyValues = employeeList.map(() => "").join(",");
      return `${date},${emptyValues}`;
    });
    const csvContent = [headerLine, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gov_loan_${activeTab}_matrix_${selectedYear}.csv`;
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
        const text = e.target.result;
        const lines = text.split("\n").filter(line => line.trim() !== "");
        if (lines.length < 2) throw new Error("File is empty or missing data.");
        
        const currentType = govTypes.find(t => t.id === activeTab);
        if (!currentType) {
          setToast({ message: "Invalid tab selected", type: "error" });
          setLoading(false);
          return;
        }

        const headers = lines[0].split(",");
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

  const renderSummaryTable = (typeObj) => {
    const typeData = allData[typeObj.id] || [];
    return (
      <Card key={typeObj.id} className="shadow-sm border-0 bg-white">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-50">
          <CardTitle className="text-base text-[#2A174E]">{typeObj.label} Summary</CardTitle>
          <Button variant="link" onClick={() => setActiveTab(typeObj.id)} className="text-blue-500 font-bold uppercase text-[11px] hover:underline">View Details</Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative max-h-[400px] overflow-auto w-full bg-white rounded-b-xl">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead className="sticky top-0 z-[50] shadow-sm bg-slate-50">
                <tr>
                  <th className="sticky left-0 top-0 z-[60] bg-slate-50 text-slate-500 font-bold text-left min-w-[150px] p-3 border-b border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    Employee Name
                  </th>
                  {summaryDates.map(d => {
                    const dateObj = new Date(d);
                    const isCurrent = d === currentCutoffDate;
                    return (
                      <th key={d} className={`sticky top-0 z-[50] p-3 text-center align-middle font-bold border-b border-slate-200 ${isCurrent ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-500"}`}>
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
                  const totalRow = summaryDates.reduce((acc, d) => {
                    const record = typeData.find(item => item.date === d);
                    return acc + (record?.values[emp.key]?.amount || 0);
                  }, 0);

                  if (totalRow === 0 && activeTab === "summary") return null;

                  return (
                    <tr key={emp.user_Id} className="hover:bg-slate-50">
                      <td className="sticky left-0 z-[40] bg-white border-r border-b border-slate-100 p-3 align-middle font-semibold text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)]">
                        {emp.name}
                      </td>
                      {summaryDates.map(d => {
                        const record = typeData.find(item => item.date === d);
                        const amount = record?.values[emp.key]?.amount || 0;
                        const isCurrent = d === currentCutoffDate;
                        return (
                          <td key={d} className={`p-3 text-center align-middle font-mono text-[12px] border-r border-b border-slate-100 ${amount > 0 ? 'text-green-800 font-bold' : 'text-slate-300'} ${isCurrent ? "bg-blue-50/30" : ""}`}>
                            {amount > 0 ? amount.toFixed(2) : "—"}
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

  const getSummaryStats = (typeId) => {
    const typeData = allData[typeId] || [];
    const subscribers = new Set();
    let totalPaid = 0;

    typeData.forEach(item => {
      const recordYear = new Date(item.date).getFullYear();
      if (recordYear === selectedYear) {
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

  const activeStats = activeTab === "summary" ? { subscribers: 0, totalPaid: 0 } : getSummaryStats(activeTab);
  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 p-4 md:p-4 w-full max-w-[1400px] mx-auto overflow-x-hidden min-w-0">
        
        {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:"", type:"success"})} />}
        
        {/* Top Header & Settings */}
        <Card className="shadow-sm border-0 bg-white mb-6 py-2">
          <CardContent className="p-6">
            
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-[#2A174E] m-0">Governmental Loans</h1>
                <div className="flex items-center gap-2">
                  <FilterListIcon className="text-slate-400 h-5 w-5" />
                  <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                    <SelectTrigger className="w-[160px] h-9 bg-white">
                      <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 4 + i).map(year => (
                        <SelectItem key={year} value={year.toString()}>Fiscal Year {year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                {activeTab !== "summary" && (
                  <>
                    <Button variant="outline" onClick={downloadTemplate} className="w-full sm:w-auto border-[#2A174E] text-[#2A174E]">
                      <DownloadIcon className="mr-2 h-4 w-4" /> Template
                    </Button>
                    <div className="w-full sm:w-auto relative">
                      <input type="file" accept=".csv" onChange={handleFileChange} id="csv-upload" className="hidden" />
                      <label htmlFor="csv-upload" className="flex items-center justify-center w-full sm:w-auto h-10 px-4 border border-dashed border-[#2A174E] text-[#2A174E] rounded-md cursor-pointer hover:bg-slate-50 font-medium text-sm transition-colors">
                        <CloudUploadIcon className="mr-2 h-4 w-4" /> {file ? (file.name.length > 15 ? file.name.substring(0,12) + "..." : file.name) : "Choose CSV"}
                      </label>
                    </div>
                    {file && (
                      <Button onClick={handleUpload} disabled={loading} className="w-full sm:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30]">
                        {loading ? "..." : "Upload"}
                      </Button>
                    )}
                  </>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsEditingTable(!isEditingTable)}
                  className={`h-10 ${isEditingTable ? "bg-green-500 hover:bg-green-600 text-white border-transparent" : "border-[#2A174E] text-[#2A174E] hover:bg-slate-50"}`}
                >
                  {isEditingTable ? <><CheckIcon className="mr-1 h-4 w-4" /> Save Matrix</> : <><EditIcon className="mr-1 h-4 w-4" /> Edit Matrix</>}
                </Button>
                <Button onClick={fetchData} disabled={loading} className="w-full sm:w-auto h-10 bg-[#2A174E] text-white hover:bg-[#1a0e30]">
                  <SaveIcon className="mr-2 h-4 w-4" /> {loading ? "Updating..." : "Refresh Data"}
                </Button>
              </div>
            </div>

            {/* Summary Cards */}
            {activeTab !== "summary" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-green-700 tracking-wider">LOAN TYPE</span>
                  <span className="text-base font-bold text-green-800 mt-1">{govTypes.find(t => t.id === activeTab)?.label}</span>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-500 tracking-wider">ACTIVE SUBSCRIBERS</span>
                  <span className="text-base font-bold text-slate-800 mt-1">{activeStats.subscribers}</span>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-green-700 tracking-wider">TOTAL COLLECTED ({selectedYear})</span>
                  <span className="text-base font-bold text-green-800 mt-1">{peso(activeStats.totalPaid)}</span>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-500 tracking-wider">FISCAL YEAR</span>
                  <span className="text-base font-bold text-slate-800 mt-1">{selectedYear}</span>
                </div>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Button
                variant="ghost"
                className={`h-9 text-sm font-semibold rounded-lg ${activeTab === "summary" ? "bg-[#2A174E] text-white hover:bg-[#2A174E] hover:text-white" : "text-slate-500 hover:text-[#2A174E] hover:bg-slate-100"}`}
                onClick={() => {setActiveTab("summary"); setIsEditingTable(false);}}
              >
                <DashboardIcon className="mr-2 h-4 w-4" /> Summary
              </Button>
              {govTypes.map(type => (
                <Button
                  key={type.id}
                  variant="ghost"
                  className={`h-9 text-sm font-semibold rounded-lg ${activeTab === type.id ? "bg-[#2A174E] text-white hover:bg-[#2A174E] hover:text-white" : "text-slate-500 hover:text-[#2A174E] hover:bg-slate-100"}`}
                  onClick={() => {setActiveTab(type.id); setIsEditingTable(false);}}
                >
                  <AccountBalanceIcon className="mr-2 h-4 w-4" /> {type.label}
                </Button>
              ))}
            </div>

          </CardContent>
        </Card>

        {/* Matrix / Summary Content */}
        <div className="w-full">
          {activeTab === "summary" ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {govTypes.map(type => renderSummaryTable(type))}
            </div>
          ) : (
            <Card className="shadow-sm border-0 bg-white">
              <CardContent className="p-0">
                {/* 2D Scroll Container */}
                <div className="relative max-h-[65vh] overflow-auto w-full bg-white rounded-b-xl">
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
                          
                          // Pre-calculate row totals
                          expectedDates.forEach(dStr => {
                            const period = typeData.find(d => isInSamePeriod(d.date, dStr));
                            rowTotals[dStr] = period ? Object.values(period.values).reduce((acc, v) => acc + (v.amount || 0), 0) : 0;
                          });

                          // Function to get monthly total
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
                                  
                                  const isEditing = editingCell?.date === dateStr && editingCell?.empKey === emp.key;
                                  const isSyncing = syncingCell?.date === dateStr && syncingCell?.empKey === emp.key;

                                  let cellClass = "border-r border-b border-slate-100 p-2 text-center align-middle font-mono text-[13px] relative select-none cursor-pointer ";
                                  if (isEditing) cellClass += "bg-white p-0 ";
                                  else if (isSyncing) cellClass += "bg-yellow-50 ";
                                  else if (amount > 0) cellClass += "text-green-800 font-bold ";
                                  else if (record) cellClass += "text-red-600 font-semibold opacity-80 "; // Removed state
                                  else cellClass += "text-slate-400 "; // Unpaid

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
                                        amount > 0 ? parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"
                                      )}
                                    </td>
                                  );
                                })}

                                {/* Right Column Cells (Row Totals) */}
                                <td className={`sticky right-[120px] z-[40] border-l-2 border-b border-[#2A174E] p-3 text-center align-middle font-bold text-[#2A174E] min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isCurrentRow ? "bg-blue-50" : "bg-white"}`}>
                                  {parseFloat(rowTotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className={`sticky right-0 z-[40] border-l border-b border-slate-200 p-3 text-center align-middle font-bold text-[#2A174E] min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isCurrentRow ? "bg-blue-50" : "bg-slate-50"}`}>
                                  {monthlyTotal !== null 
                                    ? parseFloat(monthlyTotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    : ""}
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
                                return acc + (period?.values[emp.key]?.amount || 0);
                              }, 0);
                              return (
                                <td key={emp.key} className="border-r border-t-2 border-b border-[#2A174E] border-slate-200 p-3 text-center align-middle font-mono text-[13px] font-bold text-slate-900">
                                  {parseFloat(empSubtotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              );
                            })}
                            <td className="sticky right-[120px] z-[50] bg-[#2A174E] text-yellow-400 border-l-2 border-t-2 border-b border-[#2A174E] p-3 text-center align-middle font-mono text-[13px] font-black min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                              {(() => {
                                 const typeData = allData[activeTab] || [];
                                 const stats = expectedDates.reduce((acc, dateStr) => {
                                   const period = typeData.find(d => isInSamePeriod(d.date, dateStr));
                                   return acc + (period ? Object.values(period.values).reduce((sum, v) => sum + (v.amount || 0), 0) : 0);
                                 }, 0);
                                 return parseFloat(stats).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              })()}
                            </td>
                            <td className="sticky right-0 z-[50] bg-[#2A174E] text-yellow-400 border-l border-t-2 border-b border-[#2A174E] p-3 text-center align-middle font-mono text-[13px] font-black min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                              {(() => {
                                 const typeData = allData[activeTab] || [];
                                 const stats = expectedDates.reduce((acc, dateStr) => {
                                   const period = typeData.find(d => isInSamePeriod(d.date, dateStr));
                                   return acc + (period ? Object.values(period.values).reduce((sum, v) => sum + (v.amount || 0), 0) : 0);
                                 }, 0);
                                 return parseFloat(stats).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                              const totalLoans = typeData.reduce((acc, item) => acc + (item.values[emp.key]?.amount || 0), 0);
                              return (
                                <td key={emp.key} className="border-r border-t border-slate-300 p-3 text-center align-middle font-mono text-[13px] font-bold text-slate-900">
                                  {parseFloat(totalLoans).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              );
                            })}
                            <td className="sticky right-[120px] z-[50] bg-white text-[#2A174E] border-l-2 border-t border-[#2A174E] p-3 text-center align-middle font-mono text-[13px] font-black min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                              {(() => {
                                 const typeData = allData[activeTab] || [];
                                 const totalAllTime = typeData.reduce((acc, item) => acc + Object.values(item.values).reduce((sum, v) => sum + (v.amount || 0), 0), 0);
                                 return parseFloat(totalAllTime).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              })()}
                            </td>
                            <td className="sticky right-0 z-[50] bg-white text-[#2A174E] border-l border-t border-[#2A174E] p-3 text-center align-middle font-mono text-[13px] font-black min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                              {(() => {
                                 const typeData = allData[activeTab] || [];
                                 const totalAllTime = typeData.reduce((acc, item) => acc + Object.values(item.values).reduce((sum, v) => sum + (v.amount || 0), 0), 0);
                                 return parseFloat(totalAllTime).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
          )}
        </div>

      </div>
      </Sidebar>
    </div>
  );
};

export default GovLoans;