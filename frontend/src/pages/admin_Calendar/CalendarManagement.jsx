import Sidebar from "../../components/Sidebar";
import Toast from "../../components/toast/Toast";
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import EmptyState from "@/components/EmptyState";
import BatchUploadReviewModal from "../../components/BatchUploadReviewModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterListIcon from '@mui/icons-material/FilterList';

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
import SearchableSelect from "../../components/SearchableSelect";


const CalendarManagement = () => {
  const navigate = useNavigate();
  const { systemToday } = useSystemTime();
  const [currentDate, setCurrentDate] = useState(new Date(systemToday.getFullYear(), systemToday.getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [modalType, setModalType] = useState(null); // 'addEvent' or 'editHoliday'
  const [activeTab, setActiveTab] = useState("fieldWork"); // 'fieldWork', 'holiday', 'dueDate'
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(currentDate.getMonth().toString());
  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear().toString());
  const [toast, setToast] = useState({ message: "", type: "success" });

  const handleSyncHolidays = async () => {
    setIsSyncing(true);
    try {
      const response = await fetchWithAuth("/api/system/sync-holidays", {
        method: "POST"
      });
      const data = await response.json();
      if (response.ok) {
        setToast({ message: data.message || `Holidays synchronized successfully (${data.count || 0} entries).`, type: "success" });
        fetchCalendarEvents();
      } else {
        setToast({ message: data.message || data.error || "Failed to sync holidays.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Connection error syncing holidays.", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

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
    setSelectedDayFilter(null);
    setIsDatePickerOpen(false);
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const monthIndex = currentDate.getMonth();
  const year = currentDate.getFullYear();

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
    const targetDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDayFilter(targetDateStr);
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
    setSelectedDayFilter(null);
  };

  const getUpcomingHolidays = () => {
    return events
      .filter(h => h.type === "Holiday")
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  // --- Unified Ledger Computed Data ---
  const currentMonthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  const monthEvents = useMemo(() => {
    return events.filter(e => {
      if (!e.date) return false;
      const sDate = e.date.split('T')[0];
      if (e.endDate) {
        const eDate = e.endDate.split('T')[0];
        const monthStart = `${currentMonthPrefix}-01`;
        const lastDay = new Date(year, monthIndex + 1, 0).getDate();
        const monthEnd = `${currentMonthPrefix}-${String(lastDay).padStart(2, '0')}`;
        return sDate <= monthEnd && eDate >= monthStart;
      }
      return sDate.startsWith(currentMonthPrefix);
    });
  }, [events, year, monthIndex, currentMonthPrefix]);

  const categoryCounts = useMemo(() => {
    const counts = { ALL: monthEvents.length, Holiday: 0, Leave: 0, Overtime: 0, "Field Work": 0, "Due Date": 0 };
    monthEvents.forEach(e => {
      if (counts[e.type] !== undefined) {
        counts[e.type]++;
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

      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase();
        const matchesName = (item.name || "").toLowerCase().includes(q);
        const matchesDetails = (item.details || "").toLowerCase().includes(q);
        const matchesType = (item.type || "").toLowerCase().includes(q);
        const matchesUserId = item.userId ? String(item.userId).toLowerCase().includes(q) : false;
        if (!matchesName && !matchesDetails && !matchesType && !matchesUserId) {
          return false;
        }
      }

      return true;
    });

    list.sort((a, b) => {
      const dateA = a.date ? a.date.split('T')[0] : "";
      const dateB = b.date ? b.date.split('T')[0] : "";
      if (ledgerSort === "date-asc") return dateA.localeCompare(dateB);
      return dateB.localeCompare(dateA);
    });

    return list;
  }, [monthEvents, ledgerCategory, selectedDayFilter, ledgerTimeline, ledgerSearch, ledgerSort, todayStr, weekRange]);

  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        
        {/* Header & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">Calendar Management</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage {isAdmin ? "holidays, due dates, leaves, and field work" : "field work assignments"}
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full md:w-auto">
            {isAdmin && (
              <>
                <Button 
                  variant="outline"
                  disabled={isSyncing}
                  className="w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
                  onClick={handleSyncHolidays}
                  title="Synchronize Philippine holidays from Official Gazette"
                >
                  <SyncIcon className={`mr-1.5 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "Syncing..." : "Sync Holidays"}
                </Button>
                <Button 
                  className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary-hover text-white"
                  onClick={() => {
                    setModalType('addEvent');
                    setActiveTab('fieldWork');
                  }}
                >
                  <AddIcon className="mr-1 h-4 w-4" /> Add Calendar Event
                </Button>
              </>
            )}
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
            <TooltipContent className="bg-slate-900 text-white border-slate-800">
              Paid at 200% of daily rate if worked; 100% if unworked.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center text-sm font-medium text-slate-700 cursor-help">
                <span className="w-2.5 h-2.5 rounded-full mr-2 bg-purple-400 ring-4 ring-purple-50" /> Special Holiday
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-slate-800">
              Paid at 130% of daily rate if worked; 0% if unworked.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center text-sm font-medium text-slate-700 cursor-help">
                <span className="w-2.5 h-2.5 rounded-full mr-2 bg-teal-400 ring-4 ring-teal-50" /> Due Date
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-slate-800">
              Crucial payroll cutoff or compliance deadline.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center text-sm font-medium text-slate-700 cursor-help">
                <span className="w-2.5 h-2.5 rounded-full mr-2 bg-orange-400 ring-4 ring-orange-50" /> Field Work
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-slate-800">
              Official out-of-office assignment (100% paid).
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center text-sm font-medium text-slate-700 cursor-help">
                <span className="w-2.5 h-2.5 rounded-full mr-2 bg-green-400 ring-4 ring-green-50" /> Approved Leave
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-slate-800">
              Excused absences (leaves processed for payroll).
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center text-sm font-medium text-slate-700 cursor-help">
                <span className="w-2.5 h-2.5 rounded-full mr-2 bg-blue-400 ring-4 ring-blue-50" /> Overtime
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-slate-800">
              Approved extra hours paid at overtime premium rates.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Main Layout Split */}
        <div className="grid grid-cols-1">
          
          <div className="w-full">
            <Card className="py-0 overflow-hidden border-0 shadow-sm bg-white">
              <div className=" bg-brand-primary text-white flex justify-between items-center p-3 md:p-4 rounded-t-xl">
                <ChevronLeftIcon className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => changeMonth(-1)} />
                
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity select-none group"
                  onClick={handleOpenDatePicker}
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

                    const isToday = 
                      d === systemToday.getDate() && 
                      monthIndex === systemToday.getMonth() && 
                      year === systemToday.getFullYear();

                    let bgClass = "bg-white hover:bg-slate-50";
                    
                    if (isToday) {
                      bgClass = "bg-accent-green-light hover:bg-accent-green-light/25 ring-2 ring-accent-green ring-inset z-10 label";
                    }

                    return (
                      <div 
                        key={d} 
                        className={`min-h-[80px] md:min-h-[120px] p-1 md:p-2 transition-colors cursor-pointer overflow-y-auto overflow-x-hidden flex flex-col relative ${bgClass}`}
                        onClick={() => handleDayClick(d)}
                      >
                        <div className={`text-xs md:text-sm font-semibold mb-1 shrink-0 text-center md:text-left ${
                          isToday ? "bg-accent-green text-white w-6 h-6 rounded-full flex items-center justify-center mx-auto md:mx-0" : "text-slate-700"
                        }`}>
                          {d}
                        </div>

                        {dayEvents.slice(0, 2).map((e, i) => {
                          // Badge on the day box sa Calendar
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
          <div className="h-6" />
          
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
                    Consolidated record of holidays, leaves, overtime hours, field work assignments, and compliance due dates for {monthName} {year}.
                  </p>
                </div>

                {/* Scope & Sort Controls */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {selectedDayFilter && (
                    <div className="flex items-center gap-1.5 bg-brand-primary-light text-brand-primary px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-brand-primary/20">
                      <span>Filtering Day: <strong>{new Date(selectedDayFilter + "T00:00:00").toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}</strong></span>
                      <button 
                        onClick={() => setSelectedDayFilter(null)} 
                        className="hover:opacity-75 cursor-pointer ml-1 p-0.5 hover:bg-orange-200/60 rounded"
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
                    placeholder="Search employee, destination, event..."
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      ledgerCategory === "ALL"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All <span className="ml-1 opacity-80 font-normal">({categoryCounts.ALL})</span>
                  </button>

                  <button
                    onClick={() => setLedgerCategory("Holiday")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                      <th className="py-3 px-4">Subject / Personnel</th>
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
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5 truncate">
                                  {item.name || item.details}
                                  {isActionableReq && (
                                    <span className="text-[10px] text-brand-primary bg-brand-primary-light px-1.5 py-0.2 rounded font-mono font-medium">
                                      REQ-{item.id}
                                    </span>
                                  )}
                                </span>
                                <span className="text-[11px] text-slate-400 font-medium truncate">
                                  {item.userId ? `Employee ID: ${formatUserId(item.userId)}` : (isHoliday ? "Company Holiday" : "Calendar Task")}
                                </span>
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
                                    onClick={() => navigate(`/adminRequests?requestId=${item.id}`, { state: { selectedReqId: item.id } })}
                                    className="h-7 px-2 text-[11px] font-semibold text-brand-primary border-brand-primary/30 hover:bg-brand-primary-light gap-1 shadow-2xs"
                                    title={`Directly inspect REQ-${item.id} in Requests Management`}
                                  >
                                    <OpenInNewIcon sx={{ fontSize: 13 }} />
                                    <span>Inspect</span>
                                  </Button>
                                )}

                                {isHoliday && isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenEditHoliday(item)}
                                    className="h-7 w-7 text-slate-400 hover:text-brand-primary hover:bg-slate-100"
                                    title="Edit Holiday"
                                  >
                                    <EditIcon sx={{ fontSize: 15 }} />
                                  </Button>
                                )}

                                {isAdmin && (isHoliday || isFieldWork || isDueDate) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => initiateDelete(item.id, item.type)}
                                    className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                    title="Delete Event"
                                  >
                                    <DeleteIcon sx={{ fontSize: 15 }} />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <EventAvailableIcon sx={{ fontSize: 36 }} className="text-slate-300" />
                            <p className="text-sm font-semibold text-slate-700">No events found matching your filter criteria</p>
                            <p className="text-xs text-slate-400">
                              Try clearing your keyword search, resetting the day filter, or switching the category tab.
                            </p>
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
                  Click <strong className="text-slate-600">Inspect</strong> to view the originating filing in Requests Management.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

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

              let badgeBg = "bg-slate-100 text-slate-700 border-slate-200";
              let badgeLabel = detailedEvent.type;
              let headerBorderColor = "border-slate-300";

              if (isHoliday) {
                badgeBg = isSpecialHoliday ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-red-100 text-red-700 border-red-200";
                badgeLabel = isSpecialHoliday ? "SPECIAL NON-WORKING HOLIDAY" : "REGULAR HOLIDAY";
                headerBorderColor = isSpecialHoliday ? "border-purple-500" : "border-red-500";
              } else if (isLeave) {
                badgeBg = "bg-green-100 text-green-700 border-green-200";
                badgeLabel = detailedEventData?.reqTypeName || detailedEvent.details || "LEAVE";
                headerBorderColor = "border-green-500";
              } else if (isOvertime) {
                badgeBg = "bg-blue-100 text-blue-700 border-blue-200";
                badgeLabel = "OVERTIME";
                headerBorderColor = "border-blue-500";
              } else if (isFieldWork) {
                badgeBg = "bg-orange-100 text-orange-700 border-orange-200";
                badgeLabel = "FIELD WORK";
                headerBorderColor = "border-orange-500";
              } else if (isDueDate) {
                badgeBg = "bg-teal-100 text-teal-700 border-teal-200";
                badgeLabel = "COMPLIANCE DUE DATE";
                headerBorderColor = "border-teal-500";
              }

              const dateObj = new Date(detailedEvent.date);
              const formattedDate = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                : detailedEvent.date;

              const isActionableReq = Boolean(detailedEvent.id && (isLeave || isOvertime || isFieldWork));

              // Matching field work on this date for holiday
              const matchingHolidayWork = isHoliday 
                ? events.filter(e => e.type === "Field Work" && e.date && e.date.split('T')[0] === detailedEvent.date.split('T')[0])
                : [];

              return (
                <div className="flex flex-col h-full max-h-[90vh]">
                  {/* Header */}
                  <DialogHeader className={`p-5 bg-slate-50/80 border-b border-slate-100 border-l-4 ${headerBorderColor}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${badgeBg}`}>
                        {badgeLabel}
                      </span>
                      {isActionableReq && (
                        <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                          REQ-{detailedEvent.id}
                        </span>
                      )}
                    </div>
                    <DialogTitle className="text-lg font-bold text-slate-900 mt-2 text-left">
                      {detailedEvent.name || detailedEvent.details}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 text-left">
                      Scheduled Date: <strong className="text-slate-700">{formattedDate}</strong>
                    </DialogDescription>
                  </DialogHeader>

                  {/* Body Content */}
                  <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 text-xs">
                    {detailedEventLoading && (
                      <div className="flex items-center justify-center p-3 text-slate-400 gap-2 bg-slate-50 rounded-lg">
                        <SyncIcon className="animate-spin h-4 w-4" />
                        <span>Loading complete filing details...</span>
                      </div>
                    )}

                    {/* PERSONNEL ACTIONS (Leave / OT / Field Work) */}
                    {isActionableReq && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Employee Name</span>
                            <span className="text-sm font-bold text-slate-800">{detailedEvent.name || detailedEventData?.userName || "—"}</span>
                            {detailedEvent.userId && (
                              <span className="text-[11px] text-slate-500 font-mono block">ID: {formatUserId(detailedEvent.userId)}</span>
                            )}
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Filing Status</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-700">
                              {detailedEventData?.status || "Approved"}
                            </span>
                            {detailedEventData?.date_Filed && (
                              <span className="text-[11px] text-slate-400 block mt-1">
                                Filed: {new Date(detailedEventData.date_Filed).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Duration & Details */}
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Schedule & Duration</span>
                          
                          {isLeave && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-500">Date Range:</span>
                                <p className="font-semibold text-slate-800">
                                  {detailedEventData?.VL_StartDate || detailedEventData?.SL_StartDate || detailedEvent.date?.split('T')[0]} 
                                  {(detailedEvent.endDate || detailedEventData?.VL_EndDate || detailedEventData?.SL_EndDate) 
                                    ? ` → ${(detailedEvent.endDate || detailedEventData?.VL_EndDate || detailedEventData?.SL_EndDate).split('T')[0]}` 
                                    : ""}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">Total Duration:</span>
                                <p className="font-bold text-green-700">
                                  {detailedEvent.hours || detailedEventData?.VL_NoDays || detailedEventData?.SL_NoDays || 1} Day(s)
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">Pay Status:</span>
                                <p className="font-semibold text-slate-800">
                                  {detailedEventData?.VL_withPayName || detailedEventData?.SL_withPayName || detailedEventData?.EL_withPayName || "With Pay"}
                                </p>
                              </div>
                            </div>
                          )}

                          {isOvertime && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-500">OT Duration:</span>
                                <p className="font-bold text-blue-700">
                                  {detailedEvent.hours || detailedEventData?.Total_Hrs || "—"} Hours
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">Scheduled Hours:</span>
                                <p className="font-semibold text-slate-800">
                                  {detailedEventData?.HrFrom && detailedEventData?.HrTo 
                                    ? `${detailedEventData.HrFrom} - ${detailedEventData.HrTo}` 
                                    : (detailedEvent.details || "Standard Overtime")}
                                </p>
                              </div>
                            </div>
                          )}

                          {isFieldWork && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-500">Field Credit:</span>
                                <p className="font-bold text-orange-700">
                                  {detailedEvent.hours || detailedEventData?.OW_NoHrs || 8} Hours (100% Paid)
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">Destination:</span>
                                <p className="font-semibold text-slate-800">
                                  {detailedEventData?.destination || detailedEvent.details || "Client Site"}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Remarks & Notes */}
                        {(detailedEventData?.remarks || detailedEvent.details) && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Reason & Purpose
                            </span>
                            <p className="text-slate-700 leading-relaxed">
                              {detailedEventData?.remarks || detailedEvent.details}
                            </p>
                          </div>
                        )}

                        {/* Audit & Approver */}
                        {detailedEventData?.approverName && (
                          <div className="flex justify-between items-center px-1 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                            <span>Approved by: <strong className="text-slate-700">{detailedEventData.approverName}</strong></span>
                            {detailedEventData.date_Processed && (
                              <span>Processed: {new Date(detailedEventData.date_Processed).toLocaleDateString()}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* HOLIDAY DETAILS */}
                    {isHoliday && (
                      <div className="space-y-4">
                        <div className={`p-4 rounded-xl border ${isSpecialHoliday ? "bg-purple-50/60 border-purple-200" : "bg-red-50/60 border-red-200"} space-y-2`}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{detailedEvent.name}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {detailedEvent.details || (isSpecialHoliday ? "Special Non-Working Day" : "Regular Philippine Holiday")}
                          </p>
                        </div>

                        {/* Statutory Wage Multipliers Notice */}
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                            Statutory Wage & Payroll Rule (DOLE Mandate)
                          </span>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-2 bg-white rounded-lg border border-slate-100">
                              <span className="text-slate-400 block text-[10px] uppercase">If Worked</span>
                              <strong className={`text-sm ${isSpecialHoliday ? "text-purple-700" : "text-red-700"}`}>
                                {isSpecialHoliday ? "130% Daily Rate" : "200% Daily Rate"}
                              </strong>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-100">
                              <span className="text-slate-400 block text-[10px] uppercase">If Unworked</span>
                              <strong className="text-sm text-slate-700">
                                {isSpecialHoliday ? "0% (No Pay Rule)" : "100% Daily Rate"}
                              </strong>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-400 italic">
                            CTPAT and DOLE statutory pay multiplier is automatically calculated in batch payroll generation.
                          </p>
                        </div>

                        {/* Matching Field Work Assignments */}
                        {matchingHolidayWork.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Personnel Assigned on this Holiday ({matchingHolidayWork.length})
                            </span>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                              {matchingHolidayWork.map((fw, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2.5 bg-orange-50/60 border border-orange-100 rounded-lg text-xs">
                                  <div>
                                    <p className="font-bold text-slate-800">{fw.name}</p>
                                    <p className="text-[11px] text-slate-500">{fw.details}</p>
                                  </div>
                                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">
                                    Field Work ({fw.hours || 8}h)
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* DUE DATE DETAILS */}
                    {isDueDate && (
                      <div className="space-y-3">
                        <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-900">{detailedEvent.name}</span>
                            <Badge variant="outline" className="bg-teal-100 text-teal-800 border-teal-200 font-bold text-[10px]">
                              {detailedEvent.priority || "Medium Priority"}
                            </Badge>
                          </div>
                          <p className="text-xs text-teal-700 font-semibold">
                            Deadline: {formattedDate}
                          </p>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Task Description & Directives
                          </span>
                          <p className="text-slate-700 leading-relaxed">
                            {detailedEvent.details || "No additional checklist instructions provided for this due date."}
                          </p>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                          <span className="text-slate-500">Reminder Timing:</span>
                          <span className="font-bold text-slate-800">{detailedEvent.reminder || "1 day before cutoff"}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex flex-row items-center justify-between gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setDetailedEvent(null);
                        setDetailedEventData(null);
                      }}
                      className="text-xs"
                    >
                      Close
                    </Button>

                    <div className="flex items-center gap-2">
                      {isHoliday && isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const h = detailedEvent;
                            setDetailedEvent(null);
                            handleOpenEditHoliday(h);
                          }}
                          className="text-xs text-slate-700 hover:text-brand-primary gap-1"
                        >
                          <EditIcon sx={{ fontSize: 14 }} />
                          <span>Edit Holiday</span>
                        </Button>
                      )}

                      {isAdmin && (isHoliday || isFieldWork || isDueDate) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const ev = detailedEvent;
                            setDetailedEvent(null);
                            initiateDelete(ev.id, ev.type);
                          }}
                          className="text-xs text-red-600 hover:bg-red-50 gap-1"
                        >
                          <DeleteIcon sx={{ fontSize: 14 }} />
                          <span>Delete</span>
                        </Button>
                      )}

                      {isActionableReq && (
                        <Button
                          size="sm"
                          onClick={() => {
                            const reqId = detailedEvent.id;
                            setDetailedEvent(null);
                            setSelectedDayDetails(null);
                            navigate(`/adminRequests?requestId=${reqId}`, { state: { selectedReqId: reqId } });
                          }}
                          className="text-xs bg-brand-primary hover:bg-brand-primary-hover text-white gap-1 font-semibold"
                        >
                          <OpenInNewIcon sx={{ fontSize: 14 }} />
                          <span>Open in Requests</span>
                        </Button>
                      )}
                    </div>
                  </DialogFooter>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

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
                <Label htmlFor="jump-picker-month">Select Month</Label>
                <SearchableSelect
                  id="jump-picker-month"
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
                <Label htmlFor="jump-picker-year">Select Year</Label>
                <SearchableSelect
                  id="jump-picker-year"
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

      <Dialog open={!!modalType && modalType !== 'editHoliday'} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-brand-primary text-lg font-bold text-center">
              Add Calendar Event
            </DialogTitle>
          </DialogHeader>

          {isAdmin && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-11 bg-slate-200/60 p-0.5 rounded-lg mb-6">
                <TabsTrigger value="fieldWork" className="font-semibold text-slate-500 rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm">Field Work</TabsTrigger>
                <TabsTrigger value="holiday" className="font-semibold text-slate-500 rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm">Holiday</TabsTrigger>
                <TabsTrigger value="dueDate" className="font-semibold text-slate-500 rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm">Due Date</TabsTrigger>
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
                      <SearchableSelect
                        options={employees.map(emp => ({
                          value: emp.user_Id.toString(),
                          label: `${formatUserId(emp.user_Id)} - ${emp.user_LastName}, ${emp.user_FirstName || ""}`,
                          sublabel: emp.position ? `${emp.position} (${emp.department || ""})` : ""
                        }))}
                        value={fieldWorkForm.userId}
                        onChange={(val) => setFieldWorkForm({...fieldWorkForm, userId: val})}
                        placeholder="Choose Employee..."
                        searchPlaceholder="Search employee name or ID..."
                      />
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
          <DialogHeader><DialogTitle className="text-brand-primary">Edit Holiday</DialogTitle></DialogHeader>
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
            <Button className="flex-1 bg-brand-primary text-white" onClick={handleHolidaySubmit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <DialogTitle className="text-lg font-bold text-brand-primary">Schedule for {selectedDayDetails?.date}</DialogTitle>
                </DialogHeader>
                <div className="pt-2 overflow-y-auto custom-scrollbar">
                  {groupedDayEvents.length > 0 ? (
                    groupedDayEvents.map(([type, events]) => {
                      const config = getEventConfig(type);
                      return (
                        <div key={type} className="mb-6 last:mb-2">
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
                            <h4 className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>{type}s ({events.length})</h4>
                          </div>
                          <div className={`grid ${isSingleCategory ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-3`}>
                            {events.map((event, idx) => {
                              return (
                                <div 
                                  key={idx} 
                                  onClick={() => handleOpenEventDetails(event)}
                                  className={`p-3 rounded-lg border ${config.bg} ${config.border} transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] group/item`}
                                  title="Click to view complete details about this event"
                                >
                                  <div className="flex items-center justify-between">
                                    <p className={`font-semibold text-sm ${config.text} group-hover/item:underline`}>{event.name || event.details}</p>
                                    <VisibilityIcon sx={{ fontSize: 16 }} className="text-slate-400 group-hover/item:text-brand-primary opacity-60 group-hover/item:opacity-100 transition-opacity" />
                                  </div>
                                  {event.type === "Field Work" && (
                                    <p className="text-[10px] opacity-70 font-medium italic mt-1">Auto-credited: {event.hours || 8}hrs</p>
                                  )}
                                  {event.type === "Overtime" && (
                                    <p className="text-[10px] opacity-70 font-medium italic mt-1">{event.details}</p>
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

        <Dialog open={!!selectedHolidayDetails} onOpenChange={(open) => !open && setSelectedHolidayDetails(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-brand-primary flex items-center gap-2">
                <EventAvailableIcon className={selectedHolidayDetails?.holiday.details?.toLowerCase().includes("special") ? "text-brand-primary" : "text-status-danger"} />
                Holiday Details
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className={`p-5 rounded-xl border-l-4 shadow-sm ${selectedHolidayDetails?.holiday.details?.toLowerCase().includes("special") ? "bg-purple-50 border-brand-primary" : "bg-red-50 border-status-danger"}`}>
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
                      <div className="flex flex-col"><span className="text-sm font-bold text-brand-primary">{work.name}</span><span className="text-[11px] text-slate-500">{work.details}</span></div>
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
              <DialogTitle className="text-brand-primary flex items-center gap-2">
                <AssignmentIcon className={selectedPersonnelAction?.type === "Leave" ? "text-green-500" : "text-blue-500"} />
                {selectedPersonnelAction?.type} Summary
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm pt-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100"><span className="font-semibold text-slate-500">Employee:</span> <span className="text-brand-primary font-bold text-base">{selectedPersonnelAction?.name || "N/A"}</span></div>
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
              <DialogTitle className="text-brand-primary flex items-center gap-2"><AssignmentIcon className="text-orange-500" />Field Work Log Summary</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm pt-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100"><span className="font-semibold text-slate-500">Employee:</span> <span className="text-brand-primary font-bold text-base">{selectedFieldLog?.name || "N/A"}</span></div>
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
            <DialogHeader><DialogTitle className="text-brand-primary flex items-center gap-2"><AssignmentIcon className="text-status-info" />Due Date Details</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="p-5 rounded-xl border-l-4 border-status-info bg-sky-50 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-1 leading-tight">{selectedDueDateDetails?.name}</h3>
                <p className="text-xs font-semibold text-status-info uppercase tracking-wide">Deadline: {selectedDueDateDetails?.date && new Date(selectedDueDateDetails.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
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
      </TooltipProvider>
    </Sidebar>
  );
};

export default CalendarManagement;
