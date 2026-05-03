import Sidebar from "../../components/Sidebar";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Toast from "../../components/toast/Toast";
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import { useState, useEffect } from "react";
import { formatUserId } from "../../utils/formatUserId";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "radix-ui";

const CalendarManagement = () => {
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
  const [holidayListHeader, setHolidayListHeader] = useState("Upcoming Holidays");

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

  const handleOpenEditHoliday = (holiday) => {
    setHolidayForm({
      id: holiday.id,
      name: holiday.name,
      date: holiday.date.split('T')[0],
      type: holiday.type || "Regular Holiday"
    });
    setModalType('editHoliday');
  };

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
        setHolidayForm({ id: "", name: "", date: "", type: "Regular Holiday" });
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

  const handleHolidayScroll = (e) => {
    const container = e.target;
    const todayStr = systemToday.toISOString().split('T')[0];
    
    const items = container.getElementsByClassName('listItem');
    let firstVisibleIndex = -1;
    for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (rect.top >= containerRect.top) {
            firstVisibleIndex = i;
            break;
        }
    }

    if (firstVisibleIndex !== -1) {
        const allHolidays = getUpcomingHolidays();
        const visibleHoliday = allHolidays[firstVisibleIndex];
        if (visibleHoliday.date < todayStr) {
            setHolidayListHeader("Past Holidays");
        } else {
            setHolidayListHeader("Upcoming Holidays");
        }
    }
  };

  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  return (
    <Sidebar>
      
      <div className="p-2  md:p-4 overflow-x-hidden w-full">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Calendar Management</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage {isAdmin ? "holidays, leaves, and field work" : "field work assignments"}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {isAdmin && (
              <Button 
                className="w-full sm:w-[170px] bg-[#2A174E] hover:bg-[#1a0e30] text-white"
                onClick={() => {
                  setHolidayForm({ id: null, name: "", date: "", type: "Regular Holiday" });
                  setModalType('addHoliday');
                }}
              >
                <AddIcon className="mr-1 scale-75" /> Add Holiday
              </Button>
            )}
            <Button 
              className="w-full sm:w-[170px] bg-[#ff8c00] hover:bg-[#e67e00] text-white"
              onClick={() => setModalType('addFieldWork')}
            >
              <AddIcon className="mr-1 scale-75" /> Add Field Work
            </Button>
          </div>
        </div>

          {/* Legend Card */}
          <Card className="py-2">
            <CardContent className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center text-sm text-muted-foreground">
                <div className="p-2 w-3 h-3 rounded-sm mr-2 bg-red-100 border border-red-300" />
                <div className="p-1"></div>Regular Holiday
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <div className="p-2 w-3 h-3 rounded-sm mr-2 bg-purple-100 border border-purple-300" /> 
                <div className="p-1"></div>Special Non-Working Holiday
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <div className="p-2 w-3 h-3 rounded-sm mr-2 bg-orange-100 border border-orange-300" /> 
                <div className="p-1"></div>Field Work
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <div className="p-2 w-3 h-3 rounded-sm mr-2 bg-green-100 border border-green-300" /> 
                <div className="p-1"></div>Approved Leave
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <div className="p-2 w-3 h-3 rounded-sm mr-2 bg-blue-100 border border-blue-300" /> 
                <div className="p-1"></div>Overtime
              </div>
            </CardContent>
          </Card>
          <div className="h-4"></div>

          {/* Main Layout Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Calendar Column */}
            <div className="lg:col-span-8">
              <Card className="py-0 overflow-hidden border-0 shadow-sm bg-white">
                <div className="bg-gradient-to-r from-orange-500 to-orange-400 text-white flex justify-between items-center p-4 rounded-t-xl">
                  <ChevronLeftIcon className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => changeMonth(-1)} />
                  <h2 className="text-lg md:text-xl font-bold">{`${monthName} ${year}`}</h2>
                  <ChevronRightIcon className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => changeMonth(1)} />
                </div>
                
                {/* 
                  BORDER FIX: 
                  Removed border-l, border-t, border-b, border-r classes from the grid and cells. 
                  Used gap-[1px] with a subtle background color to create clean, seamless internal lines.
                */}
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

                      const isToday = 
                        d === systemToday.getDate() && 
                        monthIndex === systemToday.getMonth() && 
                        year === systemToday.getFullYear();

                      let bgClass = "bg-white hover:bg-slate-50";
                      if (hasLeave) bgClass = "bg-green-50/60 hover:bg-green-50";
                      else if (hasField) bgClass = "bg-orange-50/60 hover:bg-orange-50";
                      else if (hasOt) bgClass = "bg-blue-50/60 hover:bg-blue-50";
                      else if (hasHoliday) bgClass = "bg-red-50/60 hover:bg-red-50";
                      
                      if (isToday) {
                        bgClass = "bg-orange-50 hover:bg-orange-100 ring-1 ring-orange-500 ring-inset z-10 label";
                      }

                      return (
                        <div 
                          key={d} 
                          className={`min-h-[80px] md:min-h-[120px] p-1 md:p-2 transition-colors cursor-pointer overflow-y-auto overflow-x-hidden flex flex-col relative ${bgClass}`}
                          onClick={() => handleDayClick(d)}
                        >
                          <div className={`text-xs md:text-sm font-semibold mb-1 shrink-0 text-center md:text-left ${
                            isToday ? "bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center mx-auto md:mx-0" : "text-slate-700"
                          }`}>
                            {d}
                          </div>

                          {dayEvents.map((e, i) => {
                            let typeClass = "bg-red-100 text-red-800"; 
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
                              <div key={i} className={`text-[9px] md:text-[11px] p-1 rounded mt-1 shrink-0 truncate w-full font-medium ${typeClass}`}>
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

            <div className="lg:col-span-4 flex flex-col gap-6 w-full">
              {/* Holidays List Card */}
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="py-0">
                  <CardTitle className="text-lg text-[#2A174E]">Upcoming Holidays</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="max-h-[250px] overflow-y-auto pr-2 space-y-2">
                    {getUpcomingHolidays().length > 0 ? getUpcomingHolidays().map((holiday, idx) => {
                      const isSpecial = holiday.type?.toLowerCase().includes("special");
                      const accentColor = isSpecial ? "border-l-purple-500" : "border-l-red-500";
                      
                      return (
                        <div 
                          className={`group cursor-pointer transition-all flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-slate-50 rounded-lg hover:bg-slate-100 mb-2 border border-l-4 ${accentColor} py-4`} 
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
                            <div className="flex gap-2 mt-2 sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
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
                    }) : (
                      <p className="text-center text-sm text-muted-foreground py-4">No upcoming holidays</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Field Work List Card */}
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="pb-0">
                  <CardTitle className="text-lg text-[#2A174E]">Field Work Assignments</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-0">
                  <div className="max-h-[250px] overflow-y-auto pr-2 space-y-2">
                    {events.filter(e => e.type === "Field Work").length > 0 ? events.filter(e => e.type === "Field Work").map((field, idx) => (
                      <div 
                        className="group cursor-pointer transition-all flex flex-row justify-between items-center p-3 bg-slate-50 rounded-lg hover:bg-slate-100 gap-3 border border-l-4 border-l-orange-500" 
                        key={idx} 
                        onClick={() => handleFieldWorkClick(field)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800 truncate">{field.name}</p>
                          <span className="text-[11px] text-muted-foreground block truncate">{field.date}</span>
                          <p className="text-[11px] text-slate-500 mt-0.5 italic truncate">{field.details}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-500 hover:text-red-500 hover:bg-red-50 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0" 
                          onClick={(e) => {
                            e.stopPropagation();
                            initiateDelete(field.id, field.type);
                          }}
                        >
                          <DeleteIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    )) : (
                      <p className="text-center text-sm text-muted-foreground py-4">No field work assignments this month</p>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>

          {/* MAIN ADD/EDIT DIALOG */}
          <Dialog open={!!modalType} onOpenChange={(open) => !open && setModalType(null)}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-[#2A174E] text-lg font-bold text-center">
                  {modalType?.includes('Holiday') ? (modalType.startsWith('add') ? 'Add' : 'Edit') + ' Holiday' : 'Add Field Work'}
                </DialogTitle>
                <hr></hr>
              </DialogHeader>
              <form onSubmit={modalType === 'addFieldWork' ? handleFieldWorkSubmit : handleHolidaySubmit}>
                <div className="grid gap-4 py-2">
                  
                  {modalType === 'addFieldWork' ? (
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
                  ) : (
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
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="date">Date</Label>
                    <Input 
                      id="date"
                      type="date" 
                      value={modalType === 'addFieldWork' ? fieldWorkForm.date : holidayForm.date}
                      onChange={(e) => {
                        if (modalType === 'addFieldWork') {
                          setFieldWorkForm({...fieldWorkForm, date: e.target.value});
                        } else {
                          setHolidayForm({...holidayForm, date: e.target.value});
                        }
                      }}
                      required
                      className="w-full"
                    />
                  </div>

                  {modalType?.includes('Holiday') ? (
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
                      </Select><div className="h-2"></div>
                    </div>
                  ) : (
                    <>
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
                        /><div className="h-2"></div>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Button type="submit" className={`w-full sm:w-auto text-white ${modalType === 'addFieldWork' ? 'bg-[#ff8c00] hover:bg-[#e67e00]' : 'bg-[#2A174E] hover:bg-[#1a0e30]'}`}>
                    Submit
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setModalType(null)} className="w-full sm:w-auto">
                    Cancel
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
                  <div key={i} className="p-3 bg-slate-50 rounded-lg text-sm">
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
                  <span className="text-slate-800">{selectedFieldLog?.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-muted-foreground">Task:</span> 
                  <span className="text-slate-800 text-right max-w-[60%]">{selectedFieldLog?.details}</span>
                </div>
                <hr className="my-4" />
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
              <div className="space-y-3 pt-4">
                {selectedDayDetails?.events.length > 0 ? (
                  selectedDayDetails.events.map((event, idx) => {
                    let typeClass = "bg-red-50 text-red-800 border-red-200"; 
                    let dotBg = "bg-red-400";

                    if (event.type === "Holiday") {
                      if(event.details.toLowerCase().includes("special")) {
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

        </div>
    </Sidebar>
  );
};

export default CalendarManagement;