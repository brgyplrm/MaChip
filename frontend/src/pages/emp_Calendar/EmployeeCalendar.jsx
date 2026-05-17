import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import MapIcon from '@mui/icons-material/Map';
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import EmptyState from "@/components/EmptyState";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EmployeeCalendar = () => {
  const { systemToday } = useSystemTime();
  const [currentDate, setCurrentDate] = useState(new Date(systemToday.getFullYear(), systemToday.getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);

  const userData = JSON.parse(localStorage.getItem("userData") || "{}");

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const monthIndex = currentDate.getMonth();
  const year = currentDate.getFullYear();

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        // Fetch the entire year's events to populate the upcoming panels properly
        const firstDay = `${year}-01-01`;
        const lastDay = `${year}-12-31`;

        const response = await fetchWithAuth(`/api/request/report/calendar?startDate=${firstDay}&endDate=${lastDay}&user_Id=${userData?.user_Id}`);
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

    if (userData?.user_Id) {
      fetchEvents();
    }
  }, [year, userData?.user_Id]);

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

  const handleDayClick = (day) => {
    const dayEvents = getEventsForDay(day);
    const dateObj = new Date(year, monthIndex, day);
    const formattedDate = dateObj.toLocaleDateString(undefined, { 
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
    });

    setSelectedDayDetails({
      date: formattedDate,
      events: dayEvents
    });
  };

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const getUpcomingHolidays = () => {
    return events
      .filter(h => h.type === "Holiday")
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const getUpcomingMyEvents = () => {
    const todayStr = systemToday.toISOString().split('T')[0];
    return events
      .filter(e => (e.type === "Leave" || e.type === "Field Work") && e.date.split('T')[0] >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 mt-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">My Calendar</h1>
            <p className="text-muted-foreground text-sm mt-1">
              View upcoming holidays, your approved leaves, and scheduled field work assignments.
            </p>
          </div>
        </div>

        {/* Sleek Legend Banner */}
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 bg-white border border-slate-200 rounded-lg p-3 px-5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Legend</span>
          <div className="flex items-center text-sm font-medium text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full mr-2 bg-red-400 ring-4 ring-red-50" /> Regular Holiday
          </div>
          <div className="flex items-center text-sm font-medium text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full mr-2 bg-purple-400 ring-4 ring-purple-50" /> Special Holiday
          </div>
          <div className="flex items-center text-sm font-medium text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full mr-2 bg-orange-400 ring-4 ring-orange-50" /> Field Work
          </div>
          <div className="flex items-center text-sm font-medium text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full mr-2 bg-green-400 ring-4 ring-green-50" /> Approved Leave
          </div>
        </div>

        {/* Main Layout Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Calendar Column */}
          <div className="lg:col-span-8">
            <Card className="py-0 overflow-hidden border-0 shadow-sm bg-white">
              <div className="bg-[#2A174E] text-white flex justify-between items-center p-3 md:p-4 rounded-t-xl">
                <ChevronLeftIcon className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => changeMonth(-1)} />
                
                {/* Clickable Header for Date Picker */}
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity select-none group"
                  onClick={() => setIsDatePickerOpen(true)}
                  title="Jump to a specific date"
                >
                  <h2 className="text-lg md:text-xl font-bold">{`${monthName} ${year}`}</h2>
                  <CalendarMonthIcon className="h-5 w-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                </div>

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
                    <div key={`blank-${b}`} className="min-h-[80px] md:min-h-[120px] bg-slate-50/30 p-2" />
                  ))}
                  {days.map(d => {
                    const dayEvents = getEventsForDay(d);
                    const hasLeave = dayEvents.some(e => e.type === "Leave");
                    const hasField = dayEvents.some(e => e.type === "Field Work");
                    const hasHoliday = dayEvents.some(e => e.type === "Holiday");

                    const isToday = 
                      d === systemToday.getDate() && 
                      monthIndex === systemToday.getMonth() && 
                      year === systemToday.getFullYear();

                    let bgClass = "bg-white hover:bg-slate-50";
                    if (hasLeave) bgClass = "bg-green-50/60 hover:bg-green-50";
                    else if (hasField) bgClass = "bg-orange-50/60 hover:bg-orange-50";
                    else if (hasHoliday) bgClass = "bg-red-50/60 hover:bg-red-50";
                    
                    if (isToday) {
                      bgClass = "bg-[#2A174E]/30 hover:bg-[#2A174E]/100 ring-2 ring-[#BA90E9] ring-inset z-10 label";
                    }

                    return (
                      <div 
                        key={d} 
                        className={`min-h-[80px] md:min-h-[120px] p-1 md:p-2 transition-colors cursor-pointer overflow-y-auto overflow-x-hidden flex flex-col relative ${bgClass}`}
                        onClick={() => handleDayClick(d)}
                      >
                        <div className={`text-xs md:text-sm font-semibold mb-1 shrink-0 text-center md:text-left ${
                          isToday ? "bg-[#BA90E9] text-white w-6 h-6 rounded-full flex items-center justify-center mx-auto md:mx-0" : "text-slate-700"
                        }`}>
                          {d}
                        </div>

                        {dayEvents.map((e, i) => {
                          let typeClass = "bg-red-100 text-red-800"; 
                          if (e.type === "Holiday") {
                            typeClass = e.details?.toLowerCase().includes("special") ? "bg-purple-100 text-purple-800" : "bg-red-100 text-red-800";
                          } else if (e.type === "Leave") {
                            typeClass = "bg-green-100 text-green-800";
                          } else if (e.type === "Field Work") {
                            typeClass = "bg-orange-100 text-orange-800";
                          }
                          
                          return (
                            <div key={i} className={`text-[9px] md:text-[11px] p-1 rounded mt-1 shrink-0 truncate w-full font-medium ${typeClass}`} title={e.name || e.details}>
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

          {/* Right Side Cards */}
          <div className="lg:col-span-4 flex flex-col gap-6 w-full">
            
            {/* Holidays List Card */}
            <Card className="shadow-sm border-0 bg-white flex flex-col h-[320px] py-0 border-t-4 border-[#2A174E]">
              <CardHeader className="pb-0 pt-5">
                <CardTitle className="text-lg text-[#2A174E]">Holidays</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 flex-1 overflow-y-auto custom-scrollbar">
                {getUpcomingHolidays().length > 0 ? (
                  <div className="space-y-2 mt-2">
                    {getUpcomingHolidays().map((holiday, idx) => {
                      const isSpecial = holiday.type?.toLowerCase().includes("special") || holiday.details?.toLowerCase().includes("special");
                      const accentColor = isSpecial ? "border-l-purple-500" : "border-l-red-500";
                      
                      return (
                        <div 
                          className={`flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-slate-50 rounded-lg border border-l-4 ${accentColor}`} 
                          key={idx}
                        >
                          <div>
                            <p className="font-semibold text-sm text-slate-800">{holiday.name}</p>
                            <span className="text-xs text-muted-foreground">
                              {new Date(holiday.date).toLocaleDateString()} • {holiday.details || holiday.type}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState 
                      className="min-h-0 h-full w-full border-0 bg-transparent hover:bg-transparent shadow-none p-0"
                      icon={<EventAvailableIcon className="w-8 h-8 text-slate-300" />}
                      title="No Holidays"
                      description="There are no holidays registered for this period."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Field Work & Leaves List Card */}
            <Card className="shadow-sm border-0 bg-white flex flex-col h-[320px] py-0 border-t-4 border-[#FFB33D]">
              <CardHeader className="pb-0 pt-5">
                <CardTitle className="text-lg text-[#C97819]">My Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent className="px-4 flex-1 overflow-y-auto custom-scrollbar">
                {getUpcomingMyEvents().length > 0 ? (
                  <div className="space-y-2 mt-2">
                    {getUpcomingMyEvents().map((item, idx) => {
                      const isFieldWork = item.type === "Field Work";
                      const borderColor = isFieldWork ? "border-l-orange-500" : "border-l-green-500";
                      
                      return (
                        <div 
                          className={`flex flex-row justify-between items-center p-3 bg-slate-50 rounded-lg gap-3 border border-l-4 ${borderColor}`} 
                          key={idx} 
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-slate-800 truncate">{item.name || item.details || item.type}</p>
                            <span className="text-[11px] text-muted-foreground block truncate">
                              {new Date(item.date).toLocaleDateString()} • {item.type}
                            </span>
                            {isFieldWork && <p className="text-[11px] text-slate-500 mt-0.5 italic truncate">{item.details}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState 
                      className="min-h-0 h-full w-full border-0 bg-transparent hover:bg-transparent shadow-none p-0"
                      icon={<MapIcon className="w-8 h-8 text-slate-300" />}
                      title="No Tasks Found"
                      description="You currently have no upcoming leaves or field assignments scheduled."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>

        {/* DATE PICKER DIALOG */}
        <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <DialogContent className="sm:max-w-[300px]">
            <DialogHeader>
              <DialogTitle className="text-[#2A174E] text-lg font-bold text-center">Jump to Date</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-5 py-4">
              <div className="flex flex-col gap-2">
                <Label>Select Month</Label>
                <Select 
                  value={monthIndex.toString()} 
                  onValueChange={(val) => setCurrentDate(new Date(year, parseInt(val), 1))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                      <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Select Year</Label>
                <Select 
                  value={year.toString()} 
                  onValueChange={(val) => setCurrentDate(new Date(parseInt(val), monthIndex, 1))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 21 }, (_, i) => systemToday.getFullYear() - 10 + i).map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button className="w-full bg-[#2A174E] hover:bg-[#1a0e30] text-white" onClick={() => setIsDatePickerOpen(false)}>
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DAY DETAILS DIALOG */}
        <Dialog open={!!selectedDayDetails} onOpenChange={(open) => !open && setSelectedDayDetails(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule for {selectedDayDetails?.date}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-4 max-h-[60vh] overflow-y-auto">
              {selectedDayDetails?.events.length > 0 ? (
                selectedDayDetails.events.map((event, idx) => {
                  let typeClass = "bg-red-50 text-red-800 border-red-200"; 
                  let dotBg = "bg-red-400";

                  if (event.type === "Holiday") {
                    if(event.details?.toLowerCase().includes("special") || event.type?.toLowerCase().includes("special")) {
                      typeClass = "bg-purple-50 text-purple-800 border-purple-200";
                      dotBg = "bg-purple-400";
                    }
                  } else if (event.type === "Leave") {
                    typeClass = "bg-green-50 text-green-800 border-green-200";
                    dotBg = "bg-green-400";
                  } else if (event.type === "Field Work") {
                    typeClass = "bg-orange-50 text-orange-800 border-orange-200";
                    dotBg = "bg-orange-400";
                  }

                  return (
                    <div key={idx} className={`p-3 rounded-lg border text-sm ${typeClass}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${dotBg}`}></span>
                        <strong className="font-semibold">{event.type}</strong>
                      </div>
                      <p className="m-0 mt-1 font-medium">{event.name || event.details}</p>
                      {event.type === "Field Work" && (
                        <p className="m-0 mt-1 text-xs opacity-80 italic">Automatically credited as 8 hours on-field.</p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-muted-foreground p-4">
                  <p className="m-0 text-sm">No events or assignments scheduled for this day.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Global styling for custom scrollbars */}
        <style dangerouslySetInnerHTML={{__html: `  
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent; 
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1; 
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8; 
          }
        `}} />

      </div>
      </Sidebar>
    </div>
  );
};

export default EmployeeCalendar;