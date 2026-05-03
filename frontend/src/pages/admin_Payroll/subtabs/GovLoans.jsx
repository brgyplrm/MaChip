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
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import Toast from "../../../components/toast/Toast";
import { formatDateLocal, isInSamePeriod } from "../../../utils/formatTime";

const GovLoans = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1;

  const [activeTab, setActiveTab] = useState("summary"); // summary, sss_loan, pagibig_loan, multipurpose, calamity
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState(null);
  
  const [employeeList, setEmployeeList] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [allData, setAllData] = useState({}); // type -> matrix
  
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
    
    // Treat empty string as 0
    const val = sanitizedValue === "" ? 0 : parseFloat(sanitizedValue);
    
    // Reset editing cell immediately
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
        fetchData(); // Rollback
      }
    } catch (err) {
      setToast({ message: "Sync failed", type: "error" });
      fetchData(); // Rollback
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
        
        // Find current tab config to get the correct type
        const currentType = govTypes.find(t => t.id === activeTab);
        if (!currentType) {
          setToast({ message: "Invalid tab selected", type: "error" });
          setLoading(false);
          return;
        }

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
      <div className="summary-section" key={typeObj.id}>
        <div className="section-header">
          <h3>{typeObj.label} Summary</h3>
          <button onClick={() => setActiveTab(typeObj.id)}>View Details</button>
        </div>
        <div className="compact-table-wrapper">
          <table className="compact-table">
            <thead>
              <tr>
                <th className="sticky-col">Employee Name</th>
                {summaryDates.map(d => {
                  const dateObj = new Date(d);
                  return (
                    <th key={d} className={d === currentCutoffDate ? "current-col" : ""}>
                      {dateObj.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      {d === currentCutoffDate && <div className="curr-label">CURR</div>}
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
                  <tr key={emp.user_Id}>
                    <td className="sticky-col">{emp.name}</td>
                    {summaryDates.map(d => {
                      const record = typeData.find(item => item.date === d);
                      const amount = record?.values[emp.key]?.amount || 0;
                      return (
                        <td key={d} className={`amt ${amount > 0 ? 'paid' : 'unpaid'} ${d === currentCutoffDate ? "current-col" : ""}`}>
                          {parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      );                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
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
    <div className="loanModule govLoans">
      <Sidebar />
      <div className="loanContainer">
        <Navbar />
        {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:"", type:"success"})} />}
        
        <div className="header-wrapper">
          <div className="top">
            <div className="title-area">
              <h1>Governmental Loans</h1>
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
                {activeTab !== "summary" && (
                  <>
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
                  </>
                )}
                <button className={`edit-headers-btn ${isEditingTable ? 'active' : ''}`} onClick={() => setIsEditingTable(!isEditingTable)}>
                  {isEditingTable ? <><CheckIcon /> Save Matrix</> : <><EditIcon /> Edit Matrix</>}
                </button>
                <button className="save-btn" onClick={fetchData} disabled={loading}>
                  <SaveIcon /> {loading ? "Updating..." : "Refresh Data"}
                </button>
            </div>
          </div>

          {activeTab !== "summary" && (
            <div className="summary-cards">
              <div className="card highlight">
                <span className="label">LOAN TYPE</span>
                <span className="val">{govTypes.find(t => t.id === activeTab)?.label}</span>
              </div>
              <div className="card">
                <span className="label">ACTIVE SUBSCRIBERS</span>
                <span className="val">{activeStats.subscribers}</span>
              </div>
              <div className="card highlight">
                <span className="label">TOTAL COLLECTED ({selectedYear})</span>
                <span className="val">{peso(activeStats.totalPaid)}</span>
              </div>
              <div className="card">
                <span className="label">FISCAL YEAR</span>
                <span className="val">{selectedYear}</span>
              </div>
            </div>
          )}

          <div className="tab-navigation">
            <button className={activeTab === "summary" ? "active" : ""} onClick={() => {setActiveTab("summary"); setIsEditingTable(false);}}>
              <DashboardIcon /> Summary
            </button>
            {govTypes.map(type => (
              <button key={type.id} className={activeTab === type.id ? "active" : ""} onClick={() => {setActiveTab(type.id); setIsEditingTable(false);}}>
                <AccountBalanceIcon /> {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="content-body">
          {activeTab === "summary" ? (
            <div className="summary-dashboard">
              {govTypes.map(type => renderSummaryTable(type))}
            </div>
          ) : (
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
                    <th className="sticky-col-right level-1">
                      <div className="vertical-stack">
                        <span className="year">SUB</span>
                        <span className="label">TOTAL</span>
                      </div>
                    </th>
                    <th className="sticky-col-right level-2">
                      <div className="vertical-stack">
                        <span className="year">MONTHLY</span>
                        <span className="label">TOTAL</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={employeeList.length + 3} className="empty-msg">Loading data...</td></tr>
                  ) : expectedDates.length > 0 ? (
                    <>
                    {(() => {
                      const typeData = allData[activeTab] || [];
                      const rowTotals = {};
                      expectedDates.forEach(dStr => {
                        const period = typeData.find(d => isInSamePeriod(d.date, dStr));
                        rowTotals[dStr] = period ? Object.values(period.values).reduce((acc, v) => acc + (v.amount || 0), 0) : 0;
                      });

                      const getMonthlyTotal = (dStr) => {
                        const date = new Date(dStr);
                        const m = date.getMonth();
                        const y = date.getFullYear();

                        // Check if this is the last expected date for this month in the current fiscal year
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
                        const isCurrent = dateStr === currentCutoffDate;
                        
                        const rowTotal = rowTotals[dateStr] || 0;
                        const monthlyTotal = getMonthlyTotal(dateStr);

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
                              const actualRecord = typeData.find(d => isInSamePeriod(d.date, dateStr));
                              const record = actualRecord ? actualRecord.values[emp.key] : null;
                              const amount = record ? record.amount : 0;
                              const isEditing = editingCell?.date === dateStr && editingCell?.empKey === emp.key;
                              const isSyncing = syncingCell?.date === dateStr && syncingCell?.empKey === emp.key;

                              const statusClass = amount > 0 ? 'paid' : (record ? 'removed' : 'unpaid');

                              return (
                                <td key={emp.key} className={`amt ${statusClass} ${isEditing ? 'editing' : ''} ${isSyncing ? 'syncing' : ''}`} onDoubleClick={() => handleCellDoubleClick(dateStr, emp.key, amount)}>
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
                                      className="cell-edit-input" 
                                    />
                                  ) : isSyncing ? (
                                    <div className="sync-spinner">SAVING...</div>
                                  ) : (
                                    parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                  )}
                                </td>
                              );
                            })}
                            <td className="sticky-col-right level-1">
                              {parseFloat(rowTotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="sticky-col-right level-2">
                              {monthlyTotal !== null 
                                ? parseFloat(monthlyTotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                : ""}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                      <tr className="summary-row subtotal-row">
                        <td className="sticky-col label-cell"><span className="summary-label">TOTAL PAID ({selectedYear})</span></td>
                        {employeeList.map((emp) => {
                          const typeData = allData[activeTab] || [];
                          const empSubtotal = expectedDates.reduce((acc, dateStr) => {
                            const period = typeData.find(d => isInSamePeriod(d.date, dateStr));
                            return acc + (period?.values[emp.key]?.amount || 0);
                          }, 0);
                          return <td key={emp.key} className="amt total">{parseFloat(empSubtotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>;
                        })}
                        <td className="sticky-col-right level-1 final-total">
                          {(() => {
                             const typeData = allData[activeTab] || [];
                             const stats = expectedDates.reduce((acc, dateStr) => {
                               const period = typeData.find(d => isInSamePeriod(d.date, dateStr));
                               return acc + (period ? Object.values(period.values).reduce((sum, v) => sum + (v.amount || 0), 0) : 0);
                             }, 0);
                             return parseFloat(stats).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          })()}
                        </td>
                        <td className="sticky-col-right level-2 final-total">
                          {/* Monthly total doesn't make sense for a whole year summary row, but we can show the same total */}
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
                      <tr className="summary-row all-time-row">
                        <td className="sticky-col label-cell"><span className="summary-label">TOTAL LOANS (ALL-TIME)</span></td>
                        {employeeList.map((emp) => {
                          const typeData = allData[activeTab] || [];
                          const totalLoans = typeData.reduce((acc, item) => acc + (item.values[emp.key]?.amount || 0), 0);
                          return <td key={emp.key} className="amt total">{parseFloat(totalLoans).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>;
                        })}
                        <td className="sticky-col-right level-1 all-time">
                          {(() => {
                             const typeData = allData[activeTab] || [];
                             const totalAllTime = typeData.reduce((acc, item) => acc + Object.values(item.values).reduce((sum, v) => sum + (v.amount || 0), 0), 0);
                             return parseFloat(totalAllTime).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          })()}
                        </td>
                        <td className="sticky-col-right level-2 all-time">
                          {(() => {
                             const typeData = allData[activeTab] || [];
                             const totalAllTime = typeData.reduce((acc, item) => acc + Object.values(item.values).reduce((sum, v) => sum + (v.amount || 0), 0), 0);
                             return parseFloat(totalAllTime).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          })()}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr><td colSpan={employeeList.length + 3} className="empty-msg">No periods defined.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GovLoans;
