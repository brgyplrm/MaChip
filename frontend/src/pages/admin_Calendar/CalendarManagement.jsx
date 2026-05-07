import Sidebar from "../../components/Sidebar";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SyncIcon from '@mui/icons-material/Sync';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import MapIcon from '@mui/icons-material/Map';
import AssignmentIcon from '@mui/icons-material/Assignment'; 
import Toast from "../../components/toast/Toast";
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import { useState, useEffect } from "react";
import { formatUserId } from "../../utils/formatUserId";
import EmptyState from "@/components/EmptyState";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CalendarManagement = () => {
  const { systemToday } = useSystemTime();
  const [currentDate, setCurrentDate] = useState(new Date(systemToday.getFullYear(), systemToday.getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState(null); // 'addEvent' or 'editHoliday'
  const [activeTab, setActiveTab] = useState("fieldWork"); // 'fieldWork', 'holiday', 'dueDate'
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const monthIndex = currentDate.getMonth();
  const year = currentDate.getFullYear();

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

  const initiateDelete = (id, type) => {
    setItemToDelete({ id, type });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const { id, type } = itemToDelete;
    
    const endpoint = type === 'Holiday' 
      ? `/api/system/holidays/${id}`
      : type === 'Due Date'
      ? `/api/system/due-dates/${id}` 
      : `/api/request/delete/${id}`;

    try {
      const response = await fetchWithAuth(endpoint, {
        method: "DELETE",
      });
      
      if (response.ok) {
        setEvents(prev => prev.filter((item) => item.id !== id || item.type !== type));
        setToast({ message: `${type} deleted successfully.`, type: "success" });
        fetchCalendarEvents(); 
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

  // Forms State
  const [fieldWorkForm, setFieldWorkForm] = useState({
    userId: "",
    date: "",
    location: "",
    hours: 8
  });

  const [holidayForm, setHolidayForm] = useState({
    id: null,
    name: "",
    date: "",
    type: "Regular Holiday"
  });

  const [dueDateForm, setDueDateForm] = useState({
    title: "",
    date: "",
    description: ""
  });

  const handleOpenEditHoliday = (holiday) => {
    setHolidayForm({
      id: holiday.id,
      name: holiday.name,
      date: holiday.date.split('T')[0],
      type: holiday.type || "Regular Holiday"
    });
    setModalType('editHoliday');
  };

  // Submit Handlers
  const handleHolidaySubmit = async (e) => {
    e.preventDefault();
    if (!holidayForm.name || !holidayForm.date) {
      setToast({ message: "Please fill in all fields.", type: "error" });
      return;
    }

    const isEditing = !!holidayForm.id;
    const endpoint = isEditing 
      ? `/api/system/holidays/${holidayForm.id}`
      : "/api/system/holidays";

    try {
      const response = await fetchWithAuth(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: holidayForm.name,
          date: holidayForm.date,
          type: holidayForm.type
        }),
      });

      if (response.ok) {
        setToast({ message: `Holiday ${isEditing ? 'updated' : 'added'} successfully!`, type: "success" });
        setModalType(null);
        setHolidayForm({ id: null, name: "", date: "", type: "Regular Holiday" });
        fetchCalendarEvents();
      } else {
        const err = await response.json();
        setToast({ message: err.error || `Failed to ${isEditing ? 'update' : 'add'} holiday.`, type: "error" });
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
          emp_reqTypeId: 2, 
          emp_reqStatusId: 2, 
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
        fetchCalendarEvents(); 
      } else {
        const err = await response.json();
        setToast({ message: err.error || "Failed to assign field work.", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Connection error.", type: "error" });
    }
  };

  const handleDueDateSubmit = async (e) => {
    e.preventDefault();
    if (!dueDateForm.title || !dueDateForm.date) {
      setToast({ message: "Please fill in the title and date.", type: "error" });
      return;
    }

    try {
      const response = await fetchWithAuth("/api/system/due-dates", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dueDateForm.title,
          date: dueDateForm.date,
          details: dueDateForm.description,
          type: "Due Date"
        }),
      });

      if (response.ok) {
        setToast({ message: "Custom Due Date added to calendar!", type: "success" });
        setModalType(null);
        setDueDateForm({ title: "", date: "", description: "" });
        fetchCalendarEvents(); 
      } else {
        const err = await response.json();
        setToast({ message: err.error || "Failed to assign due date.", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Connection error.", type: "error" });
    }
  };

  // Universal form submission router based on tab/modal state
  const handleModalSubmit = (e) => {
    e.preventDefault();
    if (modalType === 'editHoliday') {
      handleHolidaySubmit(e);
    } else {
      if (activeTab === 'fieldWork') handleFieldWorkSubmit(e);
      else if (activeTab === 'dueDate') handleDueDateSubmit(e);
      else handleHolidaySubmit(e);
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

  const handleSyncHolidays = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/system/sync-holidays", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setToast({ message: `Successfully synced ${data.count} new holidays!`, type: "success" });
        fetchCalendarEvents();
      } else {
        setToast({ message: "Sync failed or no new holidays found.", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Connection error.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // --- Helper Functions ---
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

  return (
    <Sidebar>
      <div className="p-2 md:p-4 overflow-x-hidden w-full">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        
        {/* Header & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Calendar Management</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage {isAdmin ? "holidays, due dates, leaves, and field work" : "field work assignments"}
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full md:w-auto">
            {isAdmin && (
                <Button 
                  variant="outline"
                  className="w-full sm:w-auto text-[#2A174E] border-[#2A174E] hover:bg-slate-50 transition-colors"
                  onClick={handleSyncHolidays} 
                  disabled={loading}
                  title="Sync Holidays from Official Gazette"
                >
                  <SyncIcon className={` h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 
                </Button>
            )}
            
            <Button 
              className="w-full sm:w-auto bg-[#2A174E] hover:bg-[#1a0e30] text-white"
              onClick={() => {
                setModalType('addEvent');
                setActiveTab('fieldWork');
              }}
            >
              <AddIcon className="mr-1 h-4 w-4" /> Add Calendar Event
            </Button>
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

        {/* Main Layout Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Calendar Column */}
          <div className="lg:col-span-8">
            <Card className="py-0 overflow-hidden border-0 shadow-sm bg-white">
              <div className=" bg-[#2A174E] text-white flex justify-between items-center p-3 md:p-4 rounded-t-xl">
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

                        {dayEvents.map((e, i) => {
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
                <CardTitle className="text-lg text-[#2A174E]">Upcoming Holidays</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 flex-1 overflow-y-auto custom-scrollbar">
                {getUpcomingHolidays().length > 0 ? (
                  <div className="space-y-2 mt-2">
                    {getUpcomingHolidays().map((holiday, idx) => {
                      const isSpecial = holiday.type?.toLowerCase().includes("special");
                      const accentColor = isSpecial ? "border-l-purple-500" : "border-l-red-500";
                      
                      return (
                        <div 
                          className={`group cursor-pointer transition-all flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-slate-50 rounded-lg hover:bg-slate-100 border border-l-4 ${accentColor}`} 
                          key={idx} 
                          onClick={() => handleHolidayClick(holiday)}
                        >
                          <div>
                            <p className="font-semibold text-sm text-slate-800">{holiday.name}</p>
                            <span className="text-xs text-muted-foreground">
                              {new Date(holiday.date).toLocaleDateString()} • {holiday.type}
                            </span>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1 mt-2 sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-[#2A174E]" onClick={(e) => { e.stopPropagation(); handleOpenEditHoliday(holiday); }}>
                                <EditIcon className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-500 hover:bg-red-50" onClick={(e) => {
                                  e.stopPropagation();
                                  initiateDelete(holiday.id, 'Holiday');
                                }}>
                                <DeleteIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState 
                      className="min-h-0 h-full w-full border-0 bg-transparent hover:bg-transparent shadow-none p-0"
                      icon={<EventAvailableIcon className="w-8 h-8 text-slate-300" />}
                      title="Clear Schedule!"
                      description="No holidays are coming up. It's a straight run of regular working days."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Field Work & Due Dates List Card */}
            <Card className="shadow-sm border-0 bg-white flex flex-col h-[320px] py-0 border-t-4 border-[#FFB33D]">
              <CardHeader className="pb-0 pt-5">
                <CardTitle className="text-lg text-[#C97819 ]">Upcoming Events & Field Work</CardTitle>
              </CardHeader>
              <CardContent className="px-4 flex-1 overflow-y-auto custom-scrollbar">
                {events.filter(e => e.type === "Field Work" || e.type === "Due Date").length > 0 ? (
                  <div className="space-y-2 mt-2">
                    {events.filter(e => e.type === "Field Work" || e.type === "Due Date").map((item, idx) => {
                      const isFieldWork = item.type === "Field Work";
                      const borderColor = isFieldWork ? "border-l-orange-500" : "border-l-teal-500";
                      
                      return (
                        <div 
                          className={`group cursor-pointer transition-all flex flex-row justify-between items-center p-3 bg-slate-50 rounded-lg hover:bg-slate-100 gap-3 border border-l-4 ${borderColor}`} 
                          key={idx} 
                          onClick={() => isFieldWork ? handleFieldWorkClick(item) : null}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-slate-800 truncate">{item.name || item.details}</p>
                            <span className="text-[11px] text-muted-foreground block truncate">
                              {item.date} • {item.type}
                            </span>
                            {isFieldWork && <p className="text-[11px] text-slate-500 mt-0.5 italic truncate">{item.details}</p>}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-red-500 hover:bg-red-50 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0" 
                            onClick={(e) => {
                              e.stopPropagation();
                              initiateDelete(item.id, item.type);
                            }}
                          >
                            <DeleteIcon className="h-4 w-4" />
                          </Button>
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
                      description="There are currently no field assignments or deadlines scheduled."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>

        {/* MODALS */}

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

        {/* MAIN ADD/EDIT DIALOG (Handles Holidays, Field Work, and Due Dates) */}
        <Dialog open={!!modalType} onOpenChange={(open) => !open && setModalType(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-[#2A174E] text-lg font-bold text-center">
                {modalType === 'editHoliday' ? 'Edit Holiday' : 'Add Calendar Event'}
              </DialogTitle>
            </DialogHeader>

            {/* TAB SELECTOR FOR ADMINS */}
            {modalType === 'addEvent' && isAdmin && (
              <div className="flex w-full border-b border-slate-200 mb-2 mt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('fieldWork')}
                  className={`flex-1 pb-2 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'fieldWork' ? 'border-[#ff8c00] text-[#ff8c00]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  Field Work
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('holiday')}
                  className={`flex-1 pb-2 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'holiday' ? 'border-[#2A174E] text-[#2A174E]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  Holiday
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('dueDate')}
                  className={`flex-1 pb-2 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'dueDate' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  Due Date
                </button>
              </div>
            )}

            <form onSubmit={handleModalSubmit}>
              <div className="grid gap-4 p-2 h-[300px] content-start overflow-y-auto custom-scrollbar pr-1">
                
                {/* --- ADD DUE DATE FORM --- */}
                {(modalType === 'addEvent' && activeTab === 'dueDate') && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="due-title">Title / Name</Label>
                      <Input 
                        id="due-title"
                        placeholder="e.g., BIR Tax Deadline" 
                        value={dueDateForm.title}
                        onChange={(e) => setDueDateForm({...dueDateForm, title: e.target.value})}
                        required
                        className="w-full focus-visible:ring-teal-500" 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="due-date">Date</Label>
                      <Input 
                        id="due-date"
                        type="date" 
                        value={dueDateForm.date}
                        onChange={(e) => setDueDateForm({...dueDateForm, date: e.target.value})}
                        required
                        className="w-full focus-visible:ring-teal-500"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="due-desc">Description (Optional)</Label>
                      <Input 
                        id="due-desc"
                        placeholder="e.g., Submit Form 1601-C"
                        value={dueDateForm.description}
                        onChange={(e) => setDueDateForm({...dueDateForm, description: e.target.value})}
                        className="w-full focus-visible:ring-teal-500"
                      />
                    </div>
                  </>
                )}

                {/* --- ADD FIELD WORK FORM --- */}
                {(modalType === 'addEvent' && activeTab === 'fieldWork') && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="employee">Select Employee</Label>
                      <Select value={fieldWorkForm.userId} onValueChange={(val) => setFieldWorkForm({...fieldWorkForm, userId: val})} required>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose Employee..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.user_Id} value={emp.user_Id.toString()}>
                              {formatUserId(emp.user_Id)} - {emp.user_LastName} {emp.user_FirstName?.charAt(0)}.
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="date">Date</Label>
                      <Input 
                        id="date"
                        type="date" 
                        value={fieldWorkForm.date}
                        onChange={(e) => setFieldWorkForm({...fieldWorkForm, date: e.target.value})}
                        required
                        className="w-full"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="location">Location</Label>
                      <Input 
                        id="location"
                        placeholder="e.g., Client Site A" 
                        value={fieldWorkForm.location}
                        onChange={(e) => setFieldWorkForm({...fieldWorkForm, location: e.target.value})}
                        required
                        className="w-full"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="hours">Hours</Label>
                      <Input 
                        id="hours"
                        type="number" 
                        step="0.5"
                        value={fieldWorkForm.hours}
                        onChange={(e) => setFieldWorkForm({...fieldWorkForm, hours: e.target.value})}
                        required
                        className="w-full"
                      />
                    </div>
                  </>
                )}

                {/* --- ADD/EDIT HOLIDAY FORM --- */}
                {(modalType === 'editHoliday' || (modalType === 'addEvent' && activeTab === 'holiday')) && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="name">Holiday Name</Label>
                      <Input 
                        id="name"
                        placeholder="Enter name" 
                        value={holidayForm.name}
                        onChange={(e) => setHolidayForm({...holidayForm, name: e.target.value})}
                        required
                        className="w-full focus-visible:ring-[#2A174E]/90" 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="date">Date</Label>
                      <Input 
                        id="date"
                        type="date" 
                        value={holidayForm.date}
                        onChange={(e) => setHolidayForm({...holidayForm, date: e.target.value})}
                        required
                        className="w-full"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="type">Type</Label>
                      <Select value={holidayForm.type} onValueChange={(val) => setHolidayForm({...holidayForm, type: val})}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Regular Holiday" className="text-red-700">Regular Holiday</SelectItem>
                          <SelectItem value="Special Holiday" className="text-purple-700">Special Holiday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setModalType(null)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className={`w-full sm:w-auto text-white ${
                    modalType === 'editHoliday' ? 'bg-[#2A174E] hover:bg-[#1a0e30]' 
                    : activeTab === 'fieldWork' ? 'bg-[#ff8c00] hover:bg-[#e67e00]'
                    : activeTab === 'dueDate' ? 'bg-teal-600 hover:bg-teal-700'
                    : 'bg-[#2A174E] hover:bg-[#1a0e30]'
                  }`}
                >
                  {modalType === 'editHoliday' ? 'Save Changes' : 'Submit'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DELETE CONFIRMATION ALERT DIALOG */}
        <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this calendar entry? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowDeleteModal(false); setItemToDelete(null); }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* HOLIDAY CONFLICT DIALOG */}
        <Dialog open={!!selectedHolidayWork} onOpenChange={(open) => !open && setSelectedHolidayWork(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Field Work on {selectedHolidayWork?.holiday.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-4">
              {selectedHolidayWork?.matchingWork.map((work, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg text-sm border border-slate-200">
                  <strong className="text-slate-800">Location:</strong> {work.details} <br/>
                  <strong className="text-slate-800 mt-1 block">Assigned:</strong> {userData.user_FirstName} {userData.user_LastName}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* FIELD WORK LOG DIALOG */}
        <Dialog open={!!selectedFieldLog} onOpenChange={(open) => !open && setSelectedFieldLog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Field Work Log Summary</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm pt-4">
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Date:</span> 
                <span className="text-slate-800 font-medium">{selectedFieldLog?.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Task:</span> 
                <span className="text-slate-800 text-right max-w-[60%] font-medium">{selectedFieldLog?.details}</span>
              </div>
              <hr className="my-4 border-slate-100" />
              <p className="text-xs italic text-green-600 m-0">This assignment is automatically credited as 8 hours worked on-field.</p>
            </div>
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
                    if(event.details?.toLowerCase().includes("special")) {
                      typeClass = "bg-purple-50 text-purple-800 border-purple-200";
                      dotBg = "bg-purple-400";
                    }
                  } else if (event.type === "Leave") {
                    typeClass = "bg-green-50 text-green-800 border-green-200";
                    dotBg = "bg-green-400";
                  } else if (event.type === "Field Work") {
                    typeClass = "bg-orange-50 text-orange-800 border-orange-200";
                    dotBg = "bg-orange-400";
                  } else if (event.type === "Overtime") {
                    typeClass = "bg-blue-50 text-blue-800 border-blue-200";
                    dotBg = "bg-blue-400";
                  } else if (event.type === "Due Date") {
                    typeClass = "bg-teal-50 text-teal-800 border-teal-200";
                    dotBg = "bg-teal-400";
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

        <style dangerouslySetContent={{__html: `  
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
  );
};

export default CalendarManagement;