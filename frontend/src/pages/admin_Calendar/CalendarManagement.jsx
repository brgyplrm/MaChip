import Sidebar from "../../components/Sidebar";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SyncIcon from '@mui/icons-material/Sync';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AssignmentIcon from '@mui/icons-material/Assignment'; 
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckIcon from '@mui/icons-material/Check';
import Toast from "../../components/toast/Toast";
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import { useState, useEffect } from "react";
import { formatUserId } from "../../utils/formatUserId";
import EmptyState from "@/components/EmptyState";
import BatchUploadReviewModal from "../../components/BatchUploadReviewModal";


// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";


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

  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedDueDateDetails, setSelectedDueDateDetails] = useState(null);
  const handleDueDateClick = (dueDate) => {
    setSelectedDueDateDetails(dueDate);
  };

  const [selectedPersonnelAction, setSelectedPersonnelAction] = useState(null);

  const handlePersonnelActionClick = (action) => {
    setSelectedPersonnelAction(action);
  };

  const [selectedHolidayDetails, setSelectedHolidayDetails] = useState(null);

  // --- BATCH REVIEW LOGIC ---
  const [reviewData, setReviewData] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewType, setReviewType] = useState("");

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length < 2) {
        setToast({ message: "CSV file is empty or missing data rows.", type: "error" });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] || "";
        });
        return obj;
      });

      setReviewData(data);
      setReviewType(type);
      setIsReviewModalOpen(true);
    };
    reader.readAsText(file);
  };

  const handleConfirmReview = async (finalData) => {
    setBatchLoading(true);
    
    // Convert back to CSV
    const headers = Object.keys(finalData[0]).join(',');
    const rows = finalData.map(item => Object.values(item).join(',')).join('\n');
    const csvContent = headers + '\n' + rows;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const file = new File([blob], "batch_upload.csv", { type: 'text/csv' });

    const formData = new FormData();
    formData.append("csvFile", file);

    try {
      const response = await fetchWithAuth("/api/system/batch-calendar", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setToast({ message: `Successfully uploaded ${result.count} records.`, type: "success" });
        setIsReviewModalOpen(false);
        setModalType(null);
        fetchCalendarEvents();
      } else {
        setToast({ message: result.error || "Upload failed.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error.", type: "error" });
    } finally {
      setBatchLoading(false);
    }
  };

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
    const headers = "type,name,date,details,priority,reminder\n";
    const sample = "Due Date,BIR Tax Filing,2026-06-15,Form 1701Q,Critical,1 day before\nDue Date,Payroll Cutoff,2026-06-25,Admin Processing,Medium,3 days before";
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

  const handleHolidayClick = (holiday) => {
    const matchingWork = events.filter(e => 
      e.type === "Field Work" && 
      e.date.split('T')[0] === holiday.date.split('T')[0]
    );

    setSelectedHolidayDetails({
    holiday,
    matchingWork
  });
  };

  const handleFieldWorkClick = (fieldWork) => {
    setSelectedFieldLog(fieldWork);
  };

  const [selectedFieldLog, setSelectedFieldLog] = useState(null);

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
      description: "", 
      priority: "Medium",
      reminder: "1 day before"
    });

  const handleOpenEditHoliday = (holiday) => {
  setHolidayForm({
    id: holiday.id,
    name: holiday.name,
    date: holiday.date.split('T')[0], // Ensure YYYY-MM-DD
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
                  className="w-full sm:w-auto bg-[#2A174E] hover:bg-[#7A52B5] text-white"
                  onClick={() => {
                    setModalType('addEvent');
                    setActiveTab('fieldWork');
                  }}
                >
                  <AddIcon className="mr-1 h-4 w-4" /> Add Calendar Event
                </Button>
            )}
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
        <div className="grid grid-cols-1">
          
          <div className="w-full">
            <Card className="py-0 overflow-hidden border-0 shadow-sm bg-white">
              <div className=" bg-[#2A174E] text-white flex justify-between items-center p-3 md:p-4 rounded-t-xl">
                <ChevronLeftIcon className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => changeMonth(-1)} />
                
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
          <div className="h-6" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
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
                          onClick={() => handleHolidayClick(holiday)}
                        >
                          <div className="flex flex-col min-w-0 pr-12">
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
                            
                            {isAdmin && (
                              <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm p-1 rounded-md shadow-sm border border-slate-100 flex gap-1 z-10">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-slate-500 hover:text-[#2A174E]" 
                                  onClick={(e) => { e.stopPropagation(); handleOpenEditHoliday(holiday); }}
                                >
                                  <EditIcon className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-slate-500 hover:text-red-500" 
                                  onClick={(e) => { e.stopPropagation(); initiateDelete(holiday.id, 'Holiday'); }}
                                >
                                  <DeleteIcon className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
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

            <Card className="shadow-sm border-0 h-[500px] border-t-4 border-green-600 py-0 overflow-hidden">
              <CardHeader className="pb-0 pt-5">
                <CardTitle className="text-lg text-green-700">Personnel Actions</CardTitle>
              </CardHeader>
              <CardContent className="h-[440px] pt-0 px-0">
                <Tabs defaultValue="leave" className="w-full h-full flex flex-col">
                  <TabsList className="grid w-[90%] mx-auto grid-cols-2 mb-4">
                    <TabsTrigger value="leave">Leaves</TabsTrigger>
                    <TabsTrigger value="ot">Overtime</TabsTrigger>
                  </TabsList>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
                    <TabsContent value="leave" className="mt-0 space-y-2">
                      {events.filter(e => e.type === "Leave").map((item, i) => (
                        <div 
                        key={i} 
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:bg-green-50/50 transition-colors cursor-pointer group"
                        onClick={() => handlePersonnelActionClick(item)} >
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-800">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 hover:bg-green-100">LEAVE</Badge>
                        </div>
                      ))}
                    </TabsContent>
                    
                    <TabsContent value="ot" className="mt-0 space-y-2">
                      {events.filter(e => e.type === "Overtime").map((item, i) => (
                        <div 
                          key={i} 
                          className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:bg-blue-50/50 transition-colors cursor-pointer group"
                          onClick={() => handlePersonnelActionClick(item)}>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-800">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100">OT</Badge>
                        </div>
                      ))}
                    </TabsContent>
                    <div className="h-6" />
                  </div>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-0 h-[500px] border-t-4 border-orange-500 py-0 overflow-hidden">
              <CardHeader className="pb-0 pt-5">
                <CardTitle className="text-lg text-orange-700">Operational Tasks</CardTitle>
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
                            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:bg-orange-50/50 transition-colors cursor-pointer group"
                            onClick={() => handleFieldWorkClick(item)}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-slate-800 truncate">{item.name || item.details}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-700">FIELD</Badge>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); initiateDelete(item.id, 'Field Work'); }}>
                                <DeleteIcon className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
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
                            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:bg-teal-50/50 transition-colors cursor-pointer group"
                            onClick={() => handleDueDateClick(item)}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-slate-800 truncate">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px] bg-teal-100 text-teal-700">DUE</Badge>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); initiateDelete(item.id, 'Due Date'); }}>
                                <DeleteIcon className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
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

      <Dialog open={!!modalType && modalType !== 'editHoliday'} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#2A174E] text-lg font-bold text-center">
              Add Calendar Event
            </DialogTitle>
          </DialogHeader>

          {isAdmin && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-11 bg-slate-200/60 p-1 rounded-lg mb-6">
                <TabsTrigger value="fieldWork" className="font-bold data-[state=active]:text-orange-600">Field Work</TabsTrigger>
                <TabsTrigger value="holiday" className="font-bold data-[state=active]:text-red-600">Holiday</TabsTrigger>
                <TabsTrigger value="dueDate" className="font-bold data-[state=active]:text-teal-600">Due Date</TabsTrigger>
              </TabsList>

              <TabsContent value="fieldWork" className="mt-0">
                <Tabs defaultValue="single">
                  <TabsList className="flex gap-4 bg-transparent mb-4">
                    <TabsTrigger value="single" className="px-4 py-2 bg-transparent shadow-none rounded-none text-sm font-semibold text-slate-400 border-0 data-[state=active]:text-orange-900 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 transition-all">Single Entry</TabsTrigger>
                    <TabsTrigger value="batch" className="px-4 py-2 bg-transparent shadow-none rounded-none text-sm font-semibold text-slate-400 border-0 data-[state=active]:text-orange-900 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 transition-all">Batch Upload</TabsTrigger>
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
                      <div className="flex flex-col items-center justify-center pt-4">
                        <div className="bg-orange-50 p-6 rounded-full mb-4">
                          <UploadFileIcon className="text-orange-600 h-12 w-12 opacity-80" />
                        </div>
                        <div className="text-center mb-6 max-w-sm">
                          <h3 className="text-xl font-bold text-slate-900 mb-1">Batch Field Assignment</h3>
                          <p className="text-slate-500 text-sm leading-relaxed">Bulk assign multiple employees to field work locations.</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-4 w-full">
                        <Button variant="outline" onClick={downloadFieldWorkTemplate} className="w-full h-11 text-orange-700 border-orange-200 hover:bg-orange-50 font-semibold">
                          <FileDownloadOutlinedIcon className="mr-2 h-4 w-4" /> Download Field Template
                        </Button>
                        <div className="w-full relative border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors group">
                          <Input type="file" accept=".csv" onChange={(e) => handleFileChange(e, "Field Work")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          <div className="pointer-events-none text-slate-500 font-medium">Click to browse or drag and drop CSV</div>
                        </div>
                        <DialogFooter className="flex gap-2 w-full pt-2">
                          <Button type="button" variant="outline" onClick={() => setModalType(null)} className="flex-1 h-11">Cancel</Button>
                        </DialogFooter>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="holiday" className="mt-0">
                <Tabs defaultValue="single">
                  <TabsList className="flex gap-4 bg-transparent mb-4">
                    <TabsTrigger value="single" className="px-4 py-2 bg-transparent shadow-none rounded-none text-sm font-semibold text-slate-400 border-0 data-[state=active]:text-red-900 data-[state=active]:border-b-2 data-[state=active]:border-red-600 transition-all">Single Entry</TabsTrigger>
                    <TabsTrigger value="batch" className="px-4 py-2 bg-transparent shadow-none rounded-none text-sm font-semibold text-slate-400 border-0 data-[state=active]:text-red-900 data-[state=active]:border-b-2 data-[state=active]:border-red-600 transition-all">Batch Upload</TabsTrigger>
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
                      <div className="flex flex-col items-center justify-center pt-4">
                        <div className="bg-red-50 p-6 rounded-full mb-4">
                          <UploadFileIcon className="text-red-600 h-12 w-12 opacity-80" />
                        </div>
                        <div className="text-center mb-6 max-w-sm">
                          <h3 className="text-xl font-bold text-slate-900 mb-1">Batch Holiday Upload</h3>
                          <p className="text-slate-500 text-sm leading-relaxed">Quickly register multiple regular or special holidays.</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-4 w-full">
                        <Button variant="outline" onClick={downloadHolidayTemplate} className="w-full h-11 text-red-700 border-red-200 hover:bg-red-50 font-semibold">
                          <FileDownloadOutlinedIcon className="mr-2 h-4 w-4" /> Download Holiday Template
                        </Button>
                        <div className="w-full relative border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors group">
                          <Input type="file" accept=".csv" onChange={(e) => handleFileChange(e, "Holiday")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          <div className="pointer-events-none text-slate-500 font-medium">Click to browse or drag and drop CSV</div>
                        </div>
                        <DialogFooter className="flex gap-2 w-full pt-2">
                          <Button type="button" variant="outline" onClick={() => setModalType(null)} className="flex-1 h-11">Cancel</Button>
                        </DialogFooter>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="dueDate" className="mt-0">
                <Tabs defaultValue="single">
                  <TabsList className="flex gap-4 bg-transparent mb-4">
                    <TabsTrigger value="single" className="px-4 py-2 bg-transparent shadow-none rounded-none text-sm font-semibold text-slate-400 border-0 data-[state=active]:text-teal-900 data-[state=active]:border-b-2 data-[state=active]:border-teal-500 transition-all">Single Entry</TabsTrigger>
                    <TabsTrigger value="batch" className="px-4 py-2 bg-transparent shadow-none rounded-none text-sm font-semibold text-slate-400 border-0 data-[state=active]:text-teal-900 data-[state=active]:border-b-2 data-[state=active]:border-teal-500 transition-all">Batch Upload</TabsTrigger>
                  </TabsList>
                  <TabsContent value="single" className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Title *</Label>
                      <Input placeholder="e.g., BIR Tax Deadline" value={dueDateForm.title} onChange={(e) => setDueDateForm({...dueDateForm, title: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Deadline Date *</Label>
                        <Input type="date" value={dueDateForm.date} onChange={(e) => setDueDateForm({...dueDateForm, date: e.target.value})} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Priority</Label>
                        <Select value={dueDateForm.priority} onValueChange={(val) => setDueDateForm({...dueDateForm, priority: val})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Low">Low</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Description / Note</Label>
                      <Input placeholder="Add context or links..." value={dueDateForm.description} onChange={(e) => setDueDateForm({...dueDateForm, description: e.target.value})} />
                    </div>
                    <DialogFooter className="flex gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setModalType(null)} className="flex-1">Cancel</Button>
                      <Button className="flex-1 bg-teal-600 text-white" onClick={handleDueDateSubmit}>Set Due Date</Button>
                    </DialogFooter>
                  </TabsContent>
                  <TabsContent value="batch" className="mt-0">
                    <div className="space-y-4">
                      <div className="flex flex-col items-center justify-center pt-4">
                        <div className="bg-teal-50 p-6 rounded-full mb-4">
                          <UploadFileIcon className="text-teal-600 h-12 w-12 opacity-80" />
                        </div>
                        <div className="text-center mb-6 max-w-sm">
                          <h3 className="text-xl font-bold text-slate-900 mb-1">Batch Due Date Upload</h3>
                          <p className="text-slate-500 text-sm leading-relaxed">Import multiple administrative deadlines or custom project due dates.</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-4 w-full">
                        <Button variant="outline" onClick={downloadDueDateTemplate} className="w-full h-11 text-teal-700 border-teal-200 hover:bg-teal-50 font-semibold">
                          <FileDownloadOutlinedIcon className="mr-2 h-4 w-4" /> Download Due Date Template
                        </Button>
                        <div className="w-full relative border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors group">
                          <Input type="file" accept=".csv" onChange={(e) => handleFileChange(e, "Due Date")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          <div className="pointer-events-none text-slate-500 font-medium">Click to browse or drag and drop CSV</div>
                        </div>
                        <DialogFooter className="flex gap-2 w-full pt-2">
                          <Button type="button" variant="outline" onClick={() => setModalType(null)} className="flex-1 h-11">Cancel</Button>
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

      <BatchUploadReviewModal 
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        data={reviewData}
        type={reviewType}
        onConfirm={handleConfirmReview}
      />

      <Dialog open={modalType === 'editHoliday'} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="text-[#2A174E]">Edit Holiday</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid gap-2">
              <Label>Holiday Name</Label>
              <Input value={holidayForm.name} onChange={(e) => setHolidayForm({...holidayForm, name: e.target.value})} />
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
          </div>
          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalType(null)} className="flex-1">Cancel</Button>
            <Button className="flex-1 bg-[#2A174E] text-white" onClick={handleHolidaySubmit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        <Dialog open={!!selectedDayDetails} onOpenChange={(open) => !open && setSelectedDayDetails(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-lg font-bold text-[#2A174E]">Schedule for {selectedDayDetails?.date}</DialogTitle>
            </DialogHeader>
            <div className="pt-2 overflow-y-auto custom-scrollbar">
              {selectedDayDetails?.events.length > 0 ? (
                Object.entries(selectedDayDetails.events.reduce((acc, event) => {
                    if (!acc[event.type]) acc[event.type] = [];
                    acc[event.type].push(event);
                    return acc;
                  }, {})).map(([type, events]) => {
                  const config = getEventConfig(type);
                  return (
                    <div key={type} className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
                        <h4 className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>{type}s ({events.length})</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {events.map((event, idx) => (
                          <div key={idx} className={`p-3 rounded-lg border ${config.bg} ${config.border} transition-all`}>
                            <p className={`font-semibold text-sm ${config.text}`}>{event.name || event.details}</p>
                            {event.type === "Field Work" && (
                              <p className="text-[10px] opacity-70 font-medium italic mt-1">Auto-credited: {event.hours || 8}hrs</p>
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

        <Dialog open={!!selectedHolidayDetails} onOpenChange={(open) => !open && setSelectedHolidayDetails(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-[#2A174E] flex items-center gap-2">
                <EventAvailableIcon className={selectedHolidayDetails?.holiday.details?.toLowerCase().includes("special") ? "text-purple-500" : "text-red-500"} />
                Holiday Details
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className={`p-5 rounded-xl border-l-4 shadow-sm ${selectedHolidayDetails?.holiday.details?.toLowerCase().includes("special") ? "bg-purple-50 border-purple-500" : "bg-red-50 border-red-500"}`}>
                <h3 className="text-xl font-bold text-slate-800 mb-1">{selectedHolidayDetails?.holiday.name}</h3>
                <p className="text-sm font-medium text-slate-600">
                  {selectedHolidayDetails?.holiday.date && new Date(selectedHolidayDetails.holiday.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              {selectedHolidayDetails?.matchingWork.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">Employees Assigned on this Day</Label>
                  {selectedHolidayDetails.matchingWork.map((work, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex flex-col"><span className="text-sm font-bold text-[#2A174E]">{work.name}</span><span className="text-[11px] text-slate-500">{work.details}</span></div>
                      <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Field Work</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="sm:justify-center"><Button variant="outline" className="w-full sm:w-32" onClick={() => setSelectedHolidayDetails(null)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedPersonnelAction} onOpenChange={(open) => !open && setSelectedPersonnelAction(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-[#2A174E] flex items-center gap-2">
                <AssignmentIcon className={selectedPersonnelAction?.type === "Leave" ? "text-green-500" : "text-blue-500"} />
                {selectedPersonnelAction?.type} Summary
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm pt-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100"><span className="font-semibold text-slate-500">Employee:</span> <span className="text-[#2A174E] font-bold text-base">{selectedPersonnelAction?.name || "N/A"}</span></div>
              <div className="grid grid-cols-1 gap-3 px-1">
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Date</span> <span className="text-slate-800 font-medium">{selectedPersonnelAction?.date && new Date(selectedPersonnelAction.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">{selectedPersonnelAction?.type === "Leave" ? "No. of Days" : "No. of Hours"}</span> <span className={`${selectedPersonnelAction?.type === "Leave" ? "text-green-600" : "text-blue-600"} font-bold`}>{selectedPersonnelAction?.hours || "1"} {selectedPersonnelAction?.type === "Leave" ? "Day(s)" : "Hour(s)"}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Approved By</span> <span className="text-slate-800 font-medium">{selectedPersonnelAction?.approvedBy || "Management"}</span></div>
              </div>
            </div>
            <DialogFooter><Button variant="outline" className="w-full" onClick={() => setSelectedPersonnelAction(null)}>Close Summary</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedFieldLog} onOpenChange={(open) => !open && setSelectedFieldLog(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-[#2A174E] flex items-center gap-2"><AssignmentIcon className="text-orange-500" />Field Work Log Summary</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm pt-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100"><span className="font-semibold text-slate-500">Employee:</span> <span className="text-[#2A174E] font-bold text-base">{selectedFieldLog?.name || "N/A"}</span></div>
              <div className="grid grid-cols-1 gap-3 px-1">
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Date</span> <span className="text-slate-800 font-medium">{selectedFieldLog?.date}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">No. of Hours</span> <span className="text-orange-600 font-bold">{selectedFieldLog?.hours || selectedFieldLog?.NoHrs || "8"} Hours</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Location</span> <span className="text-slate-800 text-right max-w-[60%] font-medium">{selectedFieldLog?.details}</span></div>
              </div>
            </div>
            <DialogFooter><Button variant="outline" className="w-full" onClick={() => setSelectedFieldLog(null)}>Close Summary</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedDueDateDetails} onOpenChange={(open) => !open && setSelectedDueDateDetails(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle className="text-teal-700 flex items-center gap-2"><AssignmentIcon className="text-teal-500" />Due Date Details</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="p-5 rounded-xl border-l-4 border-teal-500 bg-teal-50 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-1 leading-tight">{selectedDueDateDetails?.name}</h3>
                <p className="text-xs font-semibold text-teal-800/80 uppercase tracking-wide">Deadline: {selectedDueDateDetails?.date && new Date(selectedDueDateDetails.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col p-3 bg-slate-50 rounded-lg border border-slate-100"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</span><span className={`text-sm font-bold ${selectedDueDateDetails?.priority === 'Critical' ? 'text-red-600' : selectedDueDateDetails?.priority === 'High' ? 'text-orange-600' : 'text-slate-700'}`}>{selectedDueDateDetails?.priority || "Medium"}</span></div>
                <div className="flex flex-col p-3 bg-slate-50 rounded-lg border border-slate-100"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reminder</span><span className="text-sm font-bold text-slate-700">{selectedDueDateDetails?.reminder || "1 day before"}</span></div>
              </div>
              {selectedDueDateDetails?.details && (
                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100"><p className="font-bold text-slate-400 text-[10px] uppercase mb-1">Description / Note</p><p className="text-slate-700 text-sm">{selectedDueDateDetails.details}</p></div>
              )}
            </div>
            <DialogFooter><Button variant="outline" className="w-full" onClick={() => setSelectedDueDateDetails(null)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Are you sure you want to remove this calendar entry? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel onClick={() => { setShowDeleteModal(false); setItemToDelete(null); }}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

<style dangerouslySetInnerHTML={{__html: `  
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
`}} />
      </div>
    </Sidebar>
  );
};

export default CalendarManagement;
