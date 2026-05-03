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
import Toast from "../../../components/toast/Toast";
import { formatDateLocal, isInSamePeriod } from "../../../utils/formatTime";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EastwestLoan = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1;

  const [toast, setToast] = useState({ message: "", type: "success" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [file, setFile] = useState(null);
  
  const [employeeList, setEmployeeList] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [data, setData] = useState([]);
  
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
    const val = parseFloat(editValue);
    if (isNaN(val)) {
      setEditingCell(null);
      return;
    }

    setSyncingCell({ date, empKey });
    const updates = [{ date, user_Id: parseInt(empKey), amount: val, type }];

    setData(prevData => {
      let newData = [...prevData];
      let recordIndex = newData.findIndex(d => d.date === date);
      if (recordIndex === -1) {
        newData.push({ date, values: { [empKey]: { amount: val, status: 'paid' } } });
      } else {
        newData[recordIndex].values = { ...newData[recordIndex].values, [empKey]: { amount: val, status: 'paid' } };
      }
      return newData.sort((a, b) => a.date.localeCompare(b.date));
    });

    setEditingCell(null);

    try {
      const res = await fetchWithAuth("/api/payroll/loans/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      if (res.ok) setToast({ message: "Eastwest Loan cell updated!", type: "success" });
    } catch (err) {
      setToast({ message: "Failed to sync update", type: "error" });
    } finally {
      setTimeout(() => setSyncingCell(null), 500);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "Date,EmployeeID,EmployeeName,Amount\n2026-01-15,MACJ-001,Cruzat Jenny,500.00\n2026-01-31,MACJ-001,Cruzat Jenny,500.00";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eastwest_loan_template.csv';
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
        
        const updates = lines.slice(1).map(line => {
          const values = line.split(",");
          const macjId = values[1]?.trim();
          const userId = parseInt(macjId?.replace("MACJ-", ""));
          return {
            date: values[0]?.trim(),
            user_Id: userId,
            amount: parseFloat(values[3]?.trim() || 0),
            type: type
          };
        }).filter(item => !isNaN(item.user_Id) && item.date && !isNaN(item.amount));

        if (updates.length === 0) {
          setToast({ message: "No valid data found in CSV", type: "error" });
          setLoading(false);
          return;
        }

        const res = await fetchWithAuth("/api/payroll/loans/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates })
        });

        if (res.ok) {
          setToast({ message: `Successfully uploaded ${updates.length} records!`, type: "success" });
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
      Object.keys(item.values).forEach(empKey => {
        const amt = item.values[empKey].amount;
        if (amt > 0) {
          subscribers.add(empKey);
          totalPaid += amt;
        }
      });
    });

    return {
      subscribers: subscribers.size,
      totalPaid: totalPaid
    };
  };

  const stats = getSummaryStats();
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
                <h1 className="text-2xl font-bold text-[#2A174E] m-0">Eastwest Loan Management</h1>
                <div className="flex items-center gap-2">
                  <FilterListIcon className="text-slate-400 h-5 w-5" />
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[160px] h-9">
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

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
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
              </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col justify-center">
                <span className="text-[10px] font-bold text-green-700 tracking-wider">BANK PARTNER</span>
                <span className="text-base font-bold text-green-800 mt-1">Eastwest Bank</span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider">ACTIVE SUBSCRIBERS</span>
                <span className="text-base font-bold text-slate-800 mt-1">{stats.subscribers}</span>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col justify-center">
                <span className="text-[10px] font-bold text-green-700 tracking-wider">TOTAL REPAID ({selectedYear})</span>
                <span className="text-base font-bold text-green-800 mt-1">{peso(stats.totalPaid)}</span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider">FISCAL YEAR</span>
                <span className="text-base font-bold text-slate-800 mt-1">{selectedYear}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Matrix Table Section */}
        <Card className="shadow-sm border-0 bg-white">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-50 gap-4">
            <CardTitle className="text-lg text-[#2A174E]">Employee Deduction History ({selectedYear})</CardTitle>
            <div className="flex flex-wrap gap-2">
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsEditingTable(!isEditingTable)}
                  className={`${isEditingTable ? 'bg-green-500 text-white hover:bg-green-600 border-transparent' : 'border-[#2A174E] text-[#2A174E] hover:bg-slate-50'}`}
                >
                  {isEditingTable ? <><CheckIcon className="mr-1 h-4 w-4" /> Save Matrix</> : <><EditIcon className="mr-1 h-4 w-4" /> Edit Matrix</>}
                </Button>
              )}
              <Button size="sm" onClick={fetchData} disabled={loading} className="bg-[#2A174E] hover:bg-[#1a0e30] text-white">
                <SaveIcon className="mr-1 h-4 w-4" /> {loading ? "Updating..." : "Update Payroll"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Main Matrix - Native HTML Table */}
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
                    {/* Top Header Cells */}
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
                        Loading data...
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
                              const actualRecord = data.find(d => isInSamePeriod(d.date, dateStr));
                              const record = actualRecord ? actualRecord.values[emp.key] : null;
                              const amount = record ? record.amount : 0;
                              
                              const isEditing = editingCell?.date === dateStr && editingCell?.empKey === emp.key;
                              const isSyncing = syncingCell?.date === dateStr && syncingCell?.empKey === emp.key;

                              let cellClass = "border-r border-b border-slate-100 p-2 text-center align-middle font-mono text-[13px] relative select-none cursor-pointer ";
                              if (isEditing) cellClass += "bg-white p-0 ";
                              else if (isSyncing) cellClass += "bg-yellow-50 ";
                              else if (record) cellClass += "text-green-800 font-bold ";
                              else cellClass += "text-slate-200 ";

                              return (
                                <td 
                                  key={emp.key} 
                                  className={cellClass}
                                  onDoubleClick={() => handleCellDoubleClick(dateStr, emp.key, amount)}
                                >
                                  {isEditing ? (
                                    <input
                                      type="number"
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
                                      className="w-full h-10 border-2 border-blue-500 bg-blue-50 text-center font-mono text-[13px] text-blue-900 outline-none"
                                    />
                                  ) : isSyncing ? (
                                    <span className="text-[8px] font-black text-yellow-600 animate-pulse">SAVING...</span>
                                  ) : (
                                    amount > 0 ? amount.toFixed(2) : "—"
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

                {/* Footer Row (Total Paid) */}
                {expectedDates.length > 0 && !loading && !error && (
                  <tfoot className="sticky bottom-0 z-[50] shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                    <tr>
                      {/* Bottom-Left Cell */}
                      <td className="sticky left-0 bottom-0 z-[60] bg-slate-100 border-r-2 border-t-2 border-[#2A174E] p-3 align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                        <span className="text-[11px] font-black tracking-wider text-[#2A174E]">TOTAL PAID</span>
                      </td>
                      {/* Bottom Total Cells */}
                      {employeeList.map((emp) => {
                        const empSubtotal = expectedDates.reduce((acc, dateStr) => {
                          const period = data.find(d => isInSamePeriod(d.date, dateStr));
                          const val = (period && period.values[emp.key]) ? period.values[emp.key].amount : 0;
                          return acc + val;
                        }, 0);
                        return (
                          <td key={emp.key} className="sticky bottom-0 z-[50] bg-slate-50 border-r border-t-2 border-[#2A174E] border-slate-200 p-3 text-center align-middle font-mono text-[13px] font-bold text-slate-900">
                            {empSubtotal.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}

              </table>
            </div>
          </CardContent>
        </Card>

      </div>
      </Sidebar>
    </div>
  );
};

export default EastwestLoan;