import React, { useState, useEffect } from "react";
import "./loanModule.scss"; // Using shared loan styling
import Sidebar from "../../../components/sidebar/Sidebar";
import Navbar from "../../../components/navbar/Navbar";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import FilterListIcon from '@mui/icons-material/FilterList';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import SaveIcon from '@mui/icons-material/Save';
import Toast from "../../../components/toast/Toast";

const EastwestLoan = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1;

  const [toast, setToast] = useState({ message: "", type: "success" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [employeeList, setEmployeeList] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [data, setData] = useState([]);
  
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [syncingCell, setSyncingCell] = useState(null);

  const type = "Eastwest Loan";

  const fetchCutoffDates = async () => {
    try {
      const res = await fetchWithAuth("/api/system/settings");
      const settings = await res.json();
      if (res.ok && settings.maxicareDates) {
        setExpectedDates(settings.maxicareDates);
      } else {
        const dates = [];
        const year = selectedYear;
        for (let m = 0; m < 12; m++) {
          dates.push(`${year}-${String(m + 1).padStart(2, '0')}-15`);
          const lastDay = new Date(year, m + 1, 0).getDate();
          dates.push(`${year}-${String(m + 1).padStart(2, '0')}-${lastDay}`);
        }
        setExpectedDates(dates);
      }
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchCutoffDates();
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
          const dKey = new Date(item.date).toISOString().split('T')[0];
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

  const dismissToast = () => setToast({ message: "", type: "success" });

  const currentCutoffDate = systemToday 
    ? expectedDates.find(d => d >= new Date(systemToday).toISOString().split('T')[0])
    : null;

  return (
    <div className="loanModule">
      <Sidebar />
      <div className="loanContainer">
        <Navbar />
        {toast.message && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}
        
        <div className="header-wrapper">
          <div className="top">
            <div className="title-area">
              <h1>Eastwest Loan Management</h1>
              <div className="year-selector">
                <FilterListIcon className="filter-icon" />
                <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                  <option value="2025">Fiscal Year 2025</option>
                  <option value="2026">Fiscal Year 2026</option>
                </select>
              </div>
            </div>
            <div className="actions">
                <button className={`edit-headers-btn ${isEditingTable ? 'active' : ''}`} onClick={() => setIsEditingTable(!isEditingTable)}>
                  {isEditingTable ? <><CheckIcon /> Save Matrix</> : <><EditIcon /> Edit Matrix</>}
                </button>
                <button className="save-btn" onClick={fetchData} disabled={loading}>
                  <SaveIcon /> {loading ? "Updating..." : "Update Payroll"}
                </button>
            </div>
          </div>
        </div>

        <div className="content-body">
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
                  <tr><td colSpan={employeeList.length + 1} className="empty-msg">Loading Eastwest Loan data...</td></tr>
                ) : error ? (
                  <tr><td colSpan={employeeList.length + 1} className="empty-msg error">{error}</td></tr>
                ) : expectedDates.length > 0 ? (
                  <>
                    {expectedDates.map((dateStr) => {
                      const dateObj = new Date(dateStr);
                      return (
                        <tr key={dateStr} className={dateStr === currentCutoffDate ? "current-row" : ""}>
                          <td className="sticky-col date-label">
                            <span className="month">{dateObj.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}</span>
                            <span className="day">{dateObj.getDate()}</span>
                            {dateStr === currentCutoffDate && <div className="curr-tag">CURR</div>}
                          </td>
                          {employeeList.map((emp) => {
                            const actualRecord = data.find(d => new Date(d.date).toISOString().split('T')[0] === new Date(dateStr).toISOString().split('T')[0]);
                            const record = actualRecord ? actualRecord.values[emp.key] : null;
                            const amount = record ? record.amount : 0;
                            const isEditing = editingCell?.date === dateStr && editingCell?.empKey === emp.key;
                            const isSyncing = syncingCell?.date === dateStr && syncingCell?.empKey === emp.key;

                            return (
                              <td key={emp.key} className={`amt ${record ? 'paid' : 'unpaid'} ${isEditing ? 'editing' : ''} ${isSyncing ? 'syncing' : ''}`} onDoubleClick={() => handleCellDoubleClick(dateStr, emp.key, amount)}>
                                {isEditing ? (
                                  <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => handleCellSave(dateStr, emp.key)} onKeyDown={(e) => e.key === 'Enter' && handleCellSave(dateStr, emp.key)} autoFocus className="cell-edit-input" />
                                ) : isSyncing ? (
                                  <div className="sync-spinner">...</div>
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
                        const empSubtotal = expectedDates.reduce((acc, dateStr) => {
                          const period = data.find(d => new Date(d.date).toISOString().split('T')[0] === new Date(dateStr).toISOString().split('T')[0]);
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

export default EastwestLoan;
