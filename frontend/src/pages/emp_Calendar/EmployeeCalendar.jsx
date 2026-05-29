import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import EmptyState from "@/components/EmptyState";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const EmployeeCalendar = () => {
  const { systemToday } = useSystemTime();
  const [currentDate, setCurrentDate] = useState(new Date(systemToday.getFullYear(), systemToday.getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);
  const [selectedHolidayDetails, setSelectedHolidayDetails] = useState(null);
  const [selectedPersonnelAction, setSelectedPersonnelAction] = useState(null);
  const [selectedFieldLog, setSelectedFieldLog] = useState(null);
  const [selectedDueDateDetails, setSelectedDueDateDetails] = useState(null);

  const userData = JSON.parse(localStorage.getItem("userData") || "{}");

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const monthIndex = currentDate.getMonth();
  const year = currentDate.getFullYear();

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const firstDay = `${year}-01-01`;
        const lastDay = `${year}-12-31`;

        const response = await fetchWithAuth(`/api/request/calendar-report?startDate=${firstDay}&endDate=${lastDay}&user_Id=${userData?.user_Id}`);
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

  const handleHolidayClick = (holiday) => {
    setSelectedHolidayDetails({
      holiday,
      matchingWork: [] // Employees don't need to see matching work for privacy
    });
  };

  const handlePersonnelActionClick = (action) => {
    setSelectedPersonnelAction(action);
  };

  const handleFieldWorkClick = (fieldWork) => {
    setSelectedFieldLog(fieldWork);
  };

  const handleDueDateClick = (dueDate) => {
    setSelectedDueDateDetails(dueDate);
  };

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const getUpcomingHolidays = () => {
    return events
      .filter(h => h.type === "Holiday")
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getEventConfig = (type, details = "") => {
    const isSpecial = type === "Holiday" && details?.toLowerCase().includes("special");
    const configs = {
      "Holiday": { bg: isSpecial ? "bg-purple-50" : "bg-red-50", text: isSpecial ? "text-purple-900" : "text-red-900", dot: isSpecial ? "bg-purple-500" : "bg-red-500", border: isSpecial ? "border-purple-200" : "border-red-200" },
      "Leave": { bg: "bg-green-50", text: "text-green-900", dot: "bg-green-500", border: "border-green-200" },
      "Field Work": { bg: "bg-orange-50", text: "text-orange-900", dot: "bg-orange-500", border: "border-orange-200" },
      "Overtime": { bg: "bg-blue-50", text: "text-blue-900", dot: "bg-blue-500", border: "border-blue-200" },
      "Due Date": { bg: "bg-teal-50", text: "text-teal-900", dot: "bg-teal-500", border: "border-teal-200" }
    };
    return configs[type] || { bg: "bg-slate-50", text: "text-slate-900", dot: "bg-slate-500", border: "border-slate-200" };
  };

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
            <span className="w-2.5 h-2.5 rounded-full mr-2 bg-teal-400 ring-4 ring-teal-50" /> Due Date
          </div>
          <div className="flex items-center text-sm font-medium text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full mr-2 bg-orange-400 ring-4 ring-orange-50" /> Field Work
          </div>
          <div className="flex items-center text-sm font-medium text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full mr-2 bg-green-400 ring-4 ring-green-50" /> Approved Leave
          </div>
          <div className="flex items-center text-sm font-medium text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full mr-2 bg-blue-400 ring-4 ring-blue-50" /> Overtime
          </div>
        </div>

        {/* Main Layout Stack */}
        <div className="grid grid-cols-1">
          
          {/* Full-Width Calendar */}
          <div className="w-full">
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
                    const hasOt = dayEvents.some(e => e.type === "Overtime");
                    const hasHoliday = dayEvents.some(e => e.type === "Holiday");
                    const hasDueDate = dayEvents.some(e => e.type === "Due Date");

                    const isToday = 
                      d === systemToday.getDate() && 
                      monthIndex === systemToday.getMonth() && 
                      year === systemToday.getFullYear();

                    let bgClass = "bg-white hover:bg-slate-50";
                    if (hasLeave) bgClass = "bg-green-50/60 hover:bg-green-50";
                    else if (hasField) bgClass = "bg-orange-50/60 hover:bg-orange-50";
                    else if (hasOt) bgClass = "bg-blue-50/60 hover:bg-blue-50";
                    else if (hasHoliday) bgClass = "bg-red-50/60 hover:bg-red-50";
                    else if (hasDueDate) bgClass = "bg-teal-50/60 hover:bg-teal-50";
                    
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

                        {dayEvents.slice(0, 2).map((e, i) => {
                          let typeClass = "bg-red-100 text-red-800"; 
                          if (e.type === "Holiday") {
                            typeClass = e.details?.toLowerCase().includes("special") ? "bg-purple-100 text-purple-800" : "bg-red-100 text-red-800";
                          } else if (e.type === "Leave") {
                            typeClass = "bg-green-100 text-green-800";
                          } else if (e.type === "Field Work") {
                            typeClass = "bg-orange-100 text-orange-800";
                          } else if (e.type === "Overtime") {
                            typeClass = "bg-blue-100 text-blue-800";
                          } else if (e.type === "Due Date") {
                            typeClass = "bg-teal-100 text-teal-800";
                          }
                          
                          return (
                            <div 
                              key={i} 
                              className={`text-[9px] md:text-[10px] p-1 rounded mt-1 shrink-0 truncate w-full font-medium ${typeClass}`} 
                              title={e.name || e.details}
                            >
                              {e.name || e.details}
                            </div>
                          );
                        })}
                        {/* "More" indicator */}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] font-bold text-slate-500 mt-1 pl-1 cursor-pointer hover:text-[#2A174E]">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>

          <div className="h-6" /> {/* Spacer */}

          {/* Bottom Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Holidays List Card */}
            <Card className="shadow-sm border-0 h-[500px] border-t-4 border-[#2A174E] py-0 overflow-hidden">
              <CardHeader className="pb-0 pt-5">
                <CardTitle className="text-lg text-[#2A174E]">Holidays</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 h-[440px] overflow-y-auto custom-scrollbar">
                {getUpcomingHolidays().length > 0 ? (
                  <div className="space-y-2 mt-2">
                    {getUpcomingHolidays().map((holiday, idx) => {
                      const isSpecial = holiday.type?.toLowerCase().includes("special") || holiday.details?.toLowerCase().includes("special");
                      
                      return (
                        <div 
                          className="group relative cursor-pointer transition-all flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 hover:bg-slate-50" 
                          key={idx} 
                        >
                          <div className="flex flex-col min-w-0">
                            <p className="font-bold text-sm text-slate-800 truncate">{holiday.name}</p>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(holiday.date).toLocaleDateString('en-US', { 
                                month: 'long', day: 'numeric', year: 'numeric' 
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className={`text-[9px] ${isSpecial ? "bg-purple-100 text-purple-700" : "bg-red-100 text-red-700"}`}>
                              {isSpecial ? "SPECIAL" : "REGULAR"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState 
                    className="min-h-0 h-full w-full border-0 bg-transparent shadow-none p-0"
                    icon={<EventAvailableIcon sx={{ fontSize: 32 }} className="text-slate-300" />}
                    title="No Holidays"
                    description="None registered for this period."
                  />
                )}
              </CardContent>
            </Card>

            {/* Personnel Actions Card (Leaves & Overtime) */}
            <Card className="shadow-sm border-0 h-[500px] border-t-4 border-green-600 py-0 overflow-hidden">
              <CardHeader className="pb-0 pt-5">
                <CardTitle className="text-lg text-green-700">My Actions</CardTitle>
              </CardHeader>
              <CardContent className="h-[440px] pt-0 px-0">
                <Tabs defaultValue="leave" className="w-full h-full flex flex-col">
                  <TabsList className="grid w-[90%] mx-auto grid-cols-2 mb-4">
                    <TabsTrigger value="leave">Leaves</TabsTrigger>
                    <TabsTrigger value="ot">Overtime</TabsTrigger>
                  </TabsList>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
                    <TabsContent value="leave" className="mt-0 space-y-2">
                      {events.filter(e => e.type === "Leave").length > 0 ? (
                        events.filter(e => e.type === "Leave").map((item, i) => (
                          <div 
                            key={i} 
                            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:bg-green-50/50 transition-colors"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">LEAVE</Badge>
                          </div>
                        ))
                      ) : (
                        <EmptyState className="h-20 border-0" title="No Leaves" />
                      )}
                    </TabsContent>
                    
                    <TabsContent value="ot" className="mt-0 space-y-2">
                      {events.filter(e => e.type === "Overtime").length > 0 ? (
                        events.filter(e => e.type === "Overtime").map((item, i) => (
                          <div 
                            key={i} 
                            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:bg-blue-50/50 transition-colors"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700">OT</Badge>
                          </div>
                        ))
                      ) : (
                        <EmptyState className="h-20 border-0" title="No Overtime" />
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>

            {/* Operational Tasks Card (Field Work & Due Dates) */}
            <Card className="shadow-sm border-0 h-[500px] border-t-4 border-orange-500 py-0 overflow-hidden">
              <CardHeader className="pb-0 pt-5">
                <CardTitle className="text-lg text-orange-700">My Tasks</CardTitle>
              </CardHeader>
              <CardContent className="h-[440px] pt-0 px-0">
                <Tabs defaultValue="field" className="w-full h-full flex flex-col">
                  <TabsList className="grid w-[90%] mx-auto grid-cols-2 mb-2">
                    <TabsTrigger value="field">Field Work</TabsTrigger>
                    <TabsTrigger value="due">Due Dates</TabsTrigger>
                  </TabsList>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
                    <TabsContent value="field" className="mt-0 space-y-2">
                      {events.filter(e => e.type === "Field Work").length > 0 ? (
                        events.filter(e => e.type === "Field Work").map((item, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:bg-orange-50/50 transition-colors"
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-slate-800 truncate">{item.name || item.details}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-700">FIELD</Badge>
                          </div>
                        ))
                      ) : (
                        <EmptyState className="h-20 border-0" title="No Field Work" />
                      )}
                    </TabsContent>

                    <TabsContent value="due" className="mt-0 space-y-2">
                      {events.filter(e => e.type === "Due Date").length > 0 ? (
                        events.filter(e => e.type === "Due Date").map((item, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:bg-teal-50/50 transition-colors"
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-slate-800 truncate">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] bg-teal-100 text-teal-700">DUE</Badge>
                          </div>
                        ))
                      ) : (
                        <EmptyState className="h-20 border-0" title="No Due Dates" />
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
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
          <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-lg font-bold text-[#2A174E]">
                Schedule for {selectedDayDetails?.date}
              </DialogTitle>
            </DialogHeader>

            <div className="pt-2 overflow-y-auto custom-scrollbar">
              {selectedDayDetails?.events.length > 0 ? (
                // Group events by type
                Object.entries(
                  selectedDayDetails.events.reduce((acc, event) => {
                    if (!acc[event.type]) acc[event.type] = [];
                    acc[event.type].push(event);
                    return acc;
                  }, {})
                ).map(([type, events]) => {
                  const config = getEventConfig(type);
                  
                  return (
                    <div key={type} className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
                        <h4 className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>
                          {type}s ({events.length})
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {events.map((event, idx) => (
                          <div key={idx} className={`p-3 rounded-lg border ${config.bg} ${config.border} transition-all`}>
                            <p className={`font-semibold text-sm ${config.text}`}>
                              {event.name || event.details}
                            </p>
                            {event.type === "Field Work" && (
                              <p className="text-[10px] opacity-70 font-medium italic mt-1">
                                Automatically credited as 8 hours on-field.
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">No events scheduled.</div>
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
