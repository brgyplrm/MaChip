import Sidebar from "../../components/Sidebar";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from '@mui/icons-material/Close';
import Toast from "../../components/toast/Toast";
import ActionModal from "../../components/actionModal/ActionModal";
import InfoModal from "../../components/infoModal/InfoModal";
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import { useState, useEffect } from "react";
import { formatUserId } from "../../utils/formatUserId";

const CalendarManagement = () => {
  // --- State Declarations ---
  const { systemToday } = useSystemTime();
  const [currentDate, setCurrentDate] = useState(new Date(systemToday.getFullYear(), systemToday.getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const monthIndex = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // Helper to get events for a specific day[cite: 8]
  const getEventsForDay = (day) => {
    const targetDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    return events.filter(e => {
      if (!e.date) return false;
      const startDateStr = e.date.split('T')[0];
      
      // For single day events (Holidays, OT, On-field Work if endDate is null)[cite: 8]
      if (!e.endDate) {
        return startDateStr === targetDateStr;
      }
      
      // For range events (Leaves, On-field Work)[cite: 8]
      const endDateStr = e.endDate.split('T')[0];
      return targetDateStr >= startDateStr && targetDateStr <= endDateStr;
    });
  };

  const handleDayClick = (day) => {
    const dayEvents = getEventsForDay(day);
    
    // Format the date nicely for the modal title (e.g., "Monday, April 15, 2026")[cite: 8]
    const dateObj = new Date(year, monthIndex, day);
    const formattedDate = dateObj.toLocaleDateString(undefined, { 
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
    });

    setSelectedDayDetails({
      date: formattedDate,
      events: dayEvents
    });
  };

  const initiateDelete = (id, type) => {
    setItemToDelete({ id, type });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const { id, type } = itemToDelete;
    
    // Choose endpoint based on type[cite: 8]
    const endpoint = type === 'Holiday' 
      ? `/api/system/holidays/${id}`
      : `/api/request/delete/${id}`;

    try {
      const response = await fetchWithAuth(endpoint, {
        method: "DELETE",
      });
      
      if (response.ok) {
        setEvents(prev => prev.filter((item) => item.id !== id || item.type !== type));
        setToast({ message: `${type} deleted successfully.`, type: "success" });
        fetchCalendarEvents(); // Refresh fully to be sure[cite: 8]
      } else {
        const result = await response.json();
        setToast({ message: result.error || "Failed to delete.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Could not connect to server.", type: "error" });
    } finally {
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  const userData = JSON.parse(localStorage.getItem("userData") || "{}");
  const isAdmin = userData.user_RoleId === 1;

  const [selectedHolidayWork, setSelectedHolidayWork] = useState(null);
  const [selectedFieldLog, setSelectedFieldLog] = useState(null);

  // 1. Logic for Holiday Clicks[cite: 8]
  const handleHolidayClick = (holiday) => {
    // Find field work scheduled on the same date as the holiday[cite: 8]
    const matchingWork = events.filter(e => 
      e.type === "Field Work" && 
      e.date.split('T')[0] === holiday.date.split('T')[0]
    );

    if (matchingWork.length > 0) {
      setSelectedHolidayWork({ holiday, matchingWork });
    }
  };

  // 2. Logic for Field Work Clicks[cite: 8]
  const handleFieldWorkClick = (fieldWork) => {
    // In a real app, you might fetch specific logs here[cite: 8]
    setSelectedFieldLog(fieldWork);
  };

  // Field Work Form State[cite: 8]
  const [fieldWorkForm, setFieldWorkForm] = useState({
    userId: "",
    date: "",
    location: "",
    hours: 8
  });

  // Holiday Form State[cite: 8]
  const [holidayForm, setHolidayForm] = useState({
    name: "",
    date: "",
    type: "Regular Holiday"
  });

  const handleHolidaySubmit = async (e) => {
    e.preventDefault();
    if (!holidayForm.name || !holidayForm.date) {
      setToast({ message: "Please fill in all fields.", type: "error" });
      return;
    }

    try {
      const response = await fetchWithAuth("/api/system/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: holidayForm.name,
          date: holidayForm.date,
          type: holidayForm.type
        }),
      });

      if (response.ok) {
        setToast({ message: "Holiday added successfully!", type: "success" });
        setModalType(null);
        setHolidayForm({ name: "", date: "", type: "Regular Holiday" });
        fetchCalendarEvents();
      } else {
        const err = await response.json();
        setToast({ message: err.error || "Failed to add holiday.", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Connection error.", type: "error" });
    }
  };

  const handleFieldWorkSubmit = async (e) => {
    e.preventDefault();
    if (!fieldWorkForm.userId || !fieldWorkForm.date || !fieldWorkForm.location) {
      setToast({ message: "Please fill in all fields.", type: "error" });
      return;
    }

    try {
      const response = await fetchWithAuth("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_Id: fieldWorkForm.userId,
          emp_reqTypeId: 2, // Onfield Work[cite: 8]
          emp_reqStatusId: 2, // Auto-approve[cite: 8]
          DateonField: fieldWorkForm.date,
          NoHrs: fieldWorkForm.hours,
          destination: fieldWorkForm.location,
          NoDays: 1,
          purpose: "Admin Assigned Field Work"
        }),
      });

      if (response.ok) {
        setToast({ message: "Field work assigned and email sent!", type: "success" });
        setModalType(null);
        setFieldWorkForm({ userId: "", date: "", location: "", hours: 8 });
        fetchCalendarEvents(); // Refresh[cite: 8]
      } else {
        const err = await response.json();
        setToast({ message: err.error || "Failed to assign field work.", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Connection error.", type: "error" });
    }
  };

  const fetchCalendarEvents = async () => {
    setLoading(true);
    try {
      const firstDay = `${year}-01-01`;
      const lastDay = `${year}-12-31`;
      const response = await fetchWithAuth(`/api/request/calendar-report?startDate=${firstDay}&endDate=${lastDay}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error("Error fetching calendar events:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetchWithAuth("/api/users/all");
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  useEffect(() => {
    fetchCalendarEvents();
    fetchEmployees();
  }, [currentDate]);

  // Navigation Logic for all months[cite: 8]
  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  // Logic to generate the calendar grid[cite: 8]
  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getUpcomingHolidays = () => {
    const todayStr = systemToday.toISOString().split('T')[0];
    return events
      .filter(h => h.type === "Holiday" && h.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  };


  return (
    <div className="flex min-h-screen bg-[#fdfaf5] overflow-x-hidden">
      <Sidebar />
      {/* SPACER FOR FIXED SIDEBAR */}
      <div className="hidden sm:block w-64 flex-shrink-0"></div>
      
      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0 pt-20">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        
        <div className="p-[30px] max-md:p-[15px] overflow-x-hidden w-full">
          
          {/* Header */}
          <div className="flex justify-between items-center mb-[25px] max-md:flex-col max-md:items-start max-md:gap-[15px]">
            <div>
              <h1 className="text-[28px] text-[#2A174E] font-bold m-0 max-[480px]:text-[22px]">Calendar Management</h1>
              <span className="text-[#555] text-[15px] mt-1 block max-[480px]:text-[13px]">
                Manage {isAdmin ? "holidays, leaves, and field work" : "field work assignments"}
              </span>
            </div>
            <div className="flex items-center gap-3 max-[480px]:w-full max-[480px]:flex-col">
              {isAdmin && (
                <button 
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#2A174E] text-white border-none rounded-xl font-semibold cursor-pointer transition-opacity duration-200 hover:opacity-90 max-[480px]:w-full"
                  onClick={() => setModalType('addHoliday')}
                >
                  <AddIcon /> Add Holiday
                </button>
              )}
              <button 
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#ff6d00] text-white border-none rounded-xl font-semibold cursor-pointer transition-opacity duration-200 hover:opacity-90 max-[480px]:w-full"
                onClick={() => setModalType('addFieldWork')}
              >
                <AddIcon /> Add Field Work
              </button>
            </div>
          </div>

          {/* Legend Card */}
          <div className="bg-white p-[15px] rounded-xl flex gap-5 flex-wrap mb-[25px] shadow-[0_4px_10px_rgba(0,0,0,0.03)] max-[480px]:gap-2.5 max-[480px]:p-2.5">
            <div className="flex items-center text-[#555] text-[13px] max-[480px]:text-[12px]">
              <span className="w-3 h-3 rounded-[3px] inline-block mr-2 bg-[#fee2e2] border border-[#fca5a5]"></span> Regular Holiday
            </div>
            <div className="flex items-center text-[#555] text-[13px] max-[480px]:text-[12px]">
              <span className="w-3 h-3 rounded-[3px] inline-block mr-2 bg-[#f3e8ff] border border-[#d8b4fe]"></span> Special Non-Working Holiday
            </div>
            <div className="flex items-center text-[#555] text-[13px] max-[480px]:text-[12px]">
              <span className="w-3 h-3 rounded-[3px] inline-block mr-2 bg-[#dcfce7] border border-[#86efac]"></span> Approved Leave
            </div>
            <div className="flex items-center text-[#555] text-[13px] max-[480px]:text-[12px]">
              <span className="w-3 h-3 rounded-[3px] inline-block mr-2 bg-[#ffedd5] border border-[#fdba74]"></span> Field Work
            </div>
            <div className="flex items-center text-[#555] text-[13px] max-[480px]:text-[12px]">
              <span className="w-3 h-3 rounded-[3px] inline-block mr-2 bg-[#e0f2fe] border border-[#7dd3fc]"></span> Overtime
            </div>
          </div>

          {/* Main Layout Split */}
          <div className="flex items-start gap-[25px] mt-5 max-lg:flex-col">
            
            {/* Left Calendar Column */}
            <div className="flex-[2.5] w-full">
              <div className="bg-white rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] m-0">
                <div className="bg-[linear-gradient(90deg,#ff9800,#ffb74d)] text-white flex justify-between items-center p-[15px_30px] max-[480px]:p-[15px]">
                  <ChevronLeftIcon className="cursor-pointer" onClick={() => changeMonth(-1)} />
                  <h2 className="text-[20px] font-bold m-0 max-[480px]:text-[16px]">{`${monthName} ${year}`}</h2>
                  <ChevronRightIcon className="cursor-pointer" onClick={() => changeMonth(1)} />
                </div>
                
                <div>
                  <div className="grid grid-cols-7 bg-[#f8f9fa] border-b border-[#eee]">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
                      <span key={idx} className="p-[15px] text-center font-bold text-[#555] max-[480px]:p-[8px_2px] max-[480px]:text-[11px]">
                        {day}
                      </span>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7">
                    {blanks.map(b => <div key={`blank-${b}`} className="min-h-[110px] max-[480px]:min-h-[85px] border border-[#f0f0f0] p-2.5 max-[480px]:p-[4px_2px]"></div>)}
                    {days.map(d => {
                      const dayEvents = getEventsForDay(d);
                      const hasLeave = dayEvents.some(e => e.type === "Leave");
                      const hasField = dayEvents.some(e => e.type === "Field Work");
                      const hasOt = dayEvents.some(e => e.type === "Overtime");
                      const hasHoliday = dayEvents.some(e => e.type === "Holiday");

                      const isToday = 
                        d === systemToday.getDate() && 
                        monthIndex === systemToday.getMonth() && 
                        year === systemToday.getFullYear();

                      // Background logic mapping
                      let bgClass = "bg-white";
                      if (hasLeave) bgClass = "bg-[#dcfce7]/30";
                      else if (hasField) bgClass = "bg-[#ffedd5]/30";
                      else if (hasOt) bgClass = "bg-[#e0f2fe]/30";
                      else if (hasHoliday) bgClass = "bg-[#fee2e2]/20";
                      
                      if (isToday) bgClass = "!bg-[#fff9db] border-2 !border-[#ff8c00]";

                      return (
                        <div 
                          key={d} 
                          className={`min-h-[110px] max-[480px]:min-h-[85px] border border-[#f0f0f0] p-2.5 max-[480px]:p-[4px_2px] transition-colors duration-300 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col cursor-pointer [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:bg-[#ddd] [&::-webkit-scrollbar-thumb]:rounded-[4px] relative ${bgClass}`}
                          onClick={() => handleDayClick(d)}
                        >
                          <span className={`block font-bold shrink-0 mb-[5px] max-[480px]:text-[12px] max-[480px]:mb-[2px] max-[480px]:text-center ${isToday ? "bg-[#ff8c00] text-white w-6 h-6 max-[480px]:w-5 max-[480px]:h-5 max-[480px]:text-[11px] max-[480px]:mb-3 rounded-full flex items-center justify-center mx-auto" : ""}`}>
                            {d}
                          </span>
                          
                          {isToday && (
                            <span className="absolute top-[37px] max-[480px]:top-[26px] left-1/2 -translate-x-1/2 text-[8px] max-[480px]:text-[6px] font-extrabold text-[#ff8c00] tracking-[0.5px]">
                              TODAY
                            </span>
                          )}

                          {dayEvents.map((e, i) => {
                            let typeClass = "bg-[#fee2e2] text-[#b91c1c]"; // legal
                            if (e.type === "Holiday") {
                              typeClass = e.details.toLowerCase().includes("special") ? "bg-[#f3e8ff] text-[#6b21a8]" : "bg-[#fee2e2] text-[#b91c1c]";
                            } else if (e.type === "Leave") {
                              typeClass = "bg-[#dcfce7] text-[#166534]";
                            } else if (e.type === "Field Work") {
                              typeClass = "bg-[#ffedd5] text-[#9a3412]";
                            } else if (e.type === "Overtime") {
                              typeClass = "bg-[#e0f2fe] text-[#0369a1]";
                            }
                            
                            return (
                              <div key={i} className={`text-[10px] p-1 rounded mt-1 shrink-0 whitespace-nowrap overflow-hidden text-ellipsis w-full max-[480px]:text-[8px] max-[480px]:p-[2px] max-[480px]:mt-[2px] ${typeClass}`}>
                                {e.name || e.details}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Tables Column */}
            <div className="flex-1 flex flex-col gap-5 w-full min-w-0">
              
              {/* Holidays List Card */}
              <div className="bg-white p-5 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] w-full box-border">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-[18px] text-[#2A174E] font-bold m-0">Upcoming Holidays</h3>
                </div>
                <div className="max-h-[250px] overflow-y-auto [&::-webkit-scrollbar]:w-1">
                  {getUpcomingHolidays().length > 0 ? getUpcomingHolidays().map((holiday, idx) => (
                    <div 
                      className="cursor-pointer transition-all duration-200 flex justify-between items-center p-[15px] max-[480px]:p-3 max-[480px]:items-start max-[480px]:flex-col bg-[#fdfdfd] border border-[#f0f0f0] rounded-xl w-full box-border mb-1 hover:bg-[#f0ebfa] hover:border-[#2A174E] hover:translate-x-[5px]" 
                      key={idx} 
                      onClick={() => handleHolidayClick(holiday)}
                    >
                      <div>
                        <p className="font-bold text-[#333] m-0">{holiday.name}</p>
                        <span className="text-[12px] text-[#777]">
                          {new Date(holiday.date).toLocaleDateString()} • {holiday.type}
                        </span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2.5 text-[#888] max-[480px]:w-full max-[480px]:justify-end max-[480px]:border-t max-[480px]:border-[#eee] max-[480px]:pt-2 mt-2 items-center">
                          <EditIcon className="cursor-pointer text-[20px] hover:text-[#2A174E]" onClick={() => setModalType('editHoliday')} />
                          <button 
                            className="bg-transparent border-none p-0 flex text-[#888] cursor-pointer hover:text-[#ef4444]" 
                            onClick={(e) => {
                              e.stopPropagation();
                              initiateDelete(holiday.id, 'Holiday');
                            }}
                          >
                            <DeleteIcon className="text-[20px]" />
                          </button>
                        </div>
                      )}
                    </div>
                  )) : (
                    <p className="text-center text-[#777] p-5 m-0">No upcoming holidays</p>
                  )}
                </div>
              </div>

              {/* Field Work List Card */}
              <div className="bg-white p-5 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] w-full box-border">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-[18px] text-[#2A174E] font-bold m-0">Field Work Assignments</h3>
                </div>
                <div className="max-h-[250px] overflow-y-auto [&::-webkit-scrollbar]:w-1">
                  {events.filter(e => e.type === "Field Work").length > 0 ? events.filter(e => e.type === "Field Work").map((field, idx) => (
                    <div 
                      className="cursor-pointer transition-all duration-200 flex justify-between items-center p-[15px] max-[480px]:p-3 max-[480px]:items-start max-[480px]:flex-col bg-[#fdfdfd] border border-[#f0f0f0] rounded-xl w-full box-border mb-1 hover:bg-[#f0ebfa] hover:border-[#2A174E] hover:translate-x-[5px]" 
                      key={idx} 
                      onClick={() => handleFieldWorkClick(field)}
                    >
                      <div>
                        <p className="font-bold text-[#333] m-0">{field.name}</p>
                        <span className="text-[12px] text-[#777] block">{field.date}</span>
                        <p className="text-[13px] text-[#555] mt-1 italic m-0">{field.details}</p>
                      </div>
                      <button 
                        className="bg-transparent border-none p-0 flex text-[#888] cursor-pointer hover:text-[#ef4444] max-[480px]:w-full max-[480px]:justify-end max-[480px]:border-t max-[480px]:border-[#eee] max-[480px]:pt-2 mt-2" 
                        onClick={(e) => {
                          e.stopPropagation();
                          initiateDelete(field.id, field.type);
                        }}
                      >
                        <DeleteIcon className="text-[20px]" />
                      </button>
                    </div>
                  )) : (
                    <p className="text-center text-[#777] p-5 m-0">No field work assignments this month</p>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Popup Modals */}
          {modalType && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-[4px] flex justify-center items-center z-[9999] p-5 box-border">
              <div className="bg-white w-full max-w-[450px] p-[30px] max-[480px]:p-5 rounded-[20px] shadow-[0_10px_25px_rgba(0,0,0,0.1)]">
                <div className="flex justify-between items-center mb-5 border-b border-[#eee] pb-[15px]">
                  <h2 className="text-[18px] text-[#2A174E] font-bold m-0">{modalType.includes('Holiday') ? (modalType.startsWith('add') ? 'Add' : 'Edit') + ' Holiday' : 'Add Field Work'}</h2>
                  <CloseIcon className="cursor-pointer text-[#888] hover:text-[#333]" onClick={() => setModalType(null)} />
                </div>
                <form onSubmit={modalType === 'addFieldWork' ? handleFieldWorkSubmit : handleHolidaySubmit}>
                  <div className="mb-[15px]">
                    <label className="block font-semibold mb-[5px] text-[14px] text-[#333]">{modalType === 'addFieldWork' ? 'Select Employee' : 'Holiday Name'}</label>
                    {modalType === 'addFieldWork' ? (
                      <select 
                        className="w-full p-2.5 border border-[#ddd] rounded-lg box-border outline-none focus:border-[#2A174E]"
                        value={fieldWorkForm.userId} 
                        onChange={(e) => setFieldWorkForm({...fieldWorkForm, userId: e.target.value})}
                        required
                      >
                        <option value="">Choose Employee...</option>
                        {employees.map(emp => (
                          <option key={emp.user_Id} value={emp.user_Id}>
                            {formatUserId(emp.user_Id)} - {emp.user_LastName} {emp.user_FirstName?.charAt(0)}.
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        className="w-full p-2.5 border border-[#ddd] rounded-lg box-border outline-none focus:border-[#2A174E]"
                        placeholder="Enter name" 
                        value={holidayForm.name}
                        onChange={(e) => setHolidayForm({...holidayForm, name: e.target.value})}
                        required
                      />
                    )}
                  </div>
                  <div className="mb-[15px]">
                    <label className="block font-semibold mb-[5px] text-[14px] text-[#333]">Date</label>
                    <input 
                      type="date" 
                      className="w-full p-2.5 border border-[#ddd] rounded-lg box-border outline-none focus:border-[#2A174E]"
                      value={modalType === 'addFieldWork' ? fieldWorkForm.date : holidayForm.date}
                      onChange={(e) => {
                        if (modalType === 'addFieldWork') {
                          setFieldWorkForm({...fieldWorkForm, date: e.target.value});
                        } else {
                          setHolidayForm({...holidayForm, date: e.target.value});
                        }
                      }}
                      required
                    />
                  </div>
                  {modalType.includes('Holiday') ? (
                    <div className="mb-[15px]">
                      <label className="block font-semibold mb-[5px] text-[14px] text-[#333]">Type</label>
                      <select 
                        className="w-full p-2.5 border border-[#ddd] rounded-lg box-border outline-none focus:border-[#2A174E]"
                        value={holidayForm.type}
                        onChange={(e) => setHolidayForm({...holidayForm, type: e.target.value})}
                      >
                        <option value="Regular Holiday" style={{ color: "#b91c1c" }}>
                          Regular Holiday
                        </option>
                        <option value="Special Holiday" style={{ color: "#6b21a8" }}>
                          Special Holiday
                        </option>
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="mb-[15px]">
                        <label className="block font-semibold mb-[5px] text-[14px] text-[#333]">Location</label>
                        <input 
                          type="text" 
                          className="w-full p-2.5 border border-[#ddd] rounded-lg box-border outline-none focus:border-[#2A174E]"
                          placeholder="e.g., Client Site A" 
                          value={fieldWorkForm.location}
                          onChange={(e) => setFieldWorkForm({...fieldWorkForm, location: e.target.value})}
                          required
                        />
                      </div>
                      <div className="mb-[15px]">
                        <label className="block font-semibold mb-[5px] text-[14px] text-[#333]">Hours</label>
                        <input 
                          type="number" 
                          className="w-full p-2.5 border border-[#ddd] rounded-lg box-border outline-none focus:border-[#2A174E]"
                          step="0.5"
                          value={fieldWorkForm.hours}
                          onChange={(e) => setFieldWorkForm({...fieldWorkForm, hours: e.target.value})}
                          required
                        />
                      </div>
                    </>
                  )}
                  <div className="flex gap-[15px] mt-5 max-[480px]:flex-col-reverse max-[480px]:gap-2.5">
                    <button type="button" className="flex-1 p-3 border border-[#ddd] bg-white rounded-lg cursor-pointer font-bold w-full" onClick={() => setModalType(null)}>Cancel</button>
                    <button type="submit" className={`flex-1 p-3 border-none rounded-lg cursor-pointer font-bold w-full text-white ${modalType === 'addFieldWork' ? 'bg-[#ff8c00]' : 'bg-[#2A174E]'}`}>
                      Submit
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <ActionModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={confirmDelete}
            variant="danger"
            title="Confirm Deletion"
            message="Are you sure you want to remove this calendar entry? This action cannot be undone."
          />

          {/* Holiday Conflict Modal */}
          <InfoModal 
            isOpen={!!selectedHolidayWork} 
            onClose={() => setSelectedHolidayWork(null)}
            title={`Field Work on ${selectedHolidayWork?.holiday.name}`}
          >
            <div className="w-full max-w-[450px]">
              {selectedHolidayWork?.matchingWork.map((work, i) => (
                <div key={i} className="p-3 bg-[#fdfaf5] rounded-lg mb-2.5 text-[14px] leading-[1.6]">
                  <strong className="text-[#333]">Location:</strong> {work.details} <br/>
                  <strong className="text-[#333]">Assigned:</strong> {userData.user_FirstName} {userData.user_LastName}
                </div>
              ))}
            </div>
          </InfoModal>

          {/* Field Work Log Modal */}
          <InfoModal 
            isOpen={!!selectedFieldLog} 
            onClose={() => setSelectedFieldLog(null)}
            title="Field Work Log Summary"
          >
            <div className="w-full max-w-[450px]">
              <div className="flex justify-between mb-2.5 text-[14px]">
                <span className="font-bold text-[#666]">Date:</span> 
                <span className="text-[#333]">{selectedFieldLog?.date}</span>
              </div>
              <div className="flex justify-between mb-2.5 text-[14px]">
                <span className="font-bold text-[#666]">Task:</span> 
                <span className="text-[#333]">{selectedFieldLog?.details}</span>
              </div>
              <hr className="border-[#eee] my-3" />
              <p className="text-[12px] italic text-[#22c55e] mt-[15px] m-0">This assignment is automatically credited as 8 hours worked on-field.</p>
            </div>
          </InfoModal>

          {/* Day Details Modal */}
          <InfoModal 
            isOpen={!!selectedDayDetails} 
            onClose={() => setSelectedDayDetails(null)}
            title={`Schedule for ${selectedDayDetails?.date}`}
          >
            <div className="w-full max-w-[450px]">
              {selectedDayDetails?.events.length > 0 ? (
                selectedDayDetails.events.map((event, idx) => {
                  let typeClass = "bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5]"; // legal
                  if (event.type === "Holiday") {
                    typeClass = event.details.toLowerCase().includes("special") ? "bg-[#f3e8ff] text-[#6b21a8] border-[#d8b4fe]" : "bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5]";
                  } else if (event.type === "Leave") typeClass = "bg-[#dcfce7] text-[#166534] border-[#86efac]";
                  else if (event.type === "Field Work") typeClass = "bg-[#ffedd5] text-[#9a3412] border-[#fdba74]";
                  else if (event.type === "Overtime") typeClass = "bg-[#e0f2fe] text-[#0369a1] border-[#7dd3fc]";

                  // Just grab the background part for the dot
                  const dotBg = typeClass.split(' ')[0];
                  const dotBorder = typeClass.split(' ')[2];

                  return (
                    <div key={idx} className={`p-3 rounded-lg mb-2.5 text-[14px] bg-opacity-30 ${typeClass}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-3 h-3 rounded-[3px] inline-block border ${dotBg} ${dotBorder}`}></span>
                        <strong className="font-bold">{event.type}</strong>
                      </div>
                      <p className="m-0 mt-1 font-semibold">{event.name || event.details}</p>
                      {event.type === "Field Work" && (
                        <p className="m-0 mt-1 text-[12px] opacity-80 italic">Automatically credited as 8 hours on-field.</p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-[#777] p-5">
                  <p className="m-0">No events or assignments scheduled for this day.</p>
                </div>
              )}
            </div>
          </InfoModal>

        </div>
      </main>
    </div>
  );
};

export default CalendarManagement;