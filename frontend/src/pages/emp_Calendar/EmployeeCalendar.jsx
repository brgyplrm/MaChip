import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EmployeeCalendar = () => {
  const { systemToday } = useSystemTime();
  const [currentDate, setCurrentDate] = useState(new Date(systemToday.getFullYear(), systemToday.getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedHolidayWork, setSelectedHolidayWork] = useState(null);
  const [selectedFieldLog, setSelectedFieldLog] = useState(null);

  const handleHolidayClick = (holiday) => {
    const matchingWork = events.filter(e => 
      e.type === "Field Work" && 
      e.date.split('T')[0] === holiday.date.split('T')[0]
    );

    if (matchingWork.length > 0) {
      setSelectedHolidayWork({ holiday, matchingWork });
    }
  };

  const handleFieldWorkClick = (fieldWork) => {
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

  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getEventsForDay = (day) => {
    const targetDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    return events.filter(e => {
      if (!e.date) return false;
      const startDateStr = e.date.split('T')[0];
      
      if (!e.endDate) {
        return startDateStr === targetDateStr;
      }
      
      const endDateStr = e.endDate.split('T')[0];
      return targetDateStr >= startDateStr && targetDateStr <= endDateStr;
    });
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 px-4 py-2 md:px-8 md:py-4 w-full max-w-7xl mx-auto overflow-x-hidden min-w-0">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">My Calendar</h1>
          <span className="text-sm text-slate-500 mt-1 block">View holidays, approved leaves, and assignments</span>
        </div>

        {/* Legend Card */}
        <Card className="mb-6 shadow-sm border-0 bg-white">
          <CardContent className="p-4 flex flex-wrap gap-4 sm:gap-6 items-center">
            <div className="flex items-center text-sm text-slate-600 font-medium">
              <div className="w-3 h-3 rounded-sm mr-2 bg-red-100 border border-red-300" /> Legal Holiday
            </div>
            <div className="flex items-center text-sm text-slate-600 font-medium">
              <div className="w-3 h-3 rounded-sm mr-2 bg-purple-100 border border-purple-300" /> Special Holiday
            </div>
            <div className="flex items-center text-sm text-slate-600 font-medium">
              <div className="w-3 h-3 rounded-sm mr-2 bg-green-100 border border-green-300" /> Approved Leave
            </div>
            <div className="flex items-center text-sm text-slate-600 font-medium">
              <div className="w-3 h-3 rounded-sm mr-2 bg-orange-100 border border-orange-300" /> Field Work
            </div>
            <div className="flex items-center text-sm text-slate-600 font-medium">
              <div className="w-3 h-3 rounded-sm mr-2 bg-blue-100 border border-blue-300" /> Overtime
            </div>
          </CardContent>
        </Card>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
          
          {/* Left Calendar Column */}
          <div className="lg:col-span-8">
            <Card className="overflow-hidden border-0 shadow-sm bg-white">
              <div className="bg-gradient-to-r from-orange-500 to-orange-400 text-white flex justify-between items-center p-4">
                <ChevronLeftIcon className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => changeMonth(-1)} />
                <h2 className="text-lg md:text-xl font-bold m-0">{`${monthName} ${year}`}</h2>
                <ChevronRightIcon className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => changeMonth(1)} />
              </div>
              
              <div className="bg-slate-100 p-[1px]">
                <div className="grid grid-cols-7 gap-[1px] mb-[1px]">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
                    <div key={idx} className="p-2 md:p-4 text-center font-semibold text-sm text-slate-600 bg-white">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-[1px]">
                  {blanks.map(b => (
                    <div key={`blank-${b}`} className="min-h-[80px] md:min-h-[110px] bg-slate-50/30 p-2" />
                  ))}
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

                    let bgClass = "bg-white hover:bg-slate-50";
                    if (hasLeave) bgClass = "bg-green-50/60 hover:bg-green-50";
                    else if (hasField) bgClass = "bg-orange-50/60 hover:bg-orange-50";
                    else if (hasOt) bgClass = "bg-blue-50/60 hover:bg-blue-50";
                    else if (hasHoliday) bgClass = "bg-red-50/60 hover:bg-red-50";
                    
                    if (isToday) bgClass = "bg-amber-50 hover:bg-amber-100 ring-2 ring-orange-500 ring-inset z-10";

                    return (
                      <div 
                        key={d} 
                        className={`min-h-[80px] md:min-h-[110px] p-1 md:p-2 transition-colors overflow-y-auto overflow-x-hidden flex flex-col relative ${bgClass}`}
                      >
                        <span className={`text-xs md:text-sm font-semibold mb-1 shrink-0 text-center md:text-left block ${
                          isToday ? "bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center mx-auto md:mx-0" : "text-slate-700"
                        }`}>
                          {d}
                        </span>

                        {dayEvents.map((e, i) => {
                          let typeClass = "bg-slate-100 text-slate-800"; 
                          if (e.type === "Holiday") {
                            typeClass = e.details.toLowerCase().includes("special") ? "bg-purple-100 text-purple-800" : "bg-red-100 text-red-800";
                          } else if (e.type === "Leave") {
                            typeClass = "bg-green-100 text-green-800";
                          } else if (e.type === "Field Work") {
                            typeClass = "bg-orange-100 text-orange-800";
                          } else if (e.type === "Overtime") {
                            typeClass = "bg-blue-100 text-blue-800";
                          }
                          
                          return (
                            <div key={i} className={`text-[9px] md:text-[10px] p-1 rounded mt-1 shrink-0 truncate w-full font-medium ${typeClass}`}>
                              {e.name || e.details}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>

          {/* Right Tables Column */}
          <div className="lg:col-span-4 flex flex-col gap-6 w-full">
            
            {/* Holidays List Card */}
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader className="pb-3 border-b border-slate-50 mb-2">
                <CardTitle className="text-lg text-[#2A174E]">Upcoming Holidays</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="max-h-[250px] overflow-y-auto pr-2 space-y-2">
                  {events
                    .filter(e => {
                      if (e.type !== "Holiday") return false;
                      const eventDate = new Date(e.date);
                      return eventDate.getMonth() === monthIndex && eventDate.getFullYear() === year;
                    })
                    .slice(0, 6)
                    .map((h, idx) => (
                      <div 
                        className="cursor-pointer transition-all flex flex-col justify-between p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-[#f0ebfa] hover:border-[#2A174E] hover:shadow-sm" 
                        key={idx} 
                        onClick={() => handleHolidayClick(h)}
                      >
                        <p className="font-bold text-slate-800 text-sm mb-1">{h.name}</p>
                        <span className="text-xs text-slate-500">
                          {new Date(h.date).toLocaleDateString()} • {h.details}
                        </span>
                      </div>
                    ))}
                  {events.filter(e => {
                    const eventDate = new Date(e.date);
                    return e.type === "Holiday" && eventDate.getMonth() === monthIndex && eventDate.getFullYear() === year;
                  }).length === 0 && <p className="text-sm text-slate-500 italic p-2">No holidays this month.</p>}
                </div>
              </CardContent>
            </Card>

            {/* Field Work List Card */}
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader className="pb-3 border-b border-slate-50 mb-2">
                <CardTitle className="text-lg text-[#2A174E]">My Field Work</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="max-h-[250px] overflow-y-auto pr-2 space-y-2">
                  {events.filter(e => e.type === "Field Work").length > 0 ? events.filter(e => e.type === "Field Work").map((f, idx) => (
                    <div 
                      className="cursor-pointer transition-all flex flex-col justify-between p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-[#f0ebfa] hover:border-[#2A174E] hover:shadow-sm" 
                      key={idx} 
                      onClick={() => handleFieldWorkClick(f)}
                    >
                      <p className="font-bold text-slate-800 text-sm mb-1">{f.details}</p>
                      <span className="text-xs text-slate-500 block">{f.date}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-500 italic p-2">No field work assignments.</p>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      {/* HOLIDAY CONFLICT DIALOG */}
      <Dialog open={!!selectedHolidayWork} onOpenChange={(open) => !open && setSelectedHolidayWork(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#2A174E]">Field Work on {selectedHolidayWork?.holiday.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            {selectedHolidayWork?.matchingWork.map((work, i) => (
              <div key={i} className="p-3 sm:p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                <strong className="block mb-1 font-bold text-amber-900">Location:</strong> {work.details} <br/>
                <strong className="block mt-2 mb-1 font-bold text-amber-900">Assigned:</strong> {userData.user_FirstName} {userData.user_LastName}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* FIELD WORK LOG DIALOG */}
      <Dialog open={!!selectedFieldLog} onOpenChange={(open) => !open && setSelectedFieldLog(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#2A174E]">Field Work Log Summary</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-slate-500">Date:</span> 
              <span className="text-slate-800 font-semibold">{selectedFieldLog?.date}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="font-bold text-slate-500">Task:</span> 
              <span className="text-slate-800 font-semibold text-right max-w-[60%]">{selectedFieldLog?.details}</span>
            </div>
            <div className="border-t border-slate-100 my-4"></div>
            <p className="text-xs italic text-green-600 bg-green-50 p-3 rounded-lg border border-green-100 text-center m-0">
              This assignment is automatically credited as 8 hours worked on-field.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      </Sidebar>
    </div>
  );
};

export default EmployeeCalendar;