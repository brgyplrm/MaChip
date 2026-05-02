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
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import { useState, useEffect } from "react";
import { formatUserId } from "../../utils/formatUserId";


const CalendarManagement = () => {
  // --- State Declarations ---
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
  const [selectedHolidayWork, setSelectedHolidayWork] = useState(null);
  const [selectedFieldLog, setSelectedFieldLog] = useState(null);
  const [viewingHoliday, setViewingHoliday] = useState(null);
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

  // --- Constants ---
  const userData = JSON.parse(localStorage.getItem("userData") || "{}");
  const isAdmin = userData.user_RoleId === 1;
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const monthIndex = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // --- Logic Functions ---

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
    const matchingWork = events.filter(e => 
      e.type === "Field Work" && 
      e.date.split('T')[0] === holiday.date.split('T')[0]
    );

    if (matchingWork.length > 0) {
      setSelectedHolidayWork({ holiday, matchingWork });
    } else {
      setViewingHoliday(holiday);
    }
  };

  const handleFieldWorkClick = (fieldWork) => {
    setSelectedFieldLog(fieldWork);
  };

  const initiateDelete = (id, type) => {
    setItemToDelete({ id, type });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const { id, type } = itemToDelete;
    const endpoint = type === 'Holiday' ? `/api/system/holidays/${id}` : `/api/request/delete/${id}`;

    try {
      const response = await fetchWithAuth(endpoint, { method: "DELETE" });
      if (response.ok) {
        setEvents(prev => prev.filter((item) => item.id !== id || item.type !== type));
        setToast({ message: `${type} deleted successfully.`, type: "success" });
        fetchCalendarEvents();
      }
    } catch (err) {
      setToast({ message: "Could not connect to server.", type: "error" });
    } finally {
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  const handleHolidaySubmit = async (e) => {
    e.preventDefault();
    try {
      const isEdit = !!holidayForm.id;
      const endpoint = isEdit ? `/api/system/holidays/${holidayForm.id}` : "/api/system/holidays";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetchWithAuth(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: holidayForm.name,
          date: holidayForm.date,
          type: holidayForm.type
        }),
      });
      if (response.ok) {
        setToast({ message: `Holiday ${isEdit ? 'updated' : 'added'} successfully!`, type: "success" });
        setModalType(null);
        fetchCalendarEvents();
      }
    } catch (error) {
      setToast({ message: "Connection error.", type: "error" });
    }
  };

  const handleFieldWorkSubmit = async (e) => {
    e.preventDefault();
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
        setToast({ message: "Field work assigned successfully!", type: "success" });
        setModalType(null);
        fetchCalendarEvents();
      }
    } catch (error) {
      setToast({ message: "Connection error.", type: "error" });
    }
  };

  // --- Helper Functions ---
  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const getEventsForDay = (day) => {
    const targetDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => {
      if (!e.date) return false;
      const startDateStr = e.date.split('T')[0];
      if (!e.endDate) return startDateStr === targetDateStr;
      const endDateStr = e.endDate.split('T')[0];
      return targetDateStr >= startDateStr && targetDateStr <= endDateStr;
    });
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
    <div className="home calendarPage">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        <div className="calendarWrapper">
          <div className="pageHeader">
            <div className="title">
              <h1>Calendar Management</h1>
              <span>Manage {isAdmin ? "holidays, leaves, and field work" : "field work assignments"}</span>
            </div>
            <div className="actions">
              {isAdmin && (
                <button className="btn holiday" onClick={() => {
                  setHolidayForm({ id: null, name: "", date: "", type: "Regular Holiday" });
                  setModalType('addHoliday');
                }}>
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
                <h3>{holidayListHeader}</h3>
                </div>
                <div className="listWrapper" onScroll={handleHolidayScroll}>
                {getUpcomingHolidays().length > 0 ? getUpcomingHolidays().map((holiday, idx) => {
                    const isPast = holiday.date < systemToday.toISOString().split('T')[0];
                    return (
                        <div className={`listItem clickable ${isPast ? 'past-item' : ''}`} key={idx} onClick={() => handleHolidayClick(holiday)}>
                        <div className="info">
                            <p className="name">{holiday.name} {isPast && <span className="past-tag">(PAST)</span>}</p>
                            <span className="subtext">
                              {new Date(holiday.date).toLocaleDateString()} • {holiday.type}
                            </span>
                        </div>
                        {isAdmin && (
                          <div className="icons">
                              <EditIcon 
                                className="edit" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHolidayForm({
                                    id: holiday.id,
                                    name: holiday.name,
                                    date: holiday.date.split('T')[0],
                                    type: holiday.details
                                  });
                                  setModalType('editHoliday');
                                }} 
                          />
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
                    );
                }) : (
                  <p style={{ textAlign: 'center', color: '#777', padding: '20px' }}>No holidays found</p>
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
                        <option value="Regular Holiday" style={{ color: "#b91c1c" }}>
                          Regular Holiday
                        </option>
                        <option value="Special Holiday" style={{ color: "#6b21a8" }}>
                          Special Holiday
                        </option>
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

            {/* General Holiday Info Modal */}
            <InfoModal 
              isOpen={!!viewingHoliday} 
              onClose={() => setViewingHoliday(null)}
              title="Holiday Details"
            >
              <div className="logSummary">
                <div className="summaryRow">
                  <span>Holiday Name:</span> <span>{viewingHoliday?.name}</span>
                </div>
                <div className="summaryRow">
                  <span>Date:</span> <span>{viewingHoliday ? new Date(viewingHoliday.date).toLocaleDateString() : ""}</span>
                </div>
                <div className="summaryRow">
                  <span>Type:</span> <span>{viewingHoliday?.type}</span>
                </div>
                <hr />
                <p className="statusNote">This is a non-working day. Attendance is not required.</p>
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
                      // Step 1: Determine the CSS class based on event type
                      let typeClass = "legal";
                      if (event.type === "Holiday") {
                        typeClass = event.details.toLowerCase().includes("special") ? "special" : "legal";
                      } else if (event.type === "Leave") typeClass = "leave";
                      else if (event.type === "Field Work") typeClass = "field";
                      else if (event.type === "Overtime") typeClass = "ot";

                      return (
                        // Step 2: Apply the type class here
                        <div key={idx} className={`eventDetailItem ${typeClass}`}>
                          <div className="eventHeader">
                            {/* Step 3: Add the legend dot */}
                            <span className={`dot ${typeClass}`}></span>
                            <strong>{event.type}</strong>
                          </div>
                          <p className="eventName">{event.name || event.details}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="emptyDayState">
                      <p>No events scheduled for this day.</p>
                    </div>
                  )}
                </div>
              </InfoModal>
        </div>
      </div>
    </div>
  );
};

export default CalendarManagement;