import "./calendarManagement.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from '@mui/icons-material/Close';
import Toast from "../../components/toast/Toast";
import ActionModal from "../../components/actionModal/ActionModal";
import InfoModal from "../../components/infoModal/InfoModal";
<<<<<<< HEAD
//import PageTransition from "../../components/pageTransition/PageTransition";
import { useSelector } from "react-redux";
=======
import { useState, useEffect } from "react";
import { formatUserId } from "../../utils/formatUserId";
>>>>>>> machip-UIChanges
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import { useState, useEffect } from "react";
import { formatUserId } from "../../utils/formatUserId";


const CalendarManagement = () => {
  const { systemToday } = useSystemTime();
  const [currentDate, setCurrentDate] = useState(new Date(systemToday.getFullYear(), systemToday.getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null); // { id, type }
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);

  const handleDayClick = (day) => {
  const dayEvents = getEventsForDay(day);
  
  // Format the date nicely for the modal title (e.g., "Monday, April 15, 2026")
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
    
    // Choose endpoint based on type
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
        fetchCalendarEvents(); // Refresh fully to be sure
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

  // 1. Logic for Holiday Clicks
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

  // 2. Logic for Field Work Clicks
  const handleFieldWorkClick = (fieldWork) => {
    // In a real app, you might fetch specific logs here
    setSelectedFieldLog(fieldWork);
  };

  
  // Field Work Form State
  const [fieldWorkForm, setFieldWorkForm] = useState({
    userId: "",
    date: "",
    location: "",
    hours: 8
  });

  // Holiday Form State
  const [holidayForm, setHolidayForm] = useState({
    name: "",
    date: "",
    type: "Regular Holiday"
  });

  const handleHolidaySubmit = async (e) => {
    e.preventDefault();
    if (!holidayForm.name || !holidayForm.date) {
      setToast({ message: "Please fill in all fields.", type: "error" });
      return;
    }

    try {
      const response = await fetchWithAuth("/api/system/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: holidayForm.name,
          date: holidayForm.date,
          type: holidayForm.type
        }),
      });

      if (response.ok) {
        setToast({ message: "Holiday added successfully!", type: "success" });
        setModalType(null);
        setHolidayForm({ name: "", date: "", type: "Regular Holiday" });
        fetchCalendarEvents();
      } else {
        const err = await response.json();
        setToast({ message: err.error || "Failed to add holiday.", type: "error" });
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
          emp_reqTypeId: 2, // Onfield Work
          emp_reqStatusId: 2, // Auto-approve
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
        fetchCalendarEvents(); // Refresh
      } else {
        const err = await response.json();
        setToast({ message: err.error || "Failed to assign field work.", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Connection error.", type: "error" });
    }
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const monthIndex = currentDate.getMonth();
  const year = currentDate.getFullYear();

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

  // Navigation Logic for all months
  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  // Logic to generate the calendar grid
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

  const getUpcomingHolidays = () => {
    const todayStr = systemToday.toISOString().split('T')[0];
    return events
      .filter(h => h.type === "Holiday" && h.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  };

  return (
    <div className="home calendarPage">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        {/* <PageTransition> */}
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        <div className="calendarWrapper">
          <div className="pageHeader">
            <div className="title">
              <h1>Calendar Management</h1>
              <span>Manage {isAdmin ? "holidays, leaves, and field work" : "field work assignments"}</span>
            </div>
            <div className="actions">
              {isAdmin && (
                <button className="btn holiday" onClick={() => setModalType('addHoliday')}>
                  <AddIcon /> Add Holiday
                </button>
              )}
              <button className="btn fieldWork" onClick={() => setModalType('addFieldWork')}>
                <AddIcon /> Add Field Work
              </button>
            </div>
          </div>

          <div className="legendCard">
            <div className="legendItem"><span className="dot legal"></span> Regular Holiday</div>
            <div className="legendItem"><span className="dot special"></span> Special Non-Working Holiday</div>
            <div className="legendItem"><span className="dot leave"></span> Approved Leave</div>
            <div className="legendItem"><span className="dot field"></span> Field Work</div>
            <div className="legendItem"><span className="dot ot"></span> Overtime</div>
          </div>
          <div className="mainContentSplit">
            <div className="leftCalendarColumn">
              <div className="calendarCard">
                <div className="calendarHeader">
                  <ChevronLeftIcon className="arrow" onClick={() => changeMonth(-1)} />
                  <h2>{`${monthName} ${year}`}</h2>
                  <ChevronRightIcon className="arrow" onClick={() => changeMonth(1)} />
                </div>
                <div className="calendarGridContainer">
                  <div className="gridHeader">
                    <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                  </div>
                  <div className="gridBody">
                    {blanks.map(b => <div key={`blank-${b}`} className="cell empty"></div>)}
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

                      let cellClass = "cell";
                      if (hasLeave) cellClass += " has-leave";
                      else if (hasField) cellClass += " has-field";
                      else if (hasOt) cellClass += " has-ot";
                      else if (hasHoliday) cellClass += " has-holiday";
                      if (isToday) cellClass += " is-today";

                      return (
                        <div 
                            key={d} 
                            className={`${cellClass} clickableCell`} // Added clickableCell class
                            onClick={() => handleDayClick(d)}        // Trigger the modal
                          >
                          <span className="dayNum">{d}</span>
                          {dayEvents.map((e, i) => {
                            let typeClass = "legal";
                            if (e.type === "Holiday") {
                              typeClass = e.details.toLowerCase().includes("special") ? "special" : "legal";
                            } else if (e.type === "Leave") {
                              typeClass = "leave";
                            } else if (e.type === "Field Work") {
                              typeClass = "field";
                            } else if (e.type === "Overtime") {
                              typeClass = "ot";
                            }
                            return (
                              <div key={i} className={`event ${typeClass}`}>
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

            <div className="rightTablesColumn">
               {/* Holidays List Card */}
            <div className="detailCard">
                <div className="cardHeader">
                <h3>Upcoming Holidays</h3>
                </div>
                <div className="listWrapper">
                {getUpcomingHolidays().length > 0 ? getUpcomingHolidays().map((holiday, idx) => (
                    <div className="listItem clickable" key={idx} onClick={() => handleHolidayClick(holiday)}>
                    <div className="info">
                        <p className="name">{holiday.name}</p>
                        <span className="subtext">
                          {new Date(holiday.date).toLocaleDateString()} • {holiday.type}
                        </span>
                    </div>
                    {isAdmin && (
                      <div className="icons">
                          <EditIcon className="edit" onClick={() => setModalType('editHoliday')} />
                          <button 
                              className="deleteBtn" 
                              onClick={(e) => {
                                e.stopPropagation();
                                initiateDelete(holiday.id, 'Holiday');
                              }}
                              > <DeleteIcon className="delete" />
                          </button>
                      </div>
                    )}
                    </div>
                )) : (
                  <p style={{ textAlign: 'center', color: '#777', padding: '20px' }}>No upcoming holidays</p>
                )}
                </div>
            </div>

            {/* Field Work List Card */}
            <div className="detailCard">
                <div className="cardHeader">
                <h3>Field Work Assignments</h3>
                </div>
                <div className="listWrapper">
                {events.filter(e => e.type === "Field Work").length > 0 ?events.filter(e => e.type === "Field Work").map((field, idx) => (
                    <div className="listItem fieldWork clickable" key={idx} onClick={() => handleFieldWorkClick(field)}>
                      <div className="info">
                        <p className="name">{field.name}</p>
                        <span className="subtext">{field.date}</span>
                        <p className="purpose">{field.details}</p>
                      </div>
                        <button 
                             className="deleteBtn" 
                             onClick={(e) => {
                               e.stopPropagation();
                               initiateDelete(field.id, field.type);
                             }}
                             > <DeleteIcon className="delete" />
                        </button>
                    </div>
                )) : (
                  <p style={{ textAlign: 'center', color: '#777', padding: '20px' }}>No field work assignments this month</p>
                )}
                
                </div>
              </div>
            </div>
          </div>

          {/* Popup Modals */}
          {modalType && (
            <div className="modalOverlay">
              <div className="modalContainer">
                <div className="modalHeader">
                  <h2>{modalType.includes('Holiday') ? (modalType.startsWith('add') ? 'Add' : 'Edit') + ' Holiday' : 'Add Field Work'}</h2>
                  <CloseIcon className="closeIcon" onClick={() => setModalType(null)} />
                </div>
                <form className="modalForm" onSubmit={modalType === 'addFieldWork' ? handleFieldWorkSubmit : handleHolidaySubmit}>
                  <div className="inputGroup">
                    <label>{modalType === 'addFieldWork' ? 'Select Employee' : 'Holiday Name'}</label>
                    {modalType === 'addFieldWork' ? (
                      <select 
                        value={fieldWorkForm.userId} 
                        onChange={(e) => setFieldWorkForm({...fieldWorkForm, userId: e.target.value})}
                        required
                      >
                        <option value="">Choose Employee...</option>
                        {employees.map(emp => (
                          <option key={emp.user_Id} value={emp.user_Id}>
                            {formatUserId(emp.user_Id)} - {emp.user_LastName} {emp.user_FirstName?.charAt(0)}.
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        placeholder="Enter name" 
                        value={holidayForm.name}
                        onChange={(e) => setHolidayForm({...holidayForm, name: e.target.value})}
                        required
                      />
                    )}
                  </div>
                  <div className="inputGroup">
                    <label>Date</label>
                    <input 
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
                    />
                  </div>
                  {modalType.includes('Holiday') ? (
                    <div className="inputGroup">
                      <label>Type</label>
                      <select 
                        value={holidayForm.type}
                        onChange={(e) => setHolidayForm({...holidayForm, type: e.target.value})}
                      >
                        <option>Regular Holiday</option>
                        <option>Special Holiday</option>
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="inputGroup">
                        <label>Location</label>
                        <input 
                          type="text" 
                          placeholder="e.g., Client Site A" 
                          value={fieldWorkForm.location}
                          onChange={(e) => setFieldWorkForm({...fieldWorkForm, location: e.target.value})}
                          required
                        />
                      </div>
                      <div className="inputGroup">
                        <label>Hours</label>
                        <input 
                          type="number" 
                          step="0.5"
                          value={fieldWorkForm.hours}
                          onChange={(e) => setFieldWorkForm({...fieldWorkForm, hours: e.target.value})}
                          required
                        />
                      </div>
                    </>
                  )}
                  <div className="modalActions">
                    <button type="button" className="cancelBtn" onClick={() => setModalType(null)}>Cancel</button>
                    <button type="submit" className={`submitBtn ${modalType === 'addFieldWork' ? 'orange' : 'purple'}`}>
                      Submit
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
           <ActionModal
              isOpen={showDeleteModal}
              onClose={() => setShowDeleteModal(false)}
              onConfirm={confirmDelete}
              variant="danger"
              title="Confirm Deletion"
              message="Are you sure you want to remove this calendar entry? This action cannot be undone."
            />
            {/* Holiday Conflict Modal */}
            <InfoModal 
              isOpen={!!selectedHolidayWork} 
              onClose={() => setSelectedHolidayWork(null)}
              title={`Field Work on ${selectedHolidayWork?.holiday.name}`}
            >
              <div className="conflictList">
                {selectedHolidayWork?.matchingWork.map((work, i) => (
                  <div key={i} className="workDetailItem">
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
                <div className="summaryRow"><span>Date:</span> <span>{selectedFieldLog?.date}</span></div>
                <div className="summaryRow"><span>Task:</span> <span>{selectedFieldLog?.details}</span></div>
                <hr />
                <p className="statusNote">This assignment is automatically credited as 8 hours worked on-field.</p>
              </div>
            </InfoModal>

            {/* Day Details Modal */}
            <InfoModal 
              isOpen={!!selectedDayDetails} 
              onClose={() => setSelectedDayDetails(null)}
              title={`Schedule for ${selectedDayDetails?.date}`}
            >
              <div className="dailyEventsList">
                {selectedDayDetails?.events.length > 0 ? (
                  selectedDayDetails.events.map((event, idx) => {
                    // Determine class based on your existing logic
                    let typeClass = "legal";
                    if (event.type === "Holiday") {
                      typeClass = event.details.toLowerCase().includes("special") ? "special" : "legal";
                    } else if (event.type === "Leave") typeClass = "leave";
                    else if (event.type === "Field Work") typeClass = "field";
                    else if (event.type === "Overtime") typeClass = "ot";

                    return (
                      <div key={idx} className={`eventDetailItem ${typeClass}`}>
                        <div className="eventHeader">
                          <span className={`dot ${typeClass}`}></span>
                          <strong>{event.type}</strong>
                        </div>
                        <p className="eventName">{event.name || event.details}</p>
                        {/* Show extra details if it's field work */}
                        {event.type === "Field Work" && (
                          <p className="eventSubtext">Automatically credited as 8 hours on-field.</p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="emptyDayState">
                    <p>No events or assignments scheduled for this day.</p>
                  </div>
                )}
              </div>
            </InfoModal>
        </div>
        {/* </PageTransition> */}
      </div>
    </div>
  );
};

export default CalendarManagement;