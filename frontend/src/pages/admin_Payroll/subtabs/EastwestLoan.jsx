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
import { formatDateLocal, isInSamePeriod } from "../../../utils/formatTime";

const EastwestLoan = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1;

  const [toast, setToast] = useState({ message: "", type: "success" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
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
    if (!editingCell) return;
    
    // Sanitize input: remove commas and whitespace
    const sanitizedValue = editValue.replace(/,/g, "").trim();
    
    // Treat empty string as 0
    const val = sanitizedValue === "" ? 0 : parseFloat(sanitizedValue);
    
    // Reset editing cell immediately to prevent double calls from onBlur + onKeyDown
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
        fetchData(); // Rollback local state
      }
    } catch (err) {
      setToast({ message: "Failed to sync update", type: "error" });
      fetchData(); // Rollback local state
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
    a.download = `eastwest_loan_matrix_${selectedYear}.csv`;
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

  const getRowTotal = (dateStr) => {
    const period = data.find(d => isInSamePeriod(d.date, dateStr));
    if (!period) return 0;
    return Object.values(period.values).reduce((acc, val) => acc + (val.amount || 0), 0);
  };

  return (
    <div className="loanModule">
      <Sidebar />
      <div className="loanContainer">
        <Navbar />
        {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:"", type:"success"})} />}
        
        <div className="header-wrapper">
          <div className="top">
            <div className="title-area">
              <h1>Eastwest Loan Management</h1>
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
                  {isEditingTable ? <><CheckIcon /> Save Matrix</> : <><EditIcon /> Edit Matrix</>}
                </button>
                <button className="save-btn" onClick={fetchData} disabled={loading}>
                  <SaveIcon /> {loading ? "Updating..." : "Update Payroll"}
                </button>
            </div>
          </div>

          <div className="summary-cards">
            <div className="card highlight">
              <span className="label">BANK PARTNER</span>
              <span className="val">Eastwest Bank</span>
            </div>
            <div className="card">
              <span className="label">ACTIVE SUBSCRIBERS</span>
              <span className="val">{stats.subscribers}</span>
            </div>
            <div className="card highlight">
              <span className="label">TOTAL REPAID ({selectedYear})</span>
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
                  <th className="sticky-col-right total-loan-header">
                    <div className="vertical-stack">
                      <span className="year">TOTAL LOAN</span>
                      <span className="label">THIS PERIOD</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={employeeList.length + 2} className="empty-msg">Loading data...</td></tr>
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
                              <input 
                                type="date" 
                                value={dateStr}
                                onChange={(e) => handleHeaderChange(i, e.target.value)}
                                className="date-edit-input"
                              />
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

                            // Legend Logic:
                            // Green (paid) if amount > 0
                            // Red (removed) if amount === 0 but record exists (explicitly zeroed)
                            // Grey (unpaid) if amount === 0 and no record
                            const statusClass = amount > 0 ? 'paid' : (record ? 'removed' : 'unpaid');

                            return (
                              <td key={emp.key} className={`amt ${statusClass} ${isEditing ? 'editing' : ''} ${isSyncing ? 'syncing' : ''}`} onDoubleClick={() => handleCellDoubleClick(dateStr, emp.key, amount)}>
                                {isEditing ? (
                                  <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => handleCellSave(dateStr, emp.key)} onKeyDown={(e) => e.key === 'Enter' && handleCellSave(dateStr, emp.key)} autoFocus className="cell-edit-input" />
                                ) : isSyncing ? (
                                  <div className="sync-spinner">...</div>
                                ) : (
                                  parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                )}
                              </td>
                            );
                          })}
                          <td className="sticky-col-right total-amt">
                            {parseFloat(getRowTotal(dateStr) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="summary-row subtotal-row">
                      <td className="sticky-col label-cell"><span className="summary-label">TOTAL PAID ({selectedYear})</span></td>
                      {employeeList.map((emp) => {
                        const empSubtotal = expectedDates.reduce((acc, dateStr) => {
                          const period = data.find(d => isInSamePeriod(d.date, dateStr));
                          return acc + (period?.values[emp.key]?.amount || 0);
                        }, 0);
                        return <td key={emp.key} className="amt total">{parseFloat(empSubtotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>;
                      })}
                      <td className="sticky-col-right total-amt final-total">
                        {parseFloat(stats.totalPaid).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="summary-row all-time-row">
                      <td className="sticky-col label-cell"><span className="summary-label">TOTAL LOANS (ALL-TIME)</span></td>
                      {employeeList.map((emp) => {
                        const totalLoans = data.reduce((acc, item) => acc + (item.values[emp.key]?.amount || 0), 0);
                        return <td key={emp.key} className="amt total">{parseFloat(totalLoans).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>;
                      })}
                      <td className="sticky-col-right total-amt all-time">
                        {parseFloat(data.reduce((acc, item) => acc + Object.values(item.values).reduce((sum, v) => sum + (v.amount || 0), 0), 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr><td colSpan={employeeList.length + 2} className="empty-msg">No periods defined.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EastwestLoan;
