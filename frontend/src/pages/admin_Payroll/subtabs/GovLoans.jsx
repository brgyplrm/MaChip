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
    const val = parseFloat(editValue);
    if (isNaN(val)) {
      setEditingCell(null);
      return;
    }

    const currentDbType = govTypes.find(t => t.id === activeTab)?.dbType;
    if (!currentDbType) return;

    setSyncingCell({ date, empKey });
    const updates = [{ date, user_Id: parseInt(empKey), amount: val, type: currentDbType }];

    setAllData(prev => {
      const typeData = [...(prev[activeTab] || [])];
      let recordIndex = typeData.findIndex(d => d.date === date);
      if (recordIndex === -1) {
        typeData.push({ date, values: { [empKey]: { amount: val, status: 'paid' } } });
      } else {
        typeData[recordIndex].values = { ...typeData[recordIndex].values, [empKey]: { amount: val, status: 'paid' } };
      }
      return { ...prev, [activeTab]: typeData.sort((a, b) => a.date.localeCompare(b.date)) };
    });

    setEditingCell(null);

    try {
      const res = await fetchWithAuth("/api/payroll/loans/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      if (res.ok) setToast({ message: `${currentDbType} updated!`, type: "success" });
    } catch (err) {
      setToast({ message: "Sync failed", type: "error" });
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
    a.download = `gov_loan_${activeTab}_template.csv`;
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
        
        // Find current tab config to get the correct type
        const currentType = govTypes.find(t => t.id === activeTab);
        if (!currentType) {
          setToast({ message: "Invalid tab selected", type: "error" });
          setLoading(false);
          return;
        }

        const updates = lines.slice(1).map(line => {
          const values = line.split(",");
          const macjId = values[1]?.trim();
          const userId = parseInt(macjId?.replace("MACJ-", ""));
          return {
            date: values[0]?.trim(),
            user_Id: userId,
            amount: parseFloat(values[3]?.trim() || 0),
            type: currentType.dbType // Using dbType from govTypes
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
          setToast({ message: `Successfully uploaded ${updates.length} records to ${currentType.label}!`, type: "success" });
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
      </div>
    );
  };

  const getSummaryStats = (typeId) => {
    const typeData = allData[typeId] || [];
    const subscribers = new Set();
    let totalPaid = 0;

    typeData.forEach(item => {
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
                  {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 4 + i).map(year => (
                    <option key={year} value={year} style={year === new Date().getFullYear() ? {fontWeight: 'bold', color: '#2563eb'} : {}}>
                      Fiscal Year {year} {year === new Date().getFullYear() ? "(Current)" : ""}
                    </option>
                  ))}
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
                <span className="label">TOTAL COLLECTED (${selectedYear})</span>
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
                              const typeData = allData[activeTab] || [];
                              const actualRecord = typeData.find(d => isInSamePeriod(d.date, dateStr));
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
                          const typeData = allData[activeTab] || [];
                          const empSubtotal = expectedDates.reduce((acc, dateStr) => {
                            const period = typeData.find(d => d.date === dateStr);
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
          )}
        </div>
      </div>
    </div>
  );
};

export default GovLoans;
