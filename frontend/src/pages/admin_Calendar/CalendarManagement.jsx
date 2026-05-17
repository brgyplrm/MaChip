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
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckIcon from '@mui/icons-material/Check';

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "lucide-react";


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

  const [batchFile, setBatchFile] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const [selectedHolidayDetails, setSelectedHolidayDetails] = useState(null);

  // --- NEW: BATCH CSV LOGIC ---
  const downloadHolidayTemplate = () => {
    const headers = "type,name,date,details\n";
    const sample = "Holiday,Independence Day,2026-06-12,Regular Holiday\nHoliday,Bonifacio Day,2026-11-30,Regular Holiday";
    const blob = new Blob([headers + sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "holiday_batch_template.csv";
    a.click();
  };

  const downloadDueDateTemplate = () => {
    const headers = "type,name,date,details\n";
    const sample = "Due Date,BIR Filing,2026-06-15,Form 1701Q Submission\nDue Date,Payroll Cutoff,2026-06-25,Admin Processing";
    const blob = new Blob([headers + sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "due_date_batch_template.csv";
    a.click();
  };

  const downloadFieldWorkTemplate = () => {
  const headers = "user_Id,date,location,hours,purpose\n";
  const sample = "MACJ-001,2026-05-20,Client Site A,8.0,System Installation\nMACJ-002,2026-05-20,Warehouse B,4.0,Inventory Audit";
  const blob = new Blob([headers + sample], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "fieldwork_batch_template.csv";
  a.click();
};

  const handleBatchUpload = async () => {
    if (!batchFile) return setToast({ message: "Please select a file.", type: "error" });
    setBatchLoading(true);
    
    const formData = new FormData();
    formData.append("csvFile", batchFile);

    try {
      const response = await fetchWithAuth("/api/system/batch-calendar", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        if (result.count > 0) {
          let msg = `Successfully uploaded ${result.count} event(s).`;
          if (result.errors && result.errors.length > 0) {
            msg += ` ${result.errors.length} row(s) failed.`;
            console.warn("[BATCH UPLOAD] Errors encountered:", result.errors);
          }
          setToast({ message: msg, type: result.errors?.length > 0 ? "warning" : "success" });
          setModalType(null);
          setBatchFile(null);
          fetchCalendarEvents();
        } else {
          setToast({ 
            message: result.errors?.[0] || "No records were uploaded. Please check your file format.", 
            type: "error" 
          });
        }
      } else {
        setToast({ message: result.error || "Upload failed.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error.", type: "error" });
    } finally {
      setBatchLoading(false);
    }
  };

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
  const isManagerOrAccountant = [1, 4].includes(parseInt(userData.user_RoleId));
  const isAdmin = isManagerOrAccountant; // Using isAdmin as the gatekeeper for editing features

  const [selectedHolidayWork, setSelectedHolidayWork] = useState(null);
  const [selectedFieldLog, setSelectedFieldLog] = useState(null);

  const handleHolidayClick = (holiday) => {
    const matchingWork = events.filter(e => 
      e.type === "Field Work" && 
      e.date.split('T')[0] === holiday.date.split('T')[0]
    );

    setSelectedHolidayDetails({
    holiday,
    matchingWork
  });

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
      type: holiday.details || "Regular Holiday"
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
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
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
                          className={`group cursor-pointer transition-all flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-slate-50 rounded-lg hover:bg-slate-100 border border-l-4 ${accentColor}`} 
                          key={idx} 
                          onClick={() => handleHolidayClick(holiday)}
                        >
                          <div>
                            <p className="font-semibold text-sm text-slate-800">{holiday.name}</p>
                            <span className="text-xs text-muted-foreground">
                              {new Date(holiday.date).toLocaleDateString()} • {holiday.details || holiday.type}
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
                    <EmptyState 
                      className="min-h-0 h-full w-full border-0 bg-transparent hover:bg-transparent shadow-none p-0"
                      icon={<EventAvailableIcon sx={{ fontSize: 32 }} className="text-slate-300" />}
                      title="No Holidays"
                      description="There are no holidays registered for this period."
                    />
                )}
              </CardContent>
            </Card>

            {/* 2. NEW: Due Dates List Card */}
            <Card className="shadow-sm border-0 bg-white flex flex-col flex-1 py-0 border-t-4 border-teal-500 min-h-[250px]">
              <CardHeader className="pb-0 pt-4">
                <CardTitle className="text-lg text-teal-700">Administrative Due Dates</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 flex-1 overflow-y-auto custom-scrollbar">
                {events.filter(e => e.type === "Due Date").length > 0 ? (
                  <div className="space-y-2 mt-2">
                    {events.filter(e => e.type === "Due Date").map((item, idx) => (
                      <div className="group transition-all flex flex-row justify-between items-center p-3 bg-slate-50 rounded-lg border border-l-4 border-l-teal-500" key={idx}>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                          <span className="text-[11px] text-muted-foreground block">
                            {new Date(item.date).toLocaleDateString()}
                          </span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => initiateDelete(item.id, 'Due Date')}>
                          <DeleteIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState className="!h-full !border-0 bg-transparent" title="No Due Dates" description="No deadlines set." />
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
                    <EmptyState 
                      className="!h-full !min-h-0 border-0 bg-transparent hover:bg-transparent shadow-none !p-2"
                      icon={<MapIcon sx={{ fontSize: 32 }} className="text-slate-300" />}
                      title="No Tasks Found"
                      description="No field assignments scheduled."
                    />
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

       {/* MAIN ADD/EDIT DIALOG (Holidays, Field Work, and Due Dates with Integrated Batch) */}
      <Dialog open={!!modalType} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#2A174E] text-lg font-bold text-center">
              {modalType === 'editHoliday' ? 'Edit Holiday' : 'Add Calendar Event'}
            </DialogTitle>
          </DialogHeader>

          {modalType === 'addEvent' && isAdmin && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Main Category Selection */}
              <TabsList className="grid w-full grid-cols-3 h-11 bg-slate-200/60 p-1 rounded-lg mb-6">
                <TabsTrigger value="fieldWork" className="font-bold data-[state=active]:text-orange-600">Field Work</TabsTrigger>
                <TabsTrigger value="holiday" className="font-bold data-[state=active]:text-red-600">Holiday</TabsTrigger>
                <TabsTrigger value="dueDate" className="font-bold data-[state=active]:text-teal-600">Due Date</TabsTrigger>
              </TabsList>

              {/* --- FIELD WORK TAB --- */}
              <TabsContent value="fieldWork" className="mt-0">
                <Tabs defaultValue="single">
                  <TabsList className="flex gap-4 bg-transparent mb-4">
                    <TabsTrigger value="single" className="
                     px-4 py-2 bg-transparent shadow-none rounded-none
                        text-sm font-semibold text-slate-400
                        /* Remove all default borders first */
                        border-0 
                        /* Force specific sides to 0 while applying bottom */
                        data-[state=active]:bg-transparent 
                        data-[state=active]:shadow-0
                        data-[state=active]:text-orange-900 
                        data-[state=active]:border-b-2 
                        data-[state=active]:border-x-0 
                        data-[state=active]:border-t-0
                        data-[state=active]:border-orange-500 
                        transition-all">
                      Single Entry
                    </TabsTrigger>
                    <TabsTrigger value="batch" className="
                        px-4 py-2 bg-transparent shadow-none rounded-none
                        text-sm font-semibold text-slate-400
                        /* Remove all default borders first */
                        border-0 
                        /* Force specific sides to 0 while applying bottom */
                        data-[state=active]:bg-transparent 
                        data-[state=active]:shadow-0
                        data-[state=active]:text-orange-900 
                        data-[state=active]:border-b-2 
                        data-[state=active]:border-x-0 
                        data-[state=active]:border-t-0
                        data-[state=active]:border-orange-500 
                        transition-all">
                      Batch Upload
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="single" className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Select Employee</Label>
                      <Select value={fieldWorkForm.userId} onValueChange={(val) => setFieldWorkForm({...fieldWorkForm, userId: val})}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose Employee..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.user_Id} value={emp.user_Id.toString()}>
                              {formatUserId(emp.user_Id)} - {emp.user_LastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Date</Label>
                        <Input type="date" value={fieldWorkForm.date} onChange={(e) => setFieldWorkForm({...fieldWorkForm, date: e.target.value})} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Hours</Label>
                        <Input type="number" step="0.5" value={fieldWorkForm.hours} onChange={(e) => setFieldWorkForm({...fieldWorkForm, hours: e.target.value})} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Location</Label>
                      <Input placeholder="e.g., Client Site A" value={fieldWorkForm.location} onChange={(e) => setFieldWorkForm({...fieldWorkForm, location: e.target.value})} />
                    </div>
                    <DialogFooter className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setModalType(null)} className="flex-1">Cancel</Button>
                      <Button className="flex-1 bg-orange-500 hover:bg-orange-600 text-white" onClick={handleFieldWorkSubmit}>Assign</Button>
                    </DialogFooter>
                  </TabsContent>

                  <TabsContent value="batch" className="mt-0">
                    <div className="space-y-4">
                      {/* Visual Header Icon & Text */}
                      <div className="flex flex-col items-center justify-center pt-4">
                        <div className="bg-orange-50 p-6 rounded-full mb-4">
                          <UploadFileIcon className="text-orange-600 h-12 w-12 opacity-80" />
                        </div>
                        <div className="text-center mb-6 max-w-sm">
                          <h3 className="text-xl font-bold text-slate-900 mb-1">Batch Field Assignment</h3>
                          <p className="text-slate-500 text-sm leading-relaxed">
                            Bulk assign multiple employees to field work locations. 
                            Use the template below to ensure data accuracy.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-4 w-full">
                        {/* Template Download - Matches New.jsx button style but keeps orange theme */}
                        <Button 
                          variant="outline" 
                          onClick={downloadFieldWorkTemplate} 
                          className="w-full h-11 text-orange-700 border-orange-200 hover:bg-orange-50 font-semibold"
                        >
                          <FileDownloadOutlinedIcon className="mr-2 h-4 w-4" /> Download Field Template
                        </Button>
                        
                        {/* Dashed Upload Area */}
                        <div className="w-full relative border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors group">
                          <Input 
                            type="file" 
                            accept=".csv" 
                            onChange={(e) => setBatchFile(e.target.files[0])} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                          />
                          <div className="pointer-events-none">
                            {batchFile ? (
                              <p className="text-green-600 font-semibold flex items-center justify-center gap-2">
                                <span className="truncate max-w-[200px]">{batchFile.name}</span> selected
                              </p>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-slate-500 font-medium">Click to browse or drag and drop CSV</p>
                                <p className="text-xs text-slate-400">Standard fieldwork_batch_template.csv</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Footer */}
                        <DialogFooter className="flex gap-2 w-full pt-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setModalType(null)} 
                            className="flex-1 h-11"
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleBatchUpload} 
                            disabled={batchLoading || !batchFile} 
                            className="flex-[2] h-11 bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm"
                          >
                            {batchLoading ? "Processing..." : "Confirm Batch Upload"}
                          </Button>
                        </DialogFooter>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* --- HOLIDAY TAB --- */}
              <TabsContent value="holiday" className="mt-0">
                <Tabs defaultValue="single">
                  <TabsList className="flex gap-4 bg-transparent mb-4">
                    <TabsTrigger value="single" className="
                        px-4 py-2 bg-transparent shadow-none rounded-none
                        text-sm font-semibold text-slate-400
                        /* Remove all default borders first */
                        border-0 
                        /* Force specific sides to 0 while applying bottom */
                        data-[state=active]:bg-transparent 
                        data-[state=active]:shadow-0
                        data-[state=active]:text-red-900 
                        data-[state=active]:border-b-2 
                        data-[state=active]:border-x-0 
                        data-[state=active]:border-t-0
                        data-[state=active]:border-red-600 
                        transition-all">
                      Single Entry</TabsTrigger>
                    <TabsTrigger value="batch" className="
                    px-4 py-2 bg-transparent shadow-none rounded-none
                        text-sm font-semibold text-slate-400
                        /* Remove all default borders first */
                        border-0 
                        /* Force specific sides to 0 while applying bottom */
                        data-[state=active]:bg-transparent 
                        data-[state=active]:shadow-0
                        data-[state=active]:text-red-900 
                        data-[state=active]:border-b-2 
                        data-[state=active]:border-x-0 
                        data-[state=active]:border-t-0
                        data-[state=active]:border-red-600 
                        transition-all">
                      Batch Upload
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="single" className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Holiday Name</Label>
                      <Input placeholder="e.g., Independence Day" value={holidayForm.name} onChange={(e) => setHolidayForm({...holidayForm, name: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Date</Label>
                      <Input type="date" value={holidayForm.date} onChange={(e) => setHolidayForm({...holidayForm, date: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Type</Label>
                      <Select value={holidayForm.type} onValueChange={(val) => setHolidayForm({...holidayForm, type: val})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Regular Holiday">Regular Holiday</SelectItem>
                          <SelectItem value="Special Holiday">Special Holiday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setModalType(null)} className="flex-1">Cancel</Button>
                      <Button className="flex-1 bg-red-600 text-white" onClick={handleHolidaySubmit}>Save</Button>
                    </DialogFooter>
                  </TabsContent>

                  <TabsContent value="batch" className="mt-0">
                    <div className="space-y-4">
                      {/* Visual Header Icon & Text */}
                      <div className="flex flex-col items-center justify-center pt-4">
                        <div className="bg-red-50 p-6 rounded-full mb-4">
                          <UploadFileIcon className="text-red-600 h-12 w-12 opacity-80" />
                        </div>
                        <div className="text-center mb-6 max-w-sm">
                          <h3 className="text-xl font-bold text-slate-900 mb-1">Batch Holiday Upload</h3>
                          <p className="text-slate-500 text-sm leading-relaxed">
                            Quickly register multiple regular or special holidays. 
                            Use the template to ensure dates are formatted correctly.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-4 w-full">
                        {/* Template Download */}
                        <Button 
                          variant="outline" 
                          onClick={downloadHolidayTemplate} 
                          className="w-full h-11 text-red-700 border-red-200 hover:bg-red-50 font-semibold"
                        >
                          <FileDownloadOutlinedIcon className="mr-2 h-4 w-4" /> Download Holiday Template
                        </Button>
                        
                        {/* Dashed Upload Area */}
                        <div className="w-full relative border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors group">
                          <Input 
                            type="file" 
                            accept=".csv" 
                            onChange={(e) => setBatchFile(e.target.files[0])} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                          />
                          <div className="pointer-events-none">
                            {batchFile ? (
                              <p className="text-green-600 font-semibold flex items-center justify-center gap-2">
                                <CheckIcon className="h-4 w-4" /> <span className="truncate max-w-[200px]">{batchFile.name}</span>
                              </p>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-slate-500 font-medium">Click to browse or drag and drop CSV</p>
                                <p className="text-xs text-slate-400">Supported format: .csv</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Footer */}
                        <DialogFooter className="flex gap-2 w-full pt-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setModalType(null)} 
                            className="flex-1 h-11"
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleBatchUpload} 
                            disabled={batchLoading || !batchFile} 
                            className="flex-[2] h-11 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm"
                          >
                            {batchLoading ? "Processing..." : "Upload Holidays"}
                          </Button>
                        </DialogFooter>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* --- DUE DATE TAB --- */}
              <TabsContent value="dueDate" className="mt-0">
                <Tabs defaultValue="single">
                  <TabsList className="flex gap-4 bg-transparent mb-4">
                    <TabsTrigger value="single" className="
                     px-4 py-2 bg-transparent shadow-none rounded-none
                        text-sm font-semibold text-slate-400
                        /* Remove all default borders first */
                        border-0 
                        /* Force specific sides to 0 while applying bottom */
                        data-[state=active]:bg-transparent 
                        data-[state=active]:shadow-0
                        data-[state=active]:text-teal-900 
                        data-[state=active]:border-b-2 
                        data-[state=active]:border-x-0 
                        data-[state=active]:border-t-0
                        data-[state=active]:border-teal-500 
                        transition-all">
                      Single Entry
                      </TabsTrigger>
                    <TabsTrigger value="batch" className="
                     px-4 py-2 bg-transparent shadow-none rounded-none
                        text-sm font-semibold text-slate-400
                        /* Remove all default borders first */
                        border-0 
                        /* Force specific sides to 0 while applying bottom */
                        data-[state=active]:bg-transparent 
                        data-[state=active]:shadow-0
                        data-[state=active]:text-teal-900
                        data-[state=active]:border-b-2 
                        data-[state=active]:border-x-0 
                        data-[state=active]:border-t-0
                        data-[state=active]:border-teal-500 
                        transition-all">
                      Batch Upload
                      </TabsTrigger>
                  </TabsList>

                  <TabsContent value="single" className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Title</Label>
                      <Input placeholder="e.g., BIR Tax Deadline" value={dueDateForm.title} onChange={(e) => setDueDateForm({...dueDateForm, title: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Deadline Date</Label>
                      <Input type="date" value={dueDateForm.date} onChange={(e) => setDueDateForm({...dueDateForm, date: e.target.value})} />
                    </div>
                    <DialogFooter className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setModalType(null)} className="flex-1">Cancel</Button>
                      <Button className="flex-1 bg-teal-600 text-white" onClick={handleDueDateSubmit}>Set Due Date</Button>
                    </DialogFooter>
                  </TabsContent>

                  <TabsContent value="batch" className="mt-0">
                    <div className="space-y-4">
                      {/* Visual Header Icon & Text */}
                      <div className="flex flex-col items-center justify-center pt-4">
                        <div className="bg-teal-50 p-6 rounded-full mb-4">
                          <UploadFileIcon className="text-teal-600 h-12 w-12 opacity-80" />
                        </div>
                        <div className="text-center mb-6 max-w-sm">
                          <h3 className="text-xl font-bold text-slate-900 mb-1">Batch Due Date Upload</h3>
                          <p className="text-slate-500 text-sm leading-relaxed">
                            Import multiple administrative deadlines or custom project due dates 
                            into the system calendar.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-4 w-full">
                        {/* Template Download */}
                        <Button 
                          variant="outline" 
                          onClick={downloadDueDateTemplate} 
                          className="w-full h-11 text-teal-700 border-teal-200 hover:bg-teal-50 font-semibold"
                        >
                          <FileDownloadOutlinedIcon className="mr-2 h-4 w-4" /> Download Due Date Template
                        </Button>
                        
                        {/* Dashed Upload Area */}
                        <div className="w-full relative border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors group">
                          <Input 
                            type="file" 
                            accept=".csv" 
                            onChange={(e) => setBatchFile(e.target.files[0])} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                          />
                          <div className="pointer-events-none">
                            {batchFile ? (
                              <p className="text-green-600 font-semibold flex items-center justify-center gap-2">
                                <CheckIcon className="h-4 w-4" /> <span className="truncate max-w-[200px]">{batchFile.name}</span>
                              </p>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-slate-500 font-medium">Click to browse or drag and drop CSV</p>
                                <p className="text-xs text-slate-400">File must contain name, date, and details</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Footer */}
                        <DialogFooter className="flex gap-2 w-full pt-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setModalType(null)} 
                            className="flex-1 h-11"
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleBatchUpload} 
                            disabled={batchLoading || !batchFile} 
                            className="flex-[2] h-11 bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm"
                          >
                            {batchLoading ? "Processing..." : "Upload Due Dates"}
                          </Button>
                        </DialogFooter>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          )}
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

        {/* HOLIDAY DETAIL DIALOG */}
        <Dialog 
          open={!!selectedHolidayDetails} 
          onOpenChange={(open) => !open && setSelectedHolidayDetails(null)}
        >
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-[#2A174E] flex items-center gap-2">
                <EventAvailableIcon className={
                  selectedHolidayDetails?.holiday.details?.toLowerCase().includes("special") 
                  ? "text-purple-500" 
                  : "text-red-500"
                } />
                Holiday Details
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              {/* Primary Info Card */}
              <div className={`p-5 rounded-xl border-l-4 shadow-sm ${
                selectedHolidayDetails?.holiday.details?.toLowerCase().includes("special") 
                  ? "bg-purple-50 border-purple-500" 
                  : "bg-red-50 border-red-500"
              }`}>
                <h3 className="text-xl font-bold text-slate-800 mb-1">
                  {selectedHolidayDetails?.holiday.name}
                </h3>
                <p className="text-sm font-medium text-slate-600">
                  {selectedHolidayDetails?.holiday.date && new Date(selectedHolidayDetails.holiday.date).toLocaleDateString('en-US', { 
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
                  })}
                </p>
                {/* <Badge className={`mt-3 font-bold uppercase tracking-widest text-[10px] ${
                  selectedHolidayDetails?.holiday.details?.toLowerCase().includes("special") 
                    ? "bg-purple-200 text-purple-800 hover:bg-purple-200" 
                    : "bg-red-200 text-red-800 hover:bg-red-200"
                }`}>
                  {selectedHolidayDetails?.holiday.details || "Regular Holiday"}
                </Badge> */}
              </div>

              {/* Conflicting Field Work Section */}
              {selectedHolidayDetails?.matchingWork.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                    Employees Assigned on this Day
                  </Label>
                  {selectedHolidayDetails.matchingWork.map((work, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#2A174E]">{work.name}</span>
                        <span className="text-[11px] text-slate-500">{work.details}</span>
                      </div>
                      <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                        Field Work
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* System Note */}
              <div className="text-[11px] text-slate-400 italic text-center px-4">
                Official holiday records are synced with the Philippine National Calendar.
              </div>
            </div>

            <DialogFooter className="sm:justify-center">
              <Button 
                variant="outline" 
                className="w-full sm:w-32" 
                onClick={() => setSelectedHolidayDetails(null)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* FIELD WORK LOG DIALOG */}
        <Dialog open={!!selectedFieldLog} onOpenChange={(open) => !open && setSelectedFieldLog(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-[#2A174E] flex items-center gap-2">
                <AssignmentIcon className="text-orange-500" />
                Field Work Log Summary
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm pt-4">
              {/* Employee Name Section */}
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="font-semibold text-slate-500">Employee:</span> 
                <span className="text-[#2A174E] font-bold text-base">
                  {selectedFieldLog?.name || "N/A"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 px-1">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Date</span> 
                  <span className="text-slate-800 font-medium">{selectedFieldLog?.date}</span>
                </div>
                
                {/* Hours Display */}
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">No. of Hours</span> 
                  <span className="text-orange-600 font-bold">{selectedFieldLog?.hours || selectedFieldLog?.NoHrs || "8"} Hours</span>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Location</span> 
                  <span className="text-slate-800 text-right max-w-[60%] font-medium">{selectedFieldLog?.details}</span>
                </div>
              </div>
              
              <div className="p-3 bg-orange-50 rounded-lg text-[11px] text-orange-700 italic border border-orange-100">
                Note: This is a system-verified field assignment. Attendance is automatically credited for this duration.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="w-full" onClick={() => setSelectedFieldLog(null)}>
                Close Summary
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
  );
};

export default CalendarManagement;