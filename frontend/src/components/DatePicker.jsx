import React, { useState, useRef, useEffect } from "react";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";

/**
 * A functional, reusable DatePicker component styled with Tailwind CSS.
 * Uses native Date objects and no external date libraries.
 */
export const DatePicker = ({ 
  value, 
  onChange, 
  placeholder = "Select date", 
  className = "",
  label = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value || new Date());
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDateSelect = (day) => {
    const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    onChange(selectedDate);
    setIsOpen(false);
  };

  const changeMonth = (offset) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = viewDate.toLocaleString("default", { month: "long" });

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`blank-${i}`} className="h-8 w-8" />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isSelected = value && 
        d === value.getDate() && 
        month === value.getMonth() && 
        year === value.getFullYear();
      
      const isToday = 
        d === new Date().getDate() && 
        month === new Date().getMonth() && 
        year === new Date().getFullYear();

      days.push(
        <button
          key={d}
          type="button"
          onClick={() => handleDateSelect(d)}
          className={`h-8 w-8 flex items-center justify-center rounded-full text-xs font-bold transition-all
            ${isSelected ? "bg-brand-primary text-white shadow-md" : 
              isToday ? "bg-orange-100 text-[#ff6d00]" : "text-gray-600 hover:bg-gray-100"}`}
        >
          {d}
        </button>
      );
    }

    return (
      <div className="p-4 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <button type="button" onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-brand-primary">
            <ChevronLeftIcon fontSize="small" />
          </button>
          <span className="text-sm font-black text-brand-primary">{monthName} {year}</span>
          <button type="button" onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-brand-primary">
            <ChevronRightIcon fontSize="small" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="h-8 w-8 flex items-center justify-center text-[10px] font-black text-gray-300 uppercase tracking-widest">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-sm font-bold text-gray-600 mb-1 ml-1">{label}</label>}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-2xl cursor-pointer hover:border-brand-primary transition-all group"
      >
        <CalendarMonthIcon className="!text-[20px] text-gray-400 group-hover:text-brand-primary" />
        <span className={`text-sm font-medium flex-1 ${value ? "text-gray-900" : "text-gray-400"}`}>
          {value ? formatDate(value) : placeholder}
        </span>
        {value && (
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500"
          >
            <CloseIcon className="!text-[16px]" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-2 left-0 top-full">
          {renderCalendar()}
        </div>
      )}
    </div>
  );
};

/**
 * A reusable DateRangePicker component.
 */
export const DateRangePicker = ({ 
  value, 
  onChange, 
  placeholder = "Select date range",
  className = "" 
}) => {
  // value expected as { start: Date, end: Date }
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-brand-primary transition-all"
      >
        <CalendarMonthIcon className="text-gray-400 !text-[20px]" />
        <span className="text-[13px] font-bold text-gray-700">
          {value?.start && value?.end ? 
            `${formatDate(value.start)} - ${formatDate(value.end)}` : 
            placeholder}
        </span>
      </div>
      
      {/* For simplicity, this uses two DatePickers or a more complex range logic can be added */}
      {isOpen && (
        <div className="absolute z-50 mt-2 left-0 p-4 bg-white rounded-2xl shadow-2xl border border-gray-100 flex gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Start Date</span>
            <DatePicker 
              value={value?.start} 
              onChange={(date) => onChange({ ...value, start: date })} 
              className="w-48"
            />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">End Date</span>
            <DatePicker 
              value={value?.end} 
              onChange={(date) => onChange({ ...value, end: date })} 
              className="w-48"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
