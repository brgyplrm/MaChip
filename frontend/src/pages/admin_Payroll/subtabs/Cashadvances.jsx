import React, { useState, useEffect } from "react";
import "./loanModule.scss";
import Sidebar from "../../../components/sidebar/Sidebar";
import Navbar from "../../../components/navbar/Navbar";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import FilterListIcon from '@mui/icons-material/FilterList';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Toast from "../../../components/toast/Toast";
import { formatTime12h, formatDateLocal, isInSamePeriod } from "../../../utils/formatTime";

const Cashadvances = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1;

  const [toast, setToast] = useState({ message: "", type: "success" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Use system year if available, fallback to 2026 (or current real year)
  const systemYear = systemToday ? new Date(systemToday).getFullYear() : 2026;
  const [selectedYear, setSelectedYear] = useState(systemYear);
  
  const [employeeList, setEmployeeList] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [data, setData] = useState([]);
  
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [syncingCell, setSyncingCell] = useState(null);
  const [file, setFile] = useState(null);

  const fetchCutoffDates = () => {
    const dates = [];
    const year = selectedYear;
    for (let m = 0; m < 12; m++) {
      // Use local date formatting to avoid timezone shifts from toISOString()
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
      
      const historyRes = await fetchWithAuth(`/api/payroll/loans/history?type=Cash Advance`);
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
      console.error("Error fetching cash advance data", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const handleHeaderChange = index => newDate => {
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
    const updates = [{ date, user_Id: parseInt(empKey), amount: val, type: "Cash Advance" }];

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
      if (res.ok) {
        setToast({ message: "Deduction saved!", type: "success" });
      }
    } catch (err) {
      setToast({ message: "Failed to save", type: "error" });
    } finally {
      setTimeout(() => setSyncingCell(null), 500);
    }
  };

  const downloadTemplate = () => {
    // Header row: month/year, Employee1 #ID, Employee2 #ID, ...
    const headers = ["month/year", ...employeeList.map(emp => `${emp.name} #${emp.id}`)];
    const headerLine = headers.join(",");

    // Rows: All 24 cutoff dates for the selected year
    const rows = expectedDates.map(date => {
      // Add commas for each employee column (initially empty)
      const emptyValues = employeeList.map(() => "").join(",");
      return `${date},${emptyValues}`;
    });

    const csvContent = [headerLine, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash_advance_matrix_${selectedYear}.csv`;
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

        // 1. Parse Headers to get Employee IDs
        const headers = lines[0].split(",");
        const empMappings = []; // { colIndex, user_Id }

        for (let i = 1; i < headers.length; i++) {
          const header = headers[i];
          // Match #MACJ-001 or similar
          const match = header.match(/#MACJ-(\d+)/i);
          if (match) {
            empMappings.push({ colIndex: i, user_Id: parseInt(match[1]) });
          }
        }

        // 2. Parse Rows (Dates)
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
                type: "Cash Advance"
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
          setToast({ message: "Sync error: " + (err.error || "Unknown"), type: "error" });
        }
      } catch (err) {
        console.error("CSV Parse Error:", err);
        setToast({ message: "Failed to parse matrix: " + err.message, type: "error" });
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
      // Only count if the record's year matches the selected year
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

  const stats = getSummaryStats();
  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="loanModule cashAdvances">
      <Sidebar />
      <div className="loanContainer">
        <Navbar />
        {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:"", type:"success"})} />}
        
        <div className="header-wrapper">
          <div className="top">
            <div className="title-area">
              <h1>Cash Advance Management</h1>
              <div className="year-selector">
                <FilterListIcon className="filter-icon" />
                <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                  {(() => {
                    const currentY = systemToday ? new Date(systemToday).getFullYear() : new Date().getFullYear();
                    const startYear = 2011;
                    const endYear = currentY + 10;
                    const years = [];
                    for (let y = endYear; y >= startYear; y--) {
                      years.push(y);
                    }
                    return years.map(year => (
                      <option key={year} value={year} style={year === currentY ? {fontWeight: 'bold', color: '#2563eb'} : {}}>
                        Fiscal Year {year} {year === currentY ? "(Current)" : ""}
                      </option>
                    ));
                  })()}
                </select>
              </div>
            </div>
            <div className="actions">
                <button className="template-btn" onClick={downloadTemplate}>
                   <DownloadIcon /> Template
                </button>
                <input type="file" accept=".csv" onChange={handleFileChange} id="csv-upload" style={{display: 'none'}} />
                <label htmlFor="csv-upload" className="upload-btn">
                   <CloudUploadIcon /> {file ? (file.name.length > 15 ? file.name.substring(0,12) + "..." : file.name) : "Choose CSV"}
                </label>
                {file && (
                  <button className="process-btn" onClick={handleUpload} disabled={loading}>
                    {loading ? "..." : "Upload"}
                  </button>
                )}
                <button className={`edit-headers-btn ${isEditingTable ? 'active' : ''}`} onClick={() => setIsEditingTable(!isEditingTable)}>
                  {isEditingTable ? <><CheckIcon /> Save Table</> : <><EditIcon /> Edit Table</>}
                </button>
                <button className="save-btn" onClick={fetchData} disabled={loading}>
                  <SaveIcon /> Refresh
                </button>
            </div>
          </div>

          <div className="summary-cards">
            <div className="card highlight">
              <span className="label">CATEGORY</span>
              <span className="val">Cash Advances</span>
            </div>
            <div className="card">
              <span className="label">ACTIVE SUBSCRIBERS</span>
              <span className="val">{stats.subscribers}</span>
            </div>
            <div className="card highlight">
              <span className="label">TOTAL REPAID (${selectedYear})</span>
              <span className="val">{peso(stats.totalPaid)}</span>
            </div>
            <div className="card">
              <span className="label">FISCAL YEAR</span>
              <span className="val">{selectedYear}</span>
            </div>
          </div>
        </div>

        <div className="content-body">
          <div className="table-container">
            <table className="pivoted-table">
              <thead>
                <tr className="row-1-months">
                  <th className="sticky-col">
                    <div className="vertical-stack">
                      <span className="year">{selectedYear} Year</span>
                      <span className="label">MONTHS / DATE</span>
                    </div>
                  </th>
                  {employeeList.map((emp) => (
                    <th key={emp.key} className="emp-header-cell">
                      <div className="vertical-stack">
                        <span className="name">{emp.name.split(',')[0]}</span>
                        <span className="id">{emp.id}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={employeeList.length + 1} className="empty-msg">Loading data...</td></tr>
                ) : expectedDates.length > 0 ? (
                  <>
                    {expectedDates.map((dateStr, i) => {
                      const dateObj = new Date(dateStr);
                      const monthLabel = dateObj.toLocaleDateString('en-PH', { month: 'long' });
                      const dayLabel = dateObj.getDate();
                      const isCurrent = dateStr === currentCutoffDate;
                      
                      return (
                        <tr key={dateStr} className={isCurrent ? "current-row" : ""}>
                          <td className="sticky-col date-label">
                            {isEditingTable ? (
                              <input type="date" value={dateStr} onChange={(e) => handleHeaderChange(i)(e.target.value)} className="date-edit-input" />
                            ) : (
                              <>
                                <span className="month">{monthLabel}</span>
                                <span className="day">{dayLabel}</span>
                                {isCurrent && <div className="curr-tag">CURR</div>}
                              </>
                            )}
                          </td>
                          {employeeList.map((emp) => {
                            const actualRecord = data.find(d => isInSamePeriod(d.date, dateStr));
                            const record = actualRecord ? actualRecord.values[emp.key] : null;
                            const amount = record ? record.amount : 0;
                            const isEditing = editingCell?.date === dateStr && editingCell?.empKey === emp.key;
                            const isSyncing = syncingCell?.date === dateStr && syncingCell?.empKey === emp.key;

                            return (
                              <td key={emp.key} className={`amt ${amount > 0 ? 'paid' : 'unpaid'} ${isEditing ? 'editing' : ''} ${isSyncing ? 'syncing' : ''}`} onDoubleClick={() => handleCellDoubleClick(dateStr, emp.key, amount)}>
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
                                    className="cell-edit-input" 
                                  />
                                ) : isSyncing ? (
                                  <div className="sync-spinner">SAVING...</div>
                                ) : (
                                  amount > 0 ? amount.toFixed(2) : "—"
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    <tr className="summary-row subtotal-row">
                      <td className="sticky-col label-cell"><span className="summary-label">TOTAL PAID</span></td>
                      {employeeList.map((emp) => {
                        const empSubtotal = expectedDates.reduce((acc, d) => {
                          const period = data.find(item => item.date === d);
                          return acc + (period?.values[emp.key]?.amount || 0);
                        }, 0);
                        return <td key={emp.key} className="amt total">{empSubtotal.toFixed(2)}</td>;
                      })}
                    </tr>
                  </>
                ) : (
                  <tr><td colSpan={employeeList.length + 1} className="empty-msg">No periods defined.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cashadvances;
