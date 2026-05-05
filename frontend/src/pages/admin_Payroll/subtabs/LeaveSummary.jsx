import React, { useState, useEffect } from "react";
import "./leaveSummary.scss";
import Sidebar from "../../../components/Sidebar";
import { fetchWithAuth } from "../../../utils/api";
import { formatUserId } from "../../../utils/formatUserId";
import DownloadIcon from '@mui/icons-material/Download';

const LeaveSummary = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [months, setMonths] = useState([]);
  const [rates, setRates] = useState({ vlRate: 1.0, slRate: 1.0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuth(`/api/request/summary/${year}`);
        const result = await res.json();
        if (res.ok) {
          setData(result.data);
          setMonths(result.months);
          setRates({ vlRate: result.vlRate, slRate: result.slRate });
        }
      } catch (err) {
        console.error("Failed to fetch leave summary:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [year]);

  const SummaryTable = ({ title, type, showRemaining = false, showConversion = false }) => (
    <div className="summarySection">
      <div className="tableWrapper">
        <table>
          <thead>
            <tr>
              <th className="empInfo">{title}</th>
              {months.map(m => <th key={m} className="monthCol">{m}</th>)}
              <th className="totalCol">Total</th>
              {showRemaining && <th>Remaining (7 max)</th>}
              {showConversion && <th>Total Conversion</th>}
            </tr>
            <tr>
              <th className="empInfo subHeader">Employee Names</th>
              {months.map(m => <th key={m} className="monthCol"></th>)}
              <th className="totalCol"></th>
              {showRemaining && <th></th>}
              {showConversion && <th></th>}
            </tr>
          </thead>
          <tbody>
            {data.map(row => {
              const monthlyValues = row[type];
              const total = monthlyValues.reduce((a, b) => a + b, 0);
              const remaining = type === "vl" ? row.vlRemaining : row.slRemaining;
              const rate = type === "vl" ? rates.vlRate : rates.slRate;
              const conversionValue = remaining * rate;
              const conversion = conversionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

              return (
                <tr key={row.user_Id}>
                  <td className="empInfo">{formatUserId(row.user_Id)} {row.name}</td>
                  {monthlyValues.map((val, idx) => (
                    <td key={idx} className="monthCol">
                      <span className={`value ${val > 0 ? "nonzero" : "zero"}`}>
                        {val > 0 ? val : "—"}
                      </span>
                    </td>
                  ))}
                  <td className="totalCol">{total > 0 ? total : "—"}</td>
                  {showRemaining && <td className="totalCol">{remaining}</td>}
                  {showConversion && <td className="conversionCol">₱{conversion}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="leaveSummary">
      <Sidebar>
      <div className="summaryContainer">
        <div className="summaryWrapper">
          <div className="top">
            <h1>Leave & Attendance Summary</h1>
            <div className="filters">
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                {[...Array(5)].map((_, i) => (
                  <option key={i} value={new Date().getFullYear() - i}>
                    {new Date().getFullYear() - i}
                  </option>
                ))}
              </select>
              <button className="downloadBtn">
                <DownloadIcon /> Export PDF
              </button>
            </div>
          </div>

          {loading ? (
            <p>Loading summary data...</p>
          ) : (
            <div className="allSummaries">
              <SummaryTable title="Vacation Leaves" type="vl" showRemaining={true} showConversion={true} />
              <SummaryTable title="Sick Leaves" type="sl" showRemaining={true} showConversion={true} />
              <SummaryTable title="Overtime (Hours)" type="ot" />
              <SummaryTable title="Lates" type="lates" />
              <SummaryTable title="Absences" type="absences" />
            </div>
          )}
        </div>
      </div>
      </Sidebar>
    </div>
  );
};

export default LeaveSummary;
