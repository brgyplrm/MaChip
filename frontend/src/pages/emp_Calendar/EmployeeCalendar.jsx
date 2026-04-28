import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useSystemTime } from "../../context/SystemTimeContext";

import InfoModal from "../../components/infoModal/InfoModal";
import { fetchWithAuth } from "../../utils/api";

const EmployeeCalendar = () => {
  const { systemToday } = useSystemTime();
  const [currentDate, setCurrentDate] = useState(new Date(systemToday.getFullYear(), systemToday.getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedHolidayWork, setSelectedHolidayWork] = useState(null);
  const [selectedFieldLog, setSelectedFieldLog] = useState(null);

  const handleHolidayClick = (holiday) => {
    // Find field work scheduled on the same date as the holiday
    const matchingWork = events.filter(e => 
      e.type === "Field Work" && 
      e.date.split('T')[0] === holiday.date.split('T')[0]
    );

    if (matchingWork.length > 0) {
      setSelectedHolidayWork({ holiday, matchingWork });
    }
  };

  const handleFieldWorkClick = (fieldWork) => {
    // In a real app, you might fetch specific logs here
    setSelectedFieldLog(fieldWork);
  };

  const userData = JSON.parse(localStorage.getItem("userData") || "{}");
  const userId = userData.user_Id;

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();

  const fetchCalendarEvents = async () => {
    setLoading(true);
    try {
      // Fetch for the whole year
      const firstDay = `${year}-01-01`;
      const lastDay = `${year}-12-31`;
      
      const response = await fetchWithAuth(`/api/request/calendar-report?startDate=${firstDay}&endDate=${lastDay}&user_Id=${userId}`);
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

  useEffect(() => {
    if (userId) fetchCalendarEvents();
  }, [currentDate, userId]);

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  // Grid Logic
  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  // Helper to get events for a specific day
  const getEventsForDay = (day) => {
    const targetDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    return events.filter(e => {
      if (!e.date) return false;
      const startDateStr = e.date.split('T')[0];
      
      // For single day events (Holidays, OT, On-field Work if endDate is null)
      if (!e.endDate) {
        return startDateStr === targetDateStr;
      }
      
      // For range events (Leaves, On-field Work)
      const endDateStr = e.endDate.split('T')[0];
      return targetDateStr >= startDateStr && targetDateStr <= endDateStr;
    });
  };

  return (
    <div className="flex w-full min-h-screen bg-[#fdfaf5]">
      <Sidebar />
      <div className="flex-[6]">
        <Navbar />
        <div className="p-[30px]">
          <div className="mb-[25px]">
            <div className="title">
              <h1 className="text-[24px] text-[#2A174E] font-bold m-0">My Calendar</h1>
              <span className="text-[#888] text-[14px]">View holidays, approved leaves, and assignments</span>
            </div>
          </div>

          <div className="bg-white p-[15px] rounded-[12px] flex gap-[20px] mb-[25px] shadow-[0_4px_10px_rgba(0,0,0,0.03)] flex-wrap">
            <div className="flex items-center gap-[8px] text-[13px] text-[#555]"><span className="w-[12px] h-[12px] rounded-[3px] bg-[#fee2e2] border border-[#fca5a5]"></span> Legal Holiday</div>
            <div className="flex items-center gap-[8px] text-[13px] text-[#555]"><span className="w-[12px] h-[12px] rounded-[3px] bg-[#f3e8ff] border border-[#d8b4fe]"></span> Special Holiday</div>
            <div className="flex items-center gap-[8px] text-[13px] text-[#555]"><span className="w-[12px] h-[12px] rounded-[3px] bg-[#dcfce7] border border-[#86efac]"></span> My Approved Leave</div>
            <div className="flex items-center gap-[8px] text-[13px] text-[#555]"><span className="w-[12px] h-[12px] rounded-[3px] bg-[#ffedd5] border border-[#fdba74]"></span> My Field Work</div>
            <div className="flex items-center gap-[8px] text-[13px] text-[#555]"><span className="w-[12px] h-[12px] rounded-[3px] bg-[#e0f2fe] border border-[#7dd3fc]"></span> My Overtime</div>
          </div>

          <div className="flex gap-[25px] items-start mt-[20px]">
            <div className="flex-[2.5]">
              <div className="bg-white rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                <div className="bg-gradient-to-r from-[#ff9800] to-[#ffb74d] text-white flex justify-between items-center px-[30px] py-[15px]">
                  <ChevronLeftIcon className="cursor-pointer" onClick={() => changeMonth(-1)} />
                  <h2 className="text-[20px] m-0 font-semibold">{`${monthName} ${year}`}</h2>
                  <ChevronRightIcon className="cursor-pointer" onClick={() => changeMonth(1)} />
                </div>
                <div>
                  <div className="grid grid-cols-7 bg-[#f8f9fa] border-b border-[#eee]">
                    <span className="p-[15px] text-center font-bold text-[#555]">Sun</span>
                    <span className="p-[15px] text-center font-bold text-[#555]">Mon</span>
                    <span className="p-[15px] text-center font-bold text-[#555]">Tue</span>
                    <span className="p-[15px] text-center font-bold text-[#555]">Wed</span>
                    <span className="p-[15px] text-center font-bold text-[#555]">Thu</span>
                    <span className="p-[15px] text-center font-bold text-[#555]">Fri</span>
                    <span className="p-[15px] text-center font-bold text-[#555]">Sat</span>
                  </div>
                  <div className="grid grid-cols-7">
                    {blanks.map(b => <div key={`blank-${b}`} className="h-[110px] border border-[#f0f0f0] p-[10px]"></div>)}
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

                      let cellClass = "h-[110px] border border-[#f0f0f0] p-[10px] transition-colors duration-300";
                      if (isToday) cellClass += " !bg-[#fff9db] border-2 border-[#ff8c00] relative after:content-['TODAY'] after:absolute after:top-[16px] after:right-[4px] md:after:right-[45px] after:text-[8px] after:font-extrabold after:text-[#ff8c00] after:tracking-[0.5px]";
                      if (hasLeave) cellClass += " bg-[rgba(220,252,231,0.3)]";
                      else if (hasField) cellClass += " bg-[rgba(255,237,213,0.3)]";
                      else if (hasOt) cellClass += " bg-[rgba(224,242,254,0.3)]";
                      else if (hasHoliday) cellClass += " bg-[rgba(254,226,226,0.2)]";

                      return (
                        <div key={d} className={cellClass}>
                          <span className={`block font-bold ${isToday ? "bg-[#ff8c00] text-white w-[24px] h-[24px] rounded-full flex items-center justify-center mx-auto mb-[15px]" : "mb-[5px]"}`}>
                            {d}
                          </span>
                          {dayEvents.map((e, i) => {
                            let typeClass = "";
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
                              <div key={i} className={`text-[10px] p-[4px] rounded-[4px] mt-[4px] whitespace-nowrap overflow-hidden text-ellipsis ${typeClass}`}>
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

            <div className="flex-1 flex flex-col gap-[20px]">
              <div className="bg-white p-[25px] rounded-[20px]">
                <h3 className="text-[18px] text-[#2A174E] font-bold mb-[20px]">Upcoming Holidays</h3>
                <div className="listWrapper">
                  {events
                    .filter(e => {
                      if (e.type !== "Holiday") return false;
                      const eventDate = new Date(e.date);
                      return eventDate.getMonth() === monthIndex && eventDate.getFullYear() === year;
                    })
                    .slice(0, 6) // Limit to 6 upcoming holidays
                    .map((h, idx) => (
                      <div className="cursor-pointer transition-colors duration-200 flex justify-between p-[15px] bg-[#fdfdfd] my-[5px] border border-[#f0f0f0] rounded-[12px] hover:bg-[#f0ebfa] hover:border-[#2A174E] hover:duration-300" 
                            key={idx} 
                            onClick={() => handleHolidayClick(h)}>
                        <div className="info">
                          <p className="font-bold text-[#333] m-0">{h.name}</p>
                          <span className="text-[12px] text-[#777]">{new Date(h.date).toLocaleDateString()} • {h.details}</span>
                        </div>
                      </div>
                    ))}
                  {events.filter(e => {
                    const eventDate = new Date(e.date);
                    return e.type === "Holiday" && eventDate.getMonth() === monthIndex && eventDate.getFullYear() === year;
                  }).length === 0 && <p className="text-[#888] text-[14px]">No holidays this month.</p>}
                </div>
              </div>

              <div className="bg-white p-[25px] rounded-[20px]">
                <h3 className="text-[18px] text-[#2A174E] font-bold mb-[20px]">My Field Work Assignments</h3>
                <div className="listWrapper">
                  {events.filter(e => e.type === "Field Work").map((f, idx) => (
                    <div className="cursor-pointer transition-colors duration-200 flex justify-between p-[15px] bg-[#fdfdfd] my-[5px] border border-[#f0f0f0] rounded-[12px] hover:bg-[#f0ebfa] hover:border-[#2A174E] hover:duration-300" 
                          key={idx} 
                          onClick={() => handleFieldWorkClick(f)}>
                      <div className="info">
                        <p className="font-bold text-[#333] m-0">{f.details}</p>
                        <span className="text-[12px] text-[#777]">{f.date}</span>
                      </div>
                    </div>
                  ))}
                  {events.filter(e => e.type === "Field Work").length === 0 && <p className="text-[#888] text-[14px]">No field work assignments.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Holiday Conflict Modal */}
      <InfoModal 
        isOpen={!!selectedHolidayWork} 
        onClose={() => setSelectedHolidayWork(null)}
        title={`Field Work on ${selectedHolidayWork?.holiday.name}`}
      >
        <div className="conflictList">
          {selectedHolidayWork?.matchingWork.map((work, i) => (
            <div key={i} className="p-[12px] bg-[#fdfaf5] rounded-[8px] mb-[10px] text-[14px] leading-[1.6]">
              <strong>Location:</strong> {work.details} <br/>
              <strong>Assigned:</strong> {userData.user_FirstName} {userData.user_LastName}
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
        <div className="logSummary">
          <div className="flex justify-between mb-[10px] text-[14px]"><span className="font-bold text-[#666]">Date:</span> <span>{selectedFieldLog?.date}</span></div>
          <div className="flex justify-between mb-[10px] text-[14px]"><span className="font-bold text-[#666]">Task:</span> <span>{selectedFieldLog?.details}</span></div>
          <hr className="my-4 border-[#eee]" />
          <p className="text-[12px] italic text-[#22c55e] mt-[15px]">This assignment is automatically credited as 8 hours worked on-field.</p>
        </div>
      </InfoModal>
    </div>
  );
};

export default EmployeeCalendar;