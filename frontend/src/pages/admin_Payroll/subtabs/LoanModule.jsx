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
import DeleteIcon from '@mui/icons-material/Delete';

const LoanModule = ({ type }) => {
  const { systemToday } = useSystemTime();
  const [loading, setLoading] = useState(true);
  const [employeeList, setEmployeeList] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [data, setData] = useState([]);
  const [isEditingTable, setIsEditingTable] = useState(false);

  // Helper to get cutoff dates (using the same logic as Maxicare or fetching from settings)
  const fetchCutoffDates = async () => {
    try {
      const res = await fetchWithAuth("/api/system/settings");
      const settings = await res.json();
      if (res.ok && settings.maxicareDates) {
        setExpectedDates(settings.maxicareDates);
      } else {
        // Fallback or generate based on current year
        const dates = [];
        const year = new Date().getFullYear();
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
    try {
      await fetchCutoffDates();
      
      // Fetch Employees
      const empRes = await fetchWithAuth("/api/users/all");
      const employees = await empRes.json();
      
      // Fetch Loan Records for this type
      const historyRes = await fetchWithAuth(`/api/payroll/loans/history?type=${type}`);
      const history = await historyRes.json();

      const mappedEmps = employees.filter(e => e.dailyRate > 0).map(emp => ({
        user_Id: emp.user_Id,
        name: `${emp.user_LastName}, ${emp.user_FirstName}`,
        id: `MACJ-${String(emp.user_Id).padStart(3, "0")}`,
        key: emp.user_Id.toString()
      }));
      setEmployeeList(mappedEmps);

      if (Array.isArray(history)) {
        const dateMap = {};
        history.forEach(item => {
          const dKey = new Date(item.date).toISOString().split('T')[0];
          if (!dateMap[dKey]) dateMap[dKey] = {};
          dateMap[dKey][item.user_Id.toString()] = parseFloat(item.amount);
        });
        const matrix = Object.keys(dateMap).sort().map(date => ({
          date,
          values: dateMap[date]
        }));
        setData(matrix);
      }
    } catch (err) {
      console.error("Error fetching loan data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [type]);

  const currentCutoffDate = systemToday 
    ? expectedDates.find(d => d >= new Date(systemToday).toISOString().split('T')[0])
    : null;

  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  return (
    <div className="loanModule">
      <Sidebar />
      <div className="loanContainer">
        <Navbar />
        <div className="header-wrapper">
          <div className="top">
            <div className="title-area">
              <h1>{type} Management</h1>
              <div className="year-selector">
                <FilterListIcon className="filter-icon" />
                <select>
                  <option>Fiscal Year 2025</option>
                  <option>Fiscal Year 2026</option>
                </select>
              </div>
            </div>
            <div className="actions">
                <button 
                  className={`edit-headers-btn ${isEditingTable ? 'active' : ''}`}
                  onClick={() => setIsEditingTable(!isEditingTable)}
                >
                  {isEditingTable ? <><CheckIcon /> Save Matrix</> : <><EditIcon /> Edit Matrix</>}
                </button>
                <button className="save-btn"><SaveIcon /> Update Payroll</button>
            </div>
          </div>
        </div>

        <div className="content-body">
          <div className="matrix-table-container">
            <div className="table-responsive">
              <table className="pivoted-table">
                <thead>
                  <tr className="row-1-months">
                    <th className="sticky-col axis-label">Months</th>
                    {groupedMonths.map((m, i) => (
                      <th key={i} colSpan={m.colspan} className="month-group">
                        {m.label}
                      </th>
                    ))}
                    <th className="sticky-col-right summary-label">Sub total</th>
                    <th className="sticky-col-right summary-label">Balance</th>
                  </tr>
                  <tr className="row-2-details">
                    <th className="sticky-col axis-label">emp# emp name</th>
                    {expectedDates.map((dateStr, i) => {
                      const day = new Date(dateStr).getDate();
                      return (
                        <th key={i} className={dateStr === currentCutoffDate ? "current-period" : ""}>
                          <div className="day-val">
                            {day}
                            {dateStr === currentCutoffDate && <div className="curr-tag">CURR</div>}
                          </div>
                        </th>
                      );
                    })}
                    <th className="sticky-col-right"></th>
                    <th className="sticky-col-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={expectedDates.length + 3} className="empty-msg">Loading {type} data...</td></tr>
                  ) : employeeList.map((emp) => {
                    const empSubtotal = expectedDates.reduce((acc, dateStr) => {
                      const period = data.find(d => new Date(d.date).toISOString().split('T')[0] === new Date(dateStr).toISOString().split('T')[0]);
                      return acc + (period ? (period.values[emp.key] || 0) : 0);
                    }, 0);

                    return (
                      <tr key={emp.user_Id}>
                        <td className="sticky-col employee-cell">
                          <div className="emp-info">
                            <span className="name">{emp.name}</span>
                            <span className="id">{emp.id}</span>
                          </div>
                        </td>
                        {expectedDates.map((dateStr, i) => {
                          const period = data.find(d => new Date(d.date).toISOString().split('T')[0] === new Date(dateStr).toISOString().split('T')[0]);
                          const val = period ? (period.values[emp.key] || 0) : 0;
                          return (
                            <td key={i} className={`amt ${val > 0 ? 'paid' : 'unpaid'} ${dateStr === currentCutoffDate ? "current-period" : ""}`}>
                              {val > 0 ? val.toFixed(2) : "—"}
                            </td>
                          );
                        })}
                        <td className="sticky-col-right total-col bold">{empSubtotal.toFixed(2)}</td>
                        <td className="sticky-col-right balance-col bold red">0.00</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanModule;
