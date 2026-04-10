import React, { useState, useEffect } from "react";
import "./createPeriodModal.scss";
import { useSystemTime } from "../../context/SystemTimeContext";

const CreatePeriodModal = ({ isOpen, onClose, onCreate }) => {
  const { systemToday } = useSystemTime();
  const [selectedOption, setSelectedOption] = useState("current"); // "current" or "next"
  const [options, setOptions] = useState({ current: null, next: null });

  useEffect(() => {
    if (!systemToday) return;

    const formatLocalISO = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formatDateRange = (start, end) => {
      return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    };

    const getLabel = (start, end) => {
      const monthName = start.toLocaleString('default', { month: 'long' });
      const dayRange = start.getDate() === 1 ? "1-15" : `16-${end.getDate()}`;
      return `${monthName} ${dayRange}, ${start.getFullYear()}`;
    };

    // Calculate Current Period
    let currentStart, currentEnd;
    const year = systemToday.getFullYear();
    const month = systemToday.getMonth();
    if (systemToday.getDate() <= 15) {
      currentStart = new Date(year, month, 1);
      currentEnd = new Date(year, month, 15);
    } else {
      currentStart = new Date(year, month, 16);
      currentEnd = new Date(year, month + 1, 0);
    }

    // Calculate Next Period
    let nextStart, nextEnd;
    if (currentStart.getDate() === 1) {
      nextStart = new Date(year, month, 16);
      nextEnd = new Date(year, month + 1, 0);
    } else {
      nextStart = new Date(year, month + 1, 1);
      nextEnd = new Date(year, month + 1, 15);
    }

    setOptions({
      current: {
        startDate: formatLocalISO(currentStart),
        endDate: formatLocalISO(currentEnd),
        periodText: formatDateRange(currentStart, currentEnd),
        label: getLabel(currentStart, currentEnd)
      },
      next: {
        startDate: formatLocalISO(nextStart),
        endDate: formatLocalISO(nextEnd),
        periodText: formatDateRange(nextStart, nextEnd),
        label: getLabel(nextStart, nextEnd)
      }
    });
  }, [systemToday]);

  if (!isOpen) return null;

  const currentSelection = selectedOption === "current" ? options.current : options.next;

  return (
    <div className="modalOverlay">
      <div className="modalContent">
        <h2>Create Payroll Period</h2>
        <p className="modalSubtext">Only the current and next periods can be scheduled manually.</p>
        
        <div className="optionSelector">
          <div 
            className={`optionCard ${selectedOption === "current" ? "active" : ""}`}
            onClick={() => setSelectedOption("current")}
          >
            <div className="radio"></div>
            <div className="text">
              <span className="type">Current Period</span>
              <span className="label">{options.current?.label}</span>
            </div>
          </div>

          <div 
            className={`optionCard ${selectedOption === "next" ? "active" : ""}`}
            onClick={() => setSelectedOption("next")}
          >
            <div className="radio"></div>
            <div className="text">
              <span className="type">Next Period</span>
              <span className="label">{options.next?.label}</span>
            </div>
          </div>
        </div>

        {currentSelection && (
          <div className="periodDisplay">
            <strong>Selected Range:</strong> {currentSelection.periodText}
          </div>
        )}

        <div className="modalActions">
          <button className="cancelBtn" onClick={onClose}>Cancel</button>
          <button 
            className="createBtn" 
            disabled={!currentSelection}
            onClick={() => onCreate(currentSelection)}
          >
            Create {selectedOption === "current" ? "Current" : "Next"} Period
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePeriodModal;