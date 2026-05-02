import React, { useState, useEffect } from "react";
import "./maxicare.scss";
import Sidebar from "../../../components/sidebar/Sidebar";
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

const Maxicare = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1;

  const [toast, setToast] = useState({ message: "", type: "success" });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Maxicare Configuration (Managed in Database)
  const [config, setConfig] = useState({
    totalGross: 0,
    monthsToPay: 0,
    cycleStartDate: "",
  });

  // Dynamic states
  const [employeeList, setEmployeeList] = useState([]);
  const [data, setData] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { date: string, empKey: string }
  const [editValue, setEditValue] = useState("");
  const [syncingCell, setSyncingCell] = useState(null); // { date: string, empKey: string }

  // Helper: Generate the 24 cut-off dates (Fallback Logic)
  const generateExpectedDates = (startDateStr, months) => {
    if (!startDateStr || !months) return [];
    
    const dates = [];
    let current = new Date(startDateStr);
    
    // Check if date is valid
    if (isNaN(current.getTime())) return [];
    
    for (let i = 0; i < months * 2; i++) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const day = current.getDate();
      
      dates.push(new Date(current).toISOString().split('T')[0]);
      
      // Toggle between 15th and Last Day
      if (day <= 15) {
        // Move to last day of current month
        current = new Date(year, month + 1, 0);
      } else {
        // Move to 15th of next month
        current = new Date(year, month + 1, 15);
      }
    }
    return dates;
  };

  // Fetch Data from DB
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch System Settings for Maxicare Config
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

      // 2. Fetch History FIRST (to identify subscribers)
      let historyMap = {}; // userId -> { amount, date, status }
      let rawHistory = [];
      const historyRes = await fetchWithAuth("/api/payroll/maxicare/history");
      if (historyRes.ok) {
        rawHistory = await historyRes.json();
        if (Array.isArray(rawHistory)) {
          rawHistory.forEach(item => {
            const uid = item.user_Id.toString();
            // Store the most recent amount for each user to "harvest" it
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

      // 3. Fetch Employees
      let empRes = await fetchWithAuth("/api/users/all");
      let employees = [];
      if (empRes.ok) employees = await empRes.json();
      if (!Array.isArray(employees)) throw new Error("Could not retrieve employee list.");

      // Participants: All active employees (those with a dailyRate > 0)
      // This allows admins to add contributions for any employee from the matrix.
      const activeParticipants = employees.filter(emp => emp.dailyRate > 0);

      const activeEmps = activeParticipants.map(emp => {
        const hist = historyMap[emp.user_Id.toString()];
        // Harvest rate: Use User table rate, but if it's 0, use the historical rate
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

      // 4. Build Matrix from rawHistory
      const dateMap = {};
      rawHistory.forEach(item => {
        if (item.date && item.user_Id) {
          const dateKey = new Date(item.date).toISOString().split('T')[0];
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

  const handleEmployeeDeductionChange = (userId, newValue) => {
    setEmployeeList(prev => prev.map(emp => 
      emp.user_Id === userId ? { ...emp, expectedDeduction: newValue } : emp
    ));
  };

  const handleCellDoubleClick = (date, empKey, currentVal) => {
    if (!isAdmin) return;
    setEditingCell({ date, empKey });
    setEditValue(currentVal > 0 ? currentVal.toString() : "");
  };

  const handleCellSave = async (date, empKey) => {
    const val = parseFloat(editValue);
    // Allow 0, but block NaN
    if (isNaN(val)) {
      setEditingCell(null);
      return;
    }

    const todayStr = systemToday ? new Date(systemToday).toISOString().split('T')[0] : "";
    setSyncingCell({ date, empKey });
    const updates = [];
    setData(prevData => {
      let newData = [...prevData];

      const targetDateIndex = expectedDates.indexOf(date);
      const currentCutoffIndex = currentCutoffDate ? expectedDates.indexOf(currentCutoffDate) : expectedDates.length;

      // LOGIC: Only fill across if val >= contribution (deductionCutoff)
      const shouldFill = val >= (deductionCutoff - 0.01); 

      const datesToProcess = shouldFill 
        ? expectedDates.slice(targetDateIndex, currentCutoffIndex)
        : [date];

      datesToProcess.forEach(dStr => {
        let recordIndex = newData.findIndex(d => d.date === dStr);
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
            newData[recordIndex].values = {
              ...newData[recordIndex].values,
              [empKey]: { amount: val, status: dStr < todayStr ? 'paid' : 'estimated' }
            };
          }
        }
        if (emp) {
          updates.push({ date: dStr, user_Id: emp.user_Id, amount: val });
        }
      });

      // Update the employeeList state so future projections (EST) show the new rate
      // and so that "Save Table" will update the User Table in the DB.
      setEmployeeList(prev => prev.map(e => 
        e.key === empKey ? { ...e, expectedDeduction: val } : e
      ));

      return newData.sort((a, b) => a.date.localeCompare(b.date));
    });

    setEditingCell(null);

    // Auto-sync in real-time
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
        }
      } catch (err) {
        console.error("Auto-sync failed:", err);
        setToast({ message: "Failed to save to database", type: "error" });
      } finally {
        setTimeout(() => setSyncingCell(null), 800); 
      }
    } else {
      setSyncingCell(null);
    }
  };

  const dismissToast = () => setToast({ message: "", type: "success" });

  const saveSettings = async () => {
    try {
      setLoading(true);
      // 1. Save System Settings (Dates & Global Rates)
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

      // 2. Save Employee Base Deductions
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
        alert("Maxicare configuration and employee deductions saved!");
      }
    } catch (err) {
      alert("Error saving settings");
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
        alert("Payroll records updated successfully!");
        fetchData();
      } else {
        const err = await res.json();
        alert("Error syncing: " + (err.error || "Unknown error"));
      }
    } catch (err) {
      alert("Failed to sync with server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Computed Values
  const subscriberCount = employeeList.filter(emp => emp.expectedDeduction > 0).length;
  const annualPremiumTotal = config.totalGross * subscriberCount;
  const employerShare = config.totalGross / 2;
  const employeeShare = config.totalGross / 2;
  const deductionCutoff = config.monthsToPay > 0 ? (config.totalGross / 2) / (config.monthsToPay * 2) : 0;

  // Group dates by month for the "row above" header
  const groupedMonths = expectedDates.reduce((acc, dateStr) => {
    const date = new Date(dateStr);
    const monthLabel = date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }).toUpperCase();
    const last = acc[acc.length - 1];
    if (last && last.label === monthLabel) {
      last.colspan += 1;
    } else {
      acc.push({ label: monthLabel, colspan: 1 });
    }
    return acc;
  }, []);

  // Calculate Renewal Period dynamically based on Cycle Start
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
    if (!file) return alert("Please select a file first");
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
        alert("CSV Processed Successfully");
      } catch (err) {
        alert("Error parsing CSV. Please ensure it follows the template.");
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const currentCutoffDate = systemToday 
    ? expectedDates.find(d => d >= new Date(systemToday).toISOString().split('T')[0])
    : null;

  return (
    <div className="maxicare">
      <Sidebar />
      <div className="maxicareContainer">
        <Navbar />
        {toast.message && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={dismissToast}
          />
        )}
        
        <div className="header-wrapper">
          <div className="top">
            <div className="title-area">
              <h1>Maxicare Management</h1>
              <div className="year-selector">
                <FilterListIcon className="filter-icon" />
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                  <option value="2025">Fiscal Year 2025</option>
                  <option value="2026">Fiscal Year 2026</option>
                </select>
                {isAdmin && (
                  <button 
                    className={`edit-config-btn ${isEditing ? 'active' : ''}`}
                    onClick={() => isEditing ? saveSettings() : setIsEditing(true)}
                    disabled={loading}
                  >
                    {isEditing ? <><CheckIcon /> Save Config</> : <><EditIcon /> Edit Rates</>}
                  </button>
                )}
              </div>
            </div>
            <div className="upload-section">
              <button className="template-btn" onClick={downloadTemplate}>
                <DownloadIcon /> Template
              </button>
              <input type="file" accept=".csv" onChange={handleFileChange} id="csv-upload" style={{display: 'none'}} />
              <label htmlFor="csv-upload" className="upload-btn">
                <CloudUploadIcon /> {file ? file.name : "Choose CSV"}
              </label>
              <button className="process-btn" onClick={handleUpload} disabled={loading}>
                {loading ? "Processing..." : "Upload"}
              </button>
            </div>
          </div>

          <div className="summary-cards">
            <div className="card">
              <span className="label">ANNUAL PREMIUM (TOTAL)</span>
              <span className="val">{peso(annualPremiumTotal)}</span>
            </div>
            <div className="card">
              <span className="label"># OF EMPLOYEES</span>
              <span className="val">{subscriberCount}</span>
            </div>            <div className={`card highlight editable ${isEditing ? 'editing' : ''}`}>
              <span className="label">TOTAL GROSS</span>
              {isEditing ? (
                <input 
                  type="number" 
                  name="totalGross" 
                  value={config.totalGross} 
                  onChange={handleConfigChange}
                  autoFocus
                />
              ) : (
                <span className="val">{peso(config.totalGross)}</span>
              )}
            </div>
            <div className={`card editable ${isEditing ? 'editing' : ''}`}>
              <span className="label">MONTHS TO PAY</span>
              {isEditing ? (
                <input 
                  type="number" 
                  name="monthsToPay" 
                  value={config.monthsToPay} 
                  onChange={handleConfigChange}
                />
              ) : (
                <span className="val">{config.monthsToPay}</span>
              )}
            </div>
            <div className={`card editable ${isEditing ? 'editing' : ''}`}>
              <span className="label">CYCLE START DATE</span>
              {isEditing ? (
                <input 
                  type="date" 
                  name="cycleStartDate" 
                  value={config.cycleStartDate} 
                  onChange={handleConfigChange}
                />
              ) : (
                <span className="val">{new Date(config.cycleStartDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              )}
            </div>
            <div className="card highlight">
              <span className="label">EMPLOYER SHARE (50%)</span>
              <span className="val">{peso(employerShare)}</span>
            </div>
            <div className="card highlight">
              <span className="label">EMPLOYEE SHARE (50%)</span>
              <span className="val">{peso(employeeShare)}</span>
            </div>
            <div className="card">
              <span className="label">CUT-OFF DEDUCTION</span>
              <span className="val">{peso(deductionCutoff)}</span>
            </div>
            <div className="card renewal">
              <span className="label">RENEWAL PERIOD</span>
              <span className="val">{getRenewalPeriod()}</span>
            </div>
          </div>
        </div>

        <div className="content-body">
          <div className="table-header">
            <h3>Employee Deduction History ({selectedYear})</h3>
            <div className="actions">
              {isAdmin && (
                <button 
                  className={`edit-headers-btn ${isEditingTable ? 'active' : ''}`}
                  onClick={() => isEditingTable ? saveSettings() : setIsEditingTable(true)}
                  style={{ 
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: isEditingTable ? '#22c55e' : 'white',
                    color: isEditingTable ? 'white' : '#2a174e',
                    border: '1px solid #2a174e'
                  }}
                >
                  {isEditingTable ? <><CheckIcon /> Save Table</> : <><EditIcon /> Edit Table</>}
                </button>
              )}
              <button 
                className="save-btn" 
                onClick={syncHistory}
                disabled={loading}
              >
                <SaveIcon /> {loading ? "Updating..." : "Update Payroll"}
              </button>
              <button className="clear-btn" onClick={fetchData}><DeleteIcon /> Reset</button>
            </div>
          </div>
          
          <div className="table-container">
            <table className="pivoted-table">
              <thead>
                <tr className="row-1-months">
                  <th className="sticky-col">MONTH / DATE</th>
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
                  <tr>
                    <td colSpan={employeeList.length + 1} className="empty-msg">
                      Loading Maxicare data...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={employeeList.length + 1} className="empty-msg error">
                      <p>Error: {error}</p>
                      <button onClick={fetchData} className="retry-btn">Retry Fetching Data</button>
                    </td>
                  </tr>
                ) : expectedDates.length > 0 ? (
                  <>
                    {expectedDates.map((dateStr, i) => {
                      const dateObj = new Date(dateStr);
                      const monthLabel = dateObj.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
                      const dayLabel = dateObj.getDate();
                      
                      return (
                        <tr key={dateStr} className={dateStr === currentCutoffDate ? "current-row" : ""}>
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
                                {dateStr === currentCutoffDate && <div className="curr-tag">CURR</div>}
                              </>
                            )}
                          </td>
                          {employeeList.map((emp) => {                            // Find actual history
                            const actualRecord = data.find(d => {
                              const d1 = new Date(d.date).toISOString().split('T')[0];
                              const d2 = new Date(dateStr).toISOString().split('T')[0];
                              return d1 === d2;
                            });

                            let amount = 0;
                            let status = "unpaid";
                            let isProjection = false;

                            const userRate = parseFloat(emp.expectedDeduction) || 0;
                            const todayStr = systemToday ? new Date(systemToday).toISOString().split('T')[0] : "";

                            if (actualRecord && actualRecord.values[emp.key]) {
                              const record = actualRecord.values[emp.key];
                              if (record.status === 'paid') {
                                amount = record.amount;
                                status = 'paid';
                              } else {
                                // If status is estimated in DB, we use the User Table rate
                                // because the User Table is the source of truth for projections
                                amount = userRate;
                                status = 'estimated';
                                isProjection = true;
                              }
                            } else {
                              // No record in DB
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

                            return (
                              <td 
                                key={emp.key} 
                                className={`amt ${status} ${isEditing ? 'editing' : ''} ${isSyncing ? 'syncing' : ''}`}
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
                                    className="cell-edit-input"
                                  />
                                ) : isSyncing ? (
                                  <div className="sync-spinner">SAVING...</div>
                                ) : (
                                  <>
                                    {amount > 0 ? amount.toFixed(2) : "—"}
                                    {isProjection && amount > 0 && <div className="preview-tag">EST</div>}
                                  </>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    
                    {/* Per-Employee Summary Rows */}
                    <tr className="summary-row subtotal-row">
                      <td className="sticky-col label-cell">
                        <span className="summary-label">SUBTOTAL</span>
                      </td>
                      {employeeList.map((emp) => {
                        // Only count periods BEFORE the current cutoff
                        const historicalDates = currentCutoffDate 
                          ? expectedDates.filter(d => d < currentCutoffDate)
                          : expectedDates;

                        const empSubtotal = historicalDates.reduce((acc, dateStr) => {
                          const period = data.find(d => new Date(d.date).toISOString().split('T')[0] === new Date(dateStr).toISOString().split('T')[0]);
                          const val = (period && period.values[emp.key]) ? period.values[emp.key].amount : 0;
                          return acc + val;
                        }, 0);
                        return (
                          <td key={emp.key} className="amt total">
                            {empSubtotal.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="summary-row balance-row">
                      <td className="sticky-col label-cell">
                        <span className="summary-label">BALANCE</span>
                      </td>
                      {employeeList.map((emp) => {
                        const historicalDates = currentCutoffDate 
                          ? expectedDates.filter(d => d < currentCutoffDate)
                          : expectedDates;

                        const empSubtotal = historicalDates.reduce((acc, dateStr) => {
                          const period = data.find(d => new Date(d.date).toISOString().split('T')[0] === new Date(dateStr).toISOString().split('T')[0]);
                          const val = (period && period.values[emp.key]) ? period.values[emp.key].amount : 0;
                          return acc + val;
                        }, 0);

                        // Balance is Subtotal minus the total Employee Share for the whole cycle
                        const balance = empSubtotal - employeeShare;
                        return (
                          <td key={emp.key} className={`amt balance ${balance < 0 ? 'red' : ''}`}>
                            {balance.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={employeeList.length + 1} className="empty-msg">
                      No periods defined.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Maxicare;