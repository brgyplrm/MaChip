import React, { useState, useEffect } from "react";
import "./createPeriodModal.scss";

const CreatePeriodModal = ({ isOpen, onClose, onCreate }) => {
  const [month, setMonth] = useState("March");
  const [year, setYear] = useState("2026");
  const [periodText, setPeriodText] = useState("");

  // Dynamically calculate the period text
  useEffect(() => {
    const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    setPeriodText(`${month} 1, ${year} - ${month} ${lastDay}, ${year}`);
  }, [month, year]);

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

        <div className="periodDisplay">
          <strong>Period:</strong> {periodText}
        </div>

        <div className="modalActions">
          <button className="cancelBtn" onClick={onClose}>Cancel</button>
          <button className="createBtn" onClick={() => onCreate({ month, year, periodText })}>
            Create Period
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePeriodModal;