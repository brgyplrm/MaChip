import React, { useState, useEffect } from "react";
import "./createPeriodModal.scss";

const CreatePeriodModal = ({ isOpen, onClose, onCreate }) => {
  const [month, setMonth] = useState("March");
  const [year, setYear] = useState("2026");
  const [periodHalf, setPeriodHalf] = useState("1"); // "1" for 1st-15th, "2" for 16th-End
  const [periodText, setPeriodText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Dynamically calculate the period text
  useEffect(() => {
    const monthIndex = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ].indexOf(month);
    
    let start, end;
    if (periodHalf === "1") {
      start = new Date(year, monthIndex, 1);
      end = new Date(year, monthIndex, 15);
    } else {
      start = new Date(year, monthIndex, 16);
      end = new Date(year, monthIndex + 1, 0); // Last day of month
    }

    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    const formatLocalISO = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setStartDate(formatLocalISO(start));
    setEndDate(formatLocalISO(end));
    setPeriodText(`${formatDate(start)} - ${formatDate(end)}`);
  }, [month, year, periodHalf]);

  if (!isOpen) return null;

  return (
    <div className="modalOverlay">
      <div className="modalContent">
        <h2>Create Payroll Period</h2>
        
        <div className="formGroup">
          <label>Month</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {["January", "February", "March", "April", "May", "June", 
              "July", "August", "September", "October", "November", "December"
            ].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="formGroup">
          <label>Year</label>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
        </div>

        <div className="formGroup">
          <label>Period Half</label>
          <select value={periodHalf} onChange={(e) => setPeriodHalf(e.target.value)}>
            <option value="1">1st Half (1st - 15th)</option>
            <option value="2">2nd Half (16th - End)</option>
          </select>
        </div>

        <div className="periodDisplay">
          <strong>Period:</strong> {periodText}
        </div>

        <div className="modalActions">
          <button className="cancelBtn" onClick={onClose}>Cancel</button>
          <button className="createBtn" onClick={() => onCreate({ month, year, periodHalf, periodText, startDate, endDate })}>
            Create Period
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePeriodModal;