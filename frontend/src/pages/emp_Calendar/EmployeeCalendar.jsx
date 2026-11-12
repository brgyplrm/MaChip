import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AssignmentIcon from '@mui/icons-material/Assignment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import NotesIcon from '@mui/icons-material/Notes';
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import EmptyState from "@/components/EmptyState";
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "../../components/SearchableSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

const EmployeeCalendar = () => {
  const navigate = useNavigate();
  const { systemToday } = useSystemTime();
  const [currentDate, setCurrentDate] = useState(new Date(systemToday.getFullYear(), systemToday.getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(currentDate.getMonth().toString());
  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear().toString());

  const handleOpenDatePicker = () => {
    setPickerMonth(currentDate.getMonth().toString());
    setPickerYear(currentDate.getFullYear().toString());
    setIsDatePickerOpen(true);
  };

  const handleApplyDatePicker = () => {
    setCurrentDate(new Date(parseInt(pickerYear), parseInt(pickerMonth), 1));
    setIsDatePickerOpen(false);
  };

  const handleResetToToday = () => {
    setCurrentDate(new Date(systemToday.getFullYear(), systemToday.getMonth(), 1));
    setIsDatePickerOpen(false);
  };

  const [selectedDayDetails, setSelectedDayDetails] = useState(null);
  const [selectedHolidayDetails, setSelectedHolidayDetails] = useState(null);
  const [selectedPersonnelAction, setSelectedPersonnelAction] = useState(null);
  const [selectedFieldLog, setSelectedFieldLog] = useState(null);
  const [selectedDueDateDetails, setSelectedDueDateDetails] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const calendarRef = useRef(null);

  // --- Detailed Event Modal State ---
  const [detailedEvent, setDetailedEvent] = useState(null);
  const [detailedEventData, setDetailedEventData] = useState(null);
  const [detailedEventLoading, setDetailedEventLoading] = useState(false);

  const handleOpenEventDetails = async (event) => {
    if (!event) return;
    setDetailedEvent(event);
    setDetailedEventData(null);

    if (event.id && ["Leave", "Overtime", "Field Work"].includes(event.type)) {
      setDetailedEventLoading(true);
      try {
        const res = await fetchWithAuth(`/api/request/details/${event.id}`);
        if (res.ok) {
          const data = await res.json();
          setDetailedEventData(data);
        }
      } catch (err) {
        console.error("Error fetching detailed event request:", err);
      } finally {
        setDetailedEventLoading(false);
      }
    }
  };

  // --- Unified Schedule Ledger State ---
  const [ledgerCategory, setLedgerCategory] = useState("ALL");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerTimeline, setLedgerTimeline] = useState("all"); // 'all' | 'upcoming' | 'this-week' | 'today'
  const [ledgerSort, setLedgerSort] = useState("date-asc"); // 'date-asc' | 'date-desc'
  const [selectedDayFilter, setSelectedDayFilter] = useState(null); // 'YYYY-MM-DD' or null

  const isEventSelected = (item) => {
    if (!selectedEvent || !item) return false;
    return (
      item.type === selectedEvent.type &&
      item.id === selectedEvent.id &&
      item.date === selectedEvent.date
    );
  };

  const handleSelectEvent = (item) => {
    if (
      selectedEvent &&
      selectedEvent.type === item.type &&
      selectedEvent.id === item.id &&
      selectedEvent.date === item.date
    ) {
      setSelectedEvent(null);
      return;
    }

    setSelectedEvent(item);

    if (item.date) {
      const eventDate = new Date(item.date);
      if (!isNaN(eventDate.getTime())) {
        const itemYear = eventDate.getFullYear();
        const itemMonth = eventDate.getMonth();
        if (currentDate.getFullYear() !== itemYear || currentDate.getMonth() !== itemMonth) {
          setCurrentDate(new Date(itemYear, itemMonth, 1));
        }
      }
    }

    if (calendarRef.current) {
      calendarRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
    } else {
      setLoading(false);
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
    const targetDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const formattedDate = dateObj.toLocaleDateString(undefined, { 
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
    });

    setSelectedDayDetails({
      date: formattedDate,
      dateStr: targetDateStr,
      events: dayEvents
    });
    setSelectedDayFilter(targetDateStr);

    if (selectedEvent) {
      setSelectedEvent(null);
    }
  };

  const monthEvents = useMemo(() => {
    return events.filter(e => {
      if (!e.date) return false;
      const start = new Date(e.date);
      const end = e.endDate ? new Date(e.endDate) : start;
      const mStart = new Date(year, monthIndex, 1);
      const mEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);
      return (start <= mEnd && end >= mStart);
    });
  }, [events, monthIndex, year]);

  const categoryCounts = useMemo(() => {
    const counts = { ALL: monthEvents.length, Holiday: 0, Leave: 0, Overtime: 0, "Field Work": 0, "Due Date": 0 };
    monthEvents.forEach(e => {
      if (counts[e.type] !== undefined) {
        counts[e.type] += 1;
      }
    });
    return counts;
  }, [monthEvents]);

  const todayStr = useMemo(() => {
    return `${systemToday.getFullYear()}-${String(systemToday.getMonth() + 1).padStart(2, '0')}-${String(systemToday.getDate()).padStart(2, '0')}`;
  }, [systemToday]);

  const weekRange = useMemo(() => {
    const cur = new Date(systemToday);
    const dayOfWeek = cur.getDay(); // 0 is Sunday
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mon = new Date(cur);
    mon.setDate(cur.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: toYMD(mon), end: toYMD(sun) };
  }, [systemToday]);

  const filteredLedgerEvents = useMemo(() => {
    let list = monthEvents.filter(item => {
      if (ledgerCategory !== "ALL" && item.type !== ledgerCategory) {
        return false;
      }

      const itemDate = item.date ? item.date.split('T')[0] : "";
      const itemEndDate = item.endDate ? item.endDate.split('T')[0] : itemDate;

      if (selectedDayFilter) {
        if (!(itemEndDate >= selectedDayFilter && itemDate <= selectedDayFilter)) {
          return false;
        }
      }

      if (ledgerTimeline === "today") {
        if (!(itemEndDate >= todayStr && itemDate <= todayStr)) return false;
      } else if (ledgerTimeline === "upcoming") {
        if (itemEndDate < todayStr) return false;
      } else if (ledgerTimeline === "this-week") {
        if (itemEndDate < weekRange.start || itemDate > weekRange.end) return false;
      }

      if (ledgerSearch.trim() !== "") {
        const query = ledgerSearch.toLowerCase();
        const nameMatch = (item.name || "").toLowerCase().includes(query);
        const detailsMatch = (item.details || "").toLowerCase().includes(query);
        const typeMatch = (item.type || "").toLowerCase().includes(query);
        if (!nameMatch && !detailsMatch && !typeMatch) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return ledgerSort === "date-asc" ? dateA - dateB : dateB - dateA;
    });

    return list;
  }, [monthEvents, ledgerCategory, selectedDayFilter, ledgerTimeline, ledgerSearch, ledgerSort, todayStr, weekRange]);

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
        <TooltipProvider>
          <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        
          {loading ? (
            <div className="space-y-6">
              {/* Header Skeleton */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 mt-2">
                <div className="space-y-2">
                  <Skeleton className="h-9 w-48" />
                  <Skeleton className="h-5 w-96 max-w-full" />
                </div>
              </div>

              {/* Legend Banner Skeleton */}
              <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 bg-white border border-slate-200 rounded-lg p-4 px-5 shadow-sm">
                <Skeleton className="h-3 w-12" />
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="w-2.5 h-2.5 rounded-full animate-pulse" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>

              {/* Calendar Card Skeleton */}
              <Card className="py-0 overflow-hidden border-0 shadow-sm bg-white">
                <div className="bg-brand-primary/10 p-4 flex justify-between items-center rounded-t-xl">
                  <Skeleton className="h-6 w-6 rounded" />
                  <Skeleton className="h-6 w-44 rounded" />
                  <Skeleton className="h-6 w-6 rounded" />
                </div>
                <div className="bg-slate-100 p-[1px]">
                  <div className="grid grid-cols-7 gap-[1px]">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div key={i} className="p-4 bg-white text-center">
                        <Skeleton className="h-4 w-8 mx-auto" />
                      </div>
                    ))}
                    {Array.from({ length: 35 }).map((_, i) => (
                      <div key={i} className="min-h-[100px] bg-white p-2 flex flex-col justify-between">
                        <Skeleton className="h-4 w-6" />
                        {i % 5 === 0 && <Skeleton className="h-4 w-full rounded mt-2" />}
                        {i % 7 === 1 && <Skeleton className="h-4 w-5/6 rounded mt-2" />}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Bottom Ledger Skeleton */}
              <Card className="shadow-xs border border-slate-200/80 bg-white rounded-2xl overflow-hidden py-0">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-52" />
                    <Skeleton className="h-4 w-80" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-32 rounded-lg" />
                    <Skeleton className="h-9 w-32 rounded-lg" />
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                      <div className="space-y-2 flex-1 mr-4">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-72" />
                      </div>
                      <Skeleton className="h-7 w-20 rounded" />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 mt-2">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">My Calendar</h1>
                  <p className="text-muted-foreground text-sm mt-1">
                    View upcoming holidays, your approved leaves, and scheduled field work assignments.
                  </p>
                </div>
              </div>

              {/* Sleek Legend Banner */}
              <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 bg-white border border-slate-200 rounded-lg p-3 px-5 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Legend</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-sm font-medium text-slate-700 cursor-help">
                      <span className="w-2.5 h-2.5 rounded-full mr-2 bg-red-400 ring-4 ring-red-50" /> Regular Holiday
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                    Paid non-working days declared nationwide.
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-sm font-medium text-slate-700 cursor-help">
                      <span className="w-2.5 h-2.5 rounded-full mr-2 bg-purple-400 ring-4 ring-purple-50" /> Special Holiday
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                    Special non-working days or local holidays.
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-sm font-medium text-slate-700 cursor-help">
                      <span className="w-2.5 h-2.5 rounded-full mr-2 bg-teal-400 ring-4 ring-teal-50" /> Due Date
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                    Deadlines, payroll runs, or system cutoffs.
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-sm font-medium text-slate-700 cursor-help">
                      <span className="w-2.5 h-2.5 rounded-full mr-2 bg-orange-400 ring-4 ring-orange-50" /> Field Work
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                    Assigned on-field assignments credited as 8 duty hours.
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-sm font-medium text-slate-700 cursor-help">
                      <span className="w-2.5 h-2.5 rounded-full mr-2 bg-green-400 ring-4 ring-green-50" /> Approved Leave
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                    Your approved Vacation, Sick, or Emergency Leave days.
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-sm font-medium text-slate-700 cursor-help">
                      <span className="w-2.5 h-2.5 rounded-full mr-2 bg-blue-400 ring-4 ring-blue-50" /> Overtime
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                    Approved overtime hours filed for rendering.
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Main Layout Stack */}
              <div className="grid grid-cols-1">
                
                {/* Full-Width Calendar */}
                <div className="w-full">
                  {selectedEvent && (
                    <div className="mb-4 flex items-center justify-between bg-brand-primary/10 border border-brand-primary/25 text-brand-primary px-4 py-2.5 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex items-center gap-2 flex-wrap text-xs md:text-sm font-medium">
                        <span className="font-bold flex items-center gap-1">Showing on calendar:</span>
                        <span className="font-semibold text-slate-800">{selectedEvent.name || selectedEvent.details}</span>
                        <Badge variant="secondary" className="text-[10px] bg-white border border-brand-primary/30 text-brand-primary font-bold">
                          {selectedEvent.type}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          ({new Date(selectedEvent.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.date ? ` - ${new Date(selectedEvent.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ""})
                        </span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setSelectedEvent(null)}
                        className="h-7 px-2 text-xs font-semibold text-brand-primary hover:bg-brand-primary/15 hover:text-brand-primary"
                      >
                        Clear Highlight
                      </Button>
                    </div>
                  )}

                  <Card ref={calendarRef} className="py-0 overflow-hidden border-0 shadow-sm bg-white scroll-mt-6">
                    <div className="bg-brand-primary text-white flex justify-between items-center p-3 md:p-4 rounded-t-xl">
                      <ChevronLeftIcon className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => changeMonth(-1)} />
                      
                      {/* Clickable Header for Date Picker */}
                      <div 
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity select-none group"
                        onClick={handleOpenDatePicker}
                      >
                        <h2 className="text-lg md:text-xl font-bold">{`${monthName} ${year}`}</h2>
                        <CalendarMonthIcon className="h-5 w-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                        {/* <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlinedIcon className="text-white/60 hover:text-white cursor-pointer !text-[16px] transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                            Click to jump to a specific month and year.
                          </TooltipContent>
                        </Tooltip> */}
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

                          const targetDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const isDaySelected = (() => {
                            if (!selectedEvent || !selectedEvent.date) return false;
                            const startDateStr = selectedEvent.date.split('T')[0];
                            if (!selectedEvent.endDate) {
                              return startDateStr === targetDateStr;
                            }
                            const endDateStr = selectedEvent.endDate.split('T')[0];
                            return targetDateStr >= startDateStr && targetDateStr <= endDateStr;
                          })();

                          let bgClass = "bg-white hover:bg-slate-50";
                          if (hasLeave) bgClass = "bg-green-50/60 hover:bg-green-50";
                          else if (hasField) bgClass = "bg-orange-50/60 hover:bg-orange-50";
                          else if (hasOt) bgClass = "bg-blue-50/60 hover:bg-blue-50";
                          else if (hasHoliday) bgClass = "bg-red-50/60 hover:bg-red-50";
                          else if (hasDueDate) bgClass = "bg-teal-50/60 hover:bg-teal-50";
                          
                          if (isToday) {
                            bgClass = "bg-brand-primary/30 hover:bg-brand-primary/100 ring-2 ring-[#BA90E9] ring-inset z-10 label";
                          }

                          return (
                            <div 
                              key={d} 
                              className={`min-h-[80px] md:min-h-[120px] p-1 md:p-2 transition-all cursor-pointer overflow-y-auto overflow-x-hidden flex flex-col relative ${bgClass}`}
                              onClick={() => handleDayClick(d)}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className={`text-xs md:text-sm font-semibold shrink-0 text-center md:text-left ${
                                  isToday ? "bg-[#BA90E9] text-white w-6 h-6 rounded-full flex items-center justify-center mx-auto md:mx-0" : "text-slate-700"
                                }`}>
                                  {d}
                                </div>
                                {isDaySelected && (
                                  <span 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEvent(null);
                                    }}
                                    title="Click to clear"
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] md:text-[9px] font-bold bg-brand-primary text-white shadow-md animate-bounce shrink-0 select-none cursor-pointer hover:bg-red-600 transition-colors"
                                  >
                                    📍 Here
                                  </span>
                                )}
                              </div>

                              {dayEvents.slice(0, 2).map((e, i) => {
                                const isThisEventSelected = isEventSelected(e);
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
                                <div className="text-[9px] font-bold text-slate-500 mt-1 pl-1 cursor-pointer hover:text-brand-primary">
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

                {/* UNIFIED MONTHLY SCHEDULE & EVENT LEDGER */}
                <Card className="shadow-xs border border-slate-200/80 bg-white rounded-2xl overflow-hidden py-0">
                  <CardHeader className="p-5 border-b border-slate-100 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg font-bold text-slate-900">
                            Monthly Schedule & Event Ledger
                          </CardTitle>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Consolidated record of holidays, your approved leaves, overtime logs, field work, and compliance due dates for {monthName} {year}.
                        </p>
                      </div>

                      {/* Scope & Sort Controls */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {selectedDayFilter && (
                          <div className="flex items-center gap-1.5 bg-brand-primary/10 text-brand-primary px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-brand-primary/20">
                            <span>Filtering Day: <strong>{new Date(selectedDayFilter + "T00:00:00").toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}</strong></span>
                            <button 
                              onClick={() => setSelectedDayFilter(null)} 
                              className="hover:opacity-75 cursor-pointer ml-1 p-0.5 hover:bg-slate-200/60 rounded"
                              title="Clear Day Filter"
                            >
                              <CloseIcon sx={{ fontSize: 13 }} />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <select
                            value={ledgerTimeline}
                            onChange={(e) => setLedgerTimeline(e.target.value)}
                            className="text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer"
                          >
                            <option value="all">Timeline: Entire Month</option>
                            <option value="upcoming">Timeline: Today & Upcoming</option>
                            <option value="this-week">Timeline: This Week</option>
                            <option value="today">Timeline: Today Only</option>
                          </select>

                          <select
                            value={ledgerSort}
                            onChange={(e) => setLedgerSort(e.target.value)}
                            className="text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer"
                          >
                            <option value="date-asc">Sort: Earliest First</option>
                            <option value="date-desc">Sort: Latest First</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Search & Category Pills */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-3">
                      {/* Search Bar */}
                      <div className="relative flex-1 max-w-md">
                        <SearchIcon sx={{ fontSize: 18 }} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          type="text"
                          value={ledgerSearch}
                          onChange={(e) => setLedgerSearch(e.target.value)}
                          placeholder="Search events by name, notes, or details..."
                          className="h-9 text-xs pl-9 pr-8 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-brand-primary"
                        />
                        {ledgerSearch && (
                          <button
                            onClick={() => setLedgerSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <CloseIcon sx={{ fontSize: 14 }} />
                          </button>
                        )}
                      </div>

                      {/* Category Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                        <button
                          onClick={() => setLedgerCategory("ALL")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            ledgerCategory === "ALL"
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          All <span className="ml-1 opacity-80 font-normal">({categoryCounts.ALL})</span>
                        </button>

                        <button
                          onClick={() => setLedgerCategory("Holiday")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            ledgerCategory === "Holiday"
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1.5"></span>
                          Holidays <span className="ml-1 opacity-70 font-normal">({categoryCounts.Holiday})</span>
                        </button>

                        <button
                          onClick={() => setLedgerCategory("Leave")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            ledgerCategory === "Leave"
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
                          Leaves <span className="ml-1 opacity-70 font-normal">({categoryCounts.Leave})</span>
                        </button>

                        <button
                          onClick={() => setLedgerCategory("Overtime")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            ledgerCategory === "Overtime"
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>
                          Overtime <span className="ml-1 opacity-70 font-normal">({categoryCounts.Overtime})</span>
                        </button>

                        <button
                          onClick={() => setLedgerCategory("Field Work")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            ledgerCategory === "Field Work"
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1.5"></span>
                          Field Work <span className="ml-1 opacity-70 font-normal">({categoryCounts["Field Work"]})</span>
                        </button>

                        <button
                          onClick={() => setLedgerCategory("Due Date")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            ledgerCategory === "Due Date"
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <span className="inline-block w-2 h-2 rounded-full bg-teal-500 mr-1.5"></span>
                          Due Dates <span className="ml-1 opacity-70 font-normal">({categoryCounts["Due Date"]})</span>
                        </button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/75 border-b border-slate-200/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="py-3 px-4 w-44">Scheduled Date</th>
                            <th className="py-3 px-4 w-32">Type</th>
                            <th className="py-3 px-4">Subject / Purpose</th>
                            <th className="py-3 px-4">Details & Notes</th>
                            <th className="py-3 px-4 text-right w-36">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredLedgerEvents.length > 0 ? (
                            filteredLedgerEvents.map((item, idx) => {
                              const isHoliday = item.type === "Holiday";
                              const isLeave = item.type === "Leave";
                              const isOvertime = item.type === "Overtime";
                              const isFieldWork = item.type === "Field Work";
                              const isDueDate = item.type === "Due Date";

                              const isSpecialHoliday = isHoliday && (item.type?.toLowerCase().includes("special") || item.details?.toLowerCase().includes("special"));
                              
                              let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
                              let badgeLabel = item.type;

                              if (isHoliday) {
                                badgeClass = isSpecialHoliday ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-red-50 text-red-700 border-red-200";
                                badgeLabel = isSpecialHoliday ? "SPECIAL HOLIDAY" : "REGULAR HOLIDAY";
                              } else if (isLeave) {
                                badgeClass = "bg-green-50 text-green-700 border-green-200";
                                badgeLabel = "LEAVE";
                              } else if (isOvertime) {
                                badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
                                badgeLabel = "OVERTIME";
                              } else if (isFieldWork) {
                                badgeClass = "bg-orange-50 text-orange-700 border-orange-200";
                                badgeLabel = "FIELD WORK";
                              } else if (isDueDate) {
                                badgeClass = "bg-teal-50 text-teal-700 border-teal-200";
                                badgeLabel = "DUE DATE";
                              }

                              const dateObj = new Date(item.date);
                              const formattedDate = !isNaN(dateObj.getTime())
                                ? dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })
                                : item.date;
                              
                              const itemDateStr = item.date ? item.date.split('T')[0] : "";
                              const isToday = itemDateStr === todayStr;
                              const isActionableReq = Boolean(item.id && (isLeave || isOvertime || isFieldWork));

                              return (
                                <tr 
                                  key={item.id ? `${item.type}-${item.id}-${idx}` : `event-${idx}`}
                                  onClick={(e) => {
                                    if (e.target.closest('button')) return;
                                    handleOpenEventDetails(item);
                                  }}
                                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                  title="Click row to view full event details"
                                >
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-800 text-xs">{formattedDate}</span>
                                      {isToday && (
                                        <span className="bg-accent-green text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                          TODAY
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {itemDateStr}
                                      {item.endDate && item.endDate !== item.date ? ` → ${item.endDate.split('T')[0]}` : ""}
                                    </span>
                                  </td>

                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeClass}`}>
                                      {badgeLabel}
                                    </span>
                                  </td>

                                  <td className="py-3 px-4">
                                    <div className="flex flex-col max-w-xs">
                                      <span className="font-bold text-slate-800 text-xs group-hover:text-brand-primary truncate">
                                        {item.name || item.details}
                                      </span>
                                      {item.id && (
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          REQ-{item.id}
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="py-3 px-4">
                                    <div className="flex flex-col max-w-md">
                                      <p className="text-xs text-slate-600 truncate" title={item.details || "No additional notes."}>
                                        {item.details || "—"}
                                      </p>
                                      {item.hours && (
                                        <span className="text-[10px] text-slate-400 italic font-medium">
                                          Auto-credited: {item.hours} hrs
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenEventDetails(item)}
                                        className="h-7 px-2.5 text-[11px] font-semibold text-slate-700 hover:text-brand-primary hover:border-brand-primary gap-1 shadow-2xs"
                                        title="View Full Event Details & Information"
                                      >
                                        <VisibilityIcon sx={{ fontSize: 14 }} className="text-slate-500" />
                                        <span>Details</span>
                                      </Button>

                                      {isActionableReq && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => navigate(`/requests?tab=history&requestId=${item.id}`, { state: { selectedReqId: item.id } })}
                                          className="h-7 px-2 text-[11px] font-semibold text-brand-primary border-brand-primary/30 hover:bg-brand-primary-light gap-1 shadow-2xs"
                                          title={`Directly inspect REQ-${item.id} in Requests`}
                                        >
                                          <OpenInNewIcon sx={{ fontSize: 13 }} />
                                          <span>Inspect</span>
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-slate-400">
                                <div className="flex flex-col items-center justify-center">
                                  <AssignmentIcon sx={{ fontSize: 36 }} className="text-slate-300 mb-2" />
                                  <p className="font-semibold text-sm text-slate-600">No scheduled events match your filter</p>
                                  <p className="text-xs text-slate-400 mt-0.5">Try selecting a different category or clearing search terms.</p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setLedgerCategory("ALL");
                                      setLedgerSearch("");
                                      setLedgerTimeline("all");
                                      setSelectedDayFilter(null);
                                    }}
                                    className="mt-2 text-xs font-semibold text-brand-primary border-brand-primary/30 hover:bg-brand-primary-light"
                                  >
                                    Reset Filters
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Footer */}
                    <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                      <span>
                        Showing {filteredLedgerEvents.length} of {monthEvents.length} events for {monthName} {year}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Click <strong className="text-slate-600">Details</strong> to view complete event records.
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

        {/* DATE PICKER DIALOG */}
        <Dialog open={isDatePickerOpen} onOpenChange={(open) => {
          setIsDatePickerOpen(open);
          if (open) {
            setPickerMonth(currentDate.getMonth().toString());
            setPickerYear(currentDate.getFullYear().toString());
          }
        }}>
          <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle className="text-brand-primary text-lg font-bold text-center">Jump to Date</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-5 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp-jump-month">Select Month</Label>
                <SearchableSelect
                  id="emp-jump-month"
                  searchable={false}
                  value={pickerMonth}
                  onChange={setPickerMonth}
                  options={["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => ({
                    value: i.toString(),
                    label: m
                  }))}
                  placeholder="Select Month"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp-jump-year">Select Year</Label>
                <SearchableSelect
                  id="emp-jump-year"
                  searchable={false}
                  value={pickerYear}
                  onChange={setPickerYear}
                  options={Array.from({ length: 21 }, (_, i) => {
                    const y = systemToday.getFullYear() - 10 + i;
                    return { value: y.toString(), label: y.toString() };
                  })}
                  placeholder="Select Year"
                />
              </div>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-2 w-full pt-1 sm:grid-cols-2 sm:space-x-0">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full text-slate-700 hover:bg-slate-100 border-slate-200" 
                onClick={handleResetToToday}
              >
                Reset to Today
              </Button>
              <Button 
                type="button" 
                className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white" 
                onClick={handleApplyDatePicker}
              >
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DAY DETAILS DIALOG */}
        <Dialog open={!!selectedDayDetails} onOpenChange={(open) => !open && setSelectedDayDetails(null)}>
          {(() => {
            const groupedDayEvents = Object.entries(
              (selectedDayDetails?.events || []).reduce((acc, event) => {
                if (!acc[event.type]) acc[event.type] = [];
                acc[event.type].push(event);
                return acc;
              }, {})
            );
            const isSingleCategory = groupedDayEvents.length <= 1;

            return (
              <DialogContent className={`${isSingleCategory ? "sm:max-w-lg" : "sm:max-w-3xl"} max-h-[90vh] flex flex-col transition-all duration-200`}>
                <DialogHeader className="border-b pb-4">
                  <DialogTitle className="text-lg font-bold text-brand-primary">
                    Schedule for {selectedDayDetails?.date}
                  </DialogTitle>
                </DialogHeader>

                <div className="pt-2 overflow-y-auto custom-scrollbar">
                  {groupedDayEvents.length > 0 ? (
                    groupedDayEvents.map(([type, events]) => {
                      const config = getEventConfig(type);
                      
                      return (
                        <div key={type} className="mb-6 last:mb-2">
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
                            <h4 className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>
                              {type}s ({events.length})
                            </h4>
                          </div>

                          <div className={`grid ${isSingleCategory ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-3`}>
                            {events.map((event, idx) => {
                              return (
                                <div 
                                  key={idx} 
                                  onClick={() => {
                                    setSelectedDayDetails(null);
                                    handleOpenEventDetails(event);
                                  }}
                                  className={`p-3 rounded-lg border ${config.bg} ${config.border} transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] group/item`}
                                  title="Click to view complete details about this event"
                                >
                                  <div className="flex items-center justify-between">
                                    <p className={`font-semibold text-sm ${config.text} group-hover/item:underline`}>
                                      {event.name || event.details}
                                    </p>
                                    <VisibilityIcon sx={{ fontSize: 16 }} className="text-slate-400 group-hover/item:text-brand-primary opacity-60 group-hover/item:opacity-100 transition-opacity" />
                                  </div>
                                  {event.type === "Field Work" && (
                                    <p className="text-[10px] opacity-70 font-medium italic mt-1">
                                      Auto-credited: {event.hours || 8} hrs on-field.
                                    </p>
                                  )}
                                  {event.type === "Overtime" && (
                                    <p className="text-[10px] opacity-70 font-medium italic mt-1">
                                      {event.details}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">No events scheduled.</div>
                  )}
                </div>
              </DialogContent>
            );
          })()}
        </Dialog>

        {/* COMPREHENSIVE DETAILED EVENT INFORMATION MODAL */}
        <Dialog open={!!detailedEvent} onOpenChange={(open) => {
          if (!open) {
            setDetailedEvent(null);
            setDetailedEventData(null);
          }
        }}>
          <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
            {detailedEvent && (() => {
              const isHoliday = detailedEvent.type === "Holiday";
              const isLeave = detailedEvent.type === "Leave";
              const isOvertime = detailedEvent.type === "Overtime";
              const isFieldWork = detailedEvent.type === "Field Work";
              const isDueDate = detailedEvent.type === "Due Date";
              const isSpecialHoliday = isHoliday && (detailedEvent.type?.toLowerCase().includes("special") || detailedEvent.details?.toLowerCase().includes("special"));
              
              let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
              let badgeLabel = detailedEvent.type;

              if (isHoliday) {
                badgeClass = isSpecialHoliday ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-red-100 text-red-700 border-red-200";
                badgeLabel = isSpecialHoliday ? "SPECIAL NON-WORKING HOLIDAY" : "REGULAR PHILIPPINE HOLIDAY";
              } else if (isLeave) {
                badgeClass = "bg-green-100 text-green-700 border-green-200";
                badgeLabel = detailedEventData?.reqTypeName || detailedEvent.details || "LEAVE";
              } else if (isOvertime) {
                badgeClass = "bg-blue-100 text-blue-700 border-blue-200";
                badgeLabel = "APPROVED OVERTIME";
              } else if (isFieldWork) {
                badgeClass = "bg-orange-100 text-orange-700 border-orange-200";
                badgeLabel = "OFFICIAL ON-FIELD WORK";
              } else if (isDueDate) {
                badgeClass = "bg-teal-100 text-teal-700 border-teal-200";
                badgeLabel = "OPERATIONAL DEADLINE";
              }

              const dateObj = new Date(detailedEvent.date);
              const formattedDate = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                : detailedEvent.date;

              const isActionableReq = Boolean(detailedEvent.id && (isLeave || isOvertime || isFieldWork));

              return (
                <>
                  <DialogHeader className="p-5 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center justify-between gap-2 pr-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border tracking-wide uppercase ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                      {detailedEvent.id && (
                        <span className="text-[11px] font-mono text-slate-400 font-semibold">
                          REQ-{detailedEvent.id}
                        </span>
                      )}
                    </div>
                    <DialogTitle className="text-xl font-bold text-slate-900 mt-2 text-left leading-snug">
                      {detailedEvent.name || detailedEvent.details}
                    </DialogTitle>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-1">
                      <CalendarTodayIcon sx={{ fontSize: 14 }} className="text-slate-400" />
                      <span>{formattedDate}</span>
                      {detailedEvent.endDate && detailedEvent.endDate !== detailedEvent.date && (
                        <span> → {new Date(detailedEvent.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      )}
                    </div>
                  </DialogHeader>

                  <div className="p-5 overflow-y-auto space-y-4 text-xs custom-scrollbar">
                    {detailedEventLoading && (
                      <div className="space-y-2 py-4">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    )}

                    {/* Actionable Request (Leave / Overtime / Field Work) details */}
                    {isActionableReq && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Subject</span>
                            <span className="text-sm font-bold text-slate-800">{detailedEvent.name || detailedEventData?.userName || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                            <span className="text-xs font-bold text-emerald-600">
                              {detailedEventData?.status || "Approved"}
                            </span>
                            {detailedEventData?.date_Filed && (
                              <span className="text-[10px] text-slate-400 block">
                                Filed: {new Date(detailedEventData.date_Filed).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {isLeave && (
                          <div className="grid grid-cols-3 gap-2 p-3 bg-green-50/60 rounded-xl border border-green-100 text-center">
                            <div>
                              <span className="text-[9px] font-bold text-green-700 uppercase tracking-wider block">Duration</span>
                              <span className="text-xs font-bold text-slate-800">
                                {detailedEvent.hours || detailedEventData?.VL_NoDays || detailedEventData?.SL_NoDays || 1} Day(s)
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-green-700 uppercase tracking-wider block">Type</span>
                              <span className="text-xs font-bold text-slate-800">
                                {detailedEventData?.VL_withPayName || detailedEventData?.SL_withPayName || detailedEventData?.EL_withPayName || "With Pay"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-green-700 uppercase tracking-wider block">Pay Credit</span>
                              <span className="text-xs font-bold text-green-700">100% Paid</span>
                            </div>
                          </div>
                        )}

                        {isOvertime && (
                          <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                            <div>
                              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Recorded Hours</span>
                              <span className="text-sm font-black text-slate-800">
                                {detailedEvent.hours || detailedEventData?.Total_Hrs || "—"} Hours
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Scheduled Window</span>
                              <span className="text-xs font-medium text-slate-700">
                                {detailedEventData?.HrFrom && detailedEventData?.HrTo 
                                  ? `${detailedEventData.HrFrom} - ${detailedEventData.HrTo}` 
                                  : (detailedEvent.details || "Standard Overtime")}
                              </span>
                            </div>
                          </div>
                        )}

                        {isFieldWork && (
                          <div className="grid grid-cols-2 gap-3 p-3 bg-orange-50/60 rounded-xl border border-orange-100">
                            <div>
                              <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider block">Auto-Credited Duty</span>
                              <span className="text-sm font-black text-slate-800">
                                {detailedEvent.hours || detailedEventData?.OW_NoHrs || 8} Hours (100% Paid)
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider block">Destination</span>
                              <span className="text-xs font-medium text-slate-700">
                                {detailedEventData?.destination || detailedEvent.details || "Client Site"}
                              </span>
                            </div>
                          </div>
                        )}

                        {(detailedEventData?.remarks || detailedEvent.details) && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Reason / Purpose / Remarks
                            </span>
                            <p className="text-xs text-slate-700 leading-relaxed">
                              {detailedEventData?.remarks || detailedEvent.details}
                            </p>
                          </div>
                        )}

                        {detailedEventData?.approverName && (
                          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                            <span>Approved by: <strong className="text-slate-700">{detailedEventData.approverName}</strong></span>
                            {detailedEventData.date_Processed && (
                              <span>Processed: {new Date(detailedEventData.date_Processed).toLocaleDateString()}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Holiday Details */}
                    {isHoliday && (
                      <div className="space-y-3">
                        <div className={`p-4 rounded-xl border ${isSpecialHoliday ? "bg-purple-50/60 border-purple-100" : "bg-red-50/60 border-red-100"}`}>
                          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isSpecialHoliday ? "text-purple-700" : "text-red-700"}`}>
                            {isSpecialHoliday ? "Special Non-Working Day" : "Regular Philippine Holiday"}
                          </span>
                          <span className="text-base font-bold text-slate-900 mt-1 block">{detailedEvent.name}</span>
                          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                            {detailedEvent.details || (isSpecialHoliday ? "Special Non-Working Holiday declared in the Philippines." : "Nationwide regular holiday. Covered employees are entitled to 100% daily regular pay if unworked, or 200% premium pay if worked.")}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Due Date Details */}
                    {isDueDate && (
                      <div className="space-y-3">
                        <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-100">
                          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">Operational Due Date</span>
                          <span className="text-base font-bold text-slate-900 mt-1 block">{detailedEvent.name}</span>
                          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                            {detailedEvent.details || "Compliance or operational cutoff deadline."}
                          </p>
                        </div>
                        {detailedEvent.priority && (
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-slate-500 font-medium">Priority</span>
                            <span className="font-bold text-slate-800">{detailedEvent.priority}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <DialogFooter className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between sm:justify-between gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setDetailedEvent(null)}
                      className="text-xs text-slate-600 border-slate-200"
                    >
                      Close
                    </Button>

                    {isActionableReq && (
                      <Button
                        size="sm"
                        onClick={() => {
                          const reqId = detailedEvent.id;
                          setDetailedEvent(null);
                          navigate(`/requests?tab=history&requestId=${reqId}`, { state: { selectedReqId: reqId } });
                        }}
                        className="bg-brand-primary text-white hover:bg-brand-primary-hover text-xs gap-1.5 shadow-xs"
                      >
                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                        <span>Inspect in Requests</span>
                      </Button>
                    )}
                  </DialogFooter>
                </>
              );
            })()}
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
      </TooltipProvider>
      </Sidebar>
    </div>
  );
};

export default EmployeeCalendar;
