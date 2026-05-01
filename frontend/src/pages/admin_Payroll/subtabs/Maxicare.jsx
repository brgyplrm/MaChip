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

const Maxicare = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1;

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
    console.log("[MAXICARE] Starting data fetch...");
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

        // Load custom dates if they exist, otherwise generate
        if (settingsData.maxicareDates && settingsData.maxicareDates.length > 0) {
          setExpectedDates(settingsData.maxicareDates);
        } else if (settingsData.maxicareCycleStartDate) {
          setExpectedDates(generateExpectedDates(settingsData.maxicareCycleStartDate, settingsData.maxicareMonthsToPay));
        }
      }

      // 2. Fetch Employees
      let empRes = await fetchWithAuth("/api/users/all");
      let employees = [];
      
      if (empRes.ok) {
        employees = await empRes.json();
      }

      if (!Array.isArray(employees)) {
        throw new Error("Could not retrieve employee list from server.");
      }
      
      // Participants: Those with a healthCard_Amnt defined (even if 0) and are active
      const participants = employees.filter(emp => emp.healthCard_Amnt !== null && emp.dailyRate > 0);

      const activeEmps = participants.map(emp => ({
        id: `MACJ-${String(emp.user_Id).padStart(3, "0")}`,
        name: `${emp.user_LastName || "Unknown"}, ${emp.user_FirstName || "User"}`,
        key: emp.user_Id.toString(),
        user_Id: emp.user_Id,
        expectedDeduction: emp.healthCard_Amnt || 0
      }));
      setEmployeeList(activeEmps);

      // 3. Fetch Maxicare History from Payroll
      try {
        console.log("[MAXICARE] Fetching history...");
        const historyRes = await fetchWithAuth("/api/payroll/maxicare/history");
        if (historyRes.ok) {
          const history = await historyRes.json();
          if (Array.isArray(history)) {
            const dateMap = {};
            history.forEach(item => {
              if (item.date && item.user_Id) {
                // Ensure date string is YYYY-MM-DD
                const dateKey = new Date(item.date).toISOString().split('T')[0];
                if (!dateMap[dateKey]) dateMap[dateKey] = {};
                dateMap[dateKey][item.user_Id.toString()] = parseFloat(item.amount);
              }
            });

            const matrix = Object.keys(dateMap).sort().map(date => ({
              date,
              values: dateMap[date]
            }));
            setData(matrix);
          }
        }
      } catch (histErr) {
        console.warn("[MAXICARE] History fetch failed:", histErr);
      }

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

  useEffect(() => {
    fetchData();
  }, []);

  // Computed Values
  const employeeCount = employeeList.length;
  const annualPremiumTotal = config.totalGross * employeeCount;
  const employerShare = config.totalGross / 2;
  const employeeShare = config.totalGross / 2;
  const deductionCutoff = config.monthsToPay > 0 ? (config.totalGross / 2) / (config.monthsToPay * 2) : 0;

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
            if (emp) values[emp.key] = item.amount;
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
              <span className="val">{employeeCount}</span>
            </div>
            <div className={`card highlight editable ${isEditing ? 'editing' : ''}`}>
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
              <button className="save-btn"><SaveIcon /> Update Payroll</button>
              <button className="clear-btn"><DeleteIcon /> Reset</button>
            </div>
          </div>
          
          <div className="matrix-table-container">
            <div className="table-responsive">
              <table className="pivoted-table">
                <thead>
                  <tr>
                    <th className="sticky-col employee-header">EMPLOYEE DETAILS</th>
                    {expectedDates.map((dateStr, i) => (
                      <th 
                        key={i} 
                        className={`${dateStr === currentCutoffDate ? "current-period" : ""} ${isEditingTable ? "editing-header" : ""}`}
                      >
                        {isEditingTable ? (
                          <input 
                            type="date" 
                            value={dateStr} 
                            onChange={(e) => handleHeaderChange(i, e.target.value)}
                            style={{ 
                              background: 'white', 
                              border: '1px solid #ddd', 
                              borderRadius: '4px', 
                              padding: '2px',
                              fontSize: '10px',
                              color: '#333',
                              width: '100%'
                            }}
                          />
                        ) : (
                          <>
                            {new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                            {dateStr === currentCutoffDate && <div className="curr-label">CURRENT</div>}
                          </>
                        )}
                      </th>
                    ))}
                    <th className="sticky-col-right total-col">SUB-TOTAL</th>
                    <th className="sticky-col-right balance-col">BALANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={expectedDates.length + 3} className="empty-msg">
                        Loading Maxicare data...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={expectedDates.length + 3} className="empty-msg error">
                        <p>Error: {error}</p>
                        <button onClick={fetchData} className="retry-btn">Retry Fetching Data</button>
                      </td>
                    </tr>
                  ) : employeeList.length > 0 ? (
                    <>
                      {employeeList.map((emp) => {
                        // Matrix lookup helper
                        const getVal = (dateStr) => {
                          const actual = data.find(d => {
                            const d1 = new Date(d.date).toISOString().split('T')[0];
                            const d2 = new Date(dateStr).toISOString().split('T')[0];
                            return d1 === d2;
                          });
                          
                          if (actual && actual.values[emp.key] > 0) {
                            return { amount: actual.values[emp.key], isPreview: false };
                          }

                          // If no actual record, and it's current or future, show preview
                          const todayStr = systemToday ? new Date(systemToday).toISOString().split('T')[0] : "";
                          if (dateStr >= todayStr) {
                             return { amount: emp.expectedDeduction, isPreview: true };
                          }
                          
                          return { amount: 0, isPreview: false };
                        };

                        // Subtotal only counts ACTUAL payments
                        const empSubtotal = expectedDates.reduce((acc, dateStr) => {
                          const { amount, isPreview } = getVal(dateStr);
                          return acc + (isPreview ? 0 : parseFloat(amount) || 0);
                        }, 0);

                        // Individual target: deduction * number of cutoffs
                        const expectedNum = parseFloat(emp.expectedDeduction) || 0;
                        const empTarget = expectedNum * config.monthsToPay * 2;
                        const balance = Math.max(0, empTarget - empSubtotal);
                        
                        return (
                          <tr key={emp.id}>
                            <td className="sticky-col employee-cell">
                              <div className="emp-info">
                                <span className="name">{emp.name}</span>
                                <span className="id">{emp.id}</span>
                              </div>
                            </td>
                            {expectedDates.map((dateStr, i) => {
                              const { amount, isPreview } = getVal(dateStr);
                              const amountNum = parseFloat(amount) || 0;
                              return (
                                <td 
                                  key={i} 
                                  className={`amt ${amountNum > 0 ? (isPreview ? 'preview' : 'paid') : 'unpaid'} ${dateStr === currentCutoffDate ? "current-period" : ""} ${isEditingTable && isPreview ? "editing-cell" : ""}`}
                                >
                                  {isEditingTable && isPreview ? (
                                    <input 
                                      type="number"
                                      value={amount}
                                      onChange={(e) => handleEmployeeDeductionChange(emp.user_Id, e.target.value)}
                                      style={{ 
                                        width: '100%', 
                                        border: 'none', 
                                        background: 'transparent', 
                                        textAlign: 'center',
                                        fontSize: '13px',
                                        color: '#64748b'
                                      }}
                                    />
                                  ) : (
                                    <>
                                      {amountNum > 0 ? amountNum.toFixed(2) : "—"}
                                      {isPreview && amountNum > 0 && <div className="preview-tag">EST</div>}
                                    </>
                                  )}
                                </td>
                              );
                            })}
                            <td className="sticky-col-right total-col bold">{empSubtotal.toFixed(2)}</td>
                            <td className="sticky-col-right balance-col bold red">{balance.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                      
                      <tr className="grand-total-row">
                        <td className="sticky-col label-cell">TOTAL PER CUT-OFF:</td>
                        {expectedDates.map((dateStr, i) => {
                          const isCurrentOrFuture = systemToday && dateStr >= new Date(systemToday).toISOString().split('T')[0];
                          
                          const cutoffTotal = employeeList.reduce((acc, emp) => {
                            // Find actual history for this specific date and employee
                            const period = data.find(d => {
                              const d1 = new Date(d.date).toISOString().split('T')[0];
                              const d2 = new Date(dateStr).toISOString().split('T')[0];
                              return d1 === d2;
                            });
                            
                            const actualVal = period ? (period.values[emp.key] || 0) : 0;
                            
                            // If no actual value but current/future, use expected
                            if (actualVal === 0 && isCurrentOrFuture) {
                               return acc + (parseFloat(emp.expectedDeduction) || 0);
                            }
                            return acc + actualVal;
                          }, 0);

                          const hasActualInColumn = data.some(d => new Date(d.date).toISOString().split('T')[0] === new Date(dateStr).toISOString().split('T')[0]);

                          return (
                            <td 
                              key={i} 
                              className={`amt bold ${dateStr === currentCutoffDate ? "current-period" : ""} ${!hasActualInColumn && isCurrentOrFuture ? "preview" : ""}`}
                            >
                              {cutoffTotal.toFixed(2)}
                              {!hasActualInColumn && isCurrentOrFuture && cutoffTotal > 0 && <div className="preview-tag">EST</div>}
                            </td>
                          );
                        })}
                        <td className="sticky-col-right total-col bold">
                          {employeeList.reduce((acc, emp) => {
                            const empActualPaid = expectedDates.reduce((accD, dateStr) => {
                              const period = data.find(d => {
                                const d1 = new Date(d.date).toISOString().split('T')[0];
                                const d2 = new Date(dateStr).toISOString().split('T')[0];
                                return d1 === d2;
                              });
                              return accD + (period ? (period.values[emp.key] || 0) : 0);
                            }, 0);
                            return acc + empActualPaid;
                          }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="sticky-col-right balance-col">
                          {employeeList.reduce((acc, emp) => {
                            const empActualPaid = expectedDates.reduce((accD, dateStr) => {
                              const period = data.find(d => {
                                const d1 = new Date(d.date).toISOString().split('T')[0];
                                const d2 = new Date(dateStr).toISOString().split('T')[0];
                                return d1 === d2;
                              });
                              return accD + (period ? (period.values[emp.key] || 0) : 0);
                            }, 0);
                            const empTarget = (parseFloat(emp.expectedDeduction) || 0) * config.monthsToPay * 2;
                            return acc + Math.max(0, empTarget - empActualPaid);
                          }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan={expectedDates.length + 3} className="empty-msg">
                        No employees found. Please ensure users are registered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Maxicare;
