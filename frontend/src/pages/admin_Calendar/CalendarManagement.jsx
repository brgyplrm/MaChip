import "./calendarManagement.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from '@mui/icons-material/Close';
import { useState, useEffect } from "react";
import { formatUserId } from "../../utils/formatUserId";
import Toast from "../../components/toast/Toast";
import ActionModal from "../../components/actionModal/ActionModal";
import InfoModal from "../../components/infoModal/InfoModal";
import { useSelector } from "react-redux";


const CalendarManagement = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const initiateDelete = (user_Id) => {
    setUserToDelete(user_Id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const adminId = localStorage.getItem("token");
    const endpoint = `http://localhost:4000/api/request/delete/${userToDelete}`;
    try {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: { "x-admin-id": adminId },
    });
    
    if (response.ok) {
      // 2. Update the 'events' state (NOT 'data')
      setEvents(prev => prev.filter((item) => item.id !== userToDelete));
      setToast({ message: "Assignment deleted successfully.", type: "success" });
    } else {
      const result = await response.json();
      setToast({ message: result.error || "Failed to delete.", type: "error" });
    }
  } catch (err) {
    setToast({ message: "Could not connect to server.", type: "error" });
  } finally {
    setShowDeleteModal(false);
    setUserToDelete(null);
  }
  };

  const userData = JSON.parse(localStorage.getItem("userData") || "{}");
  const userId = userData.user_Id;

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

  const handleFieldWorkSubmit = async (e) => {
    e.preventDefault();
    if (!fieldWorkForm.userId || !fieldWorkForm.date || !fieldWorkForm.location) {
      setToast({ message: "Please fill in all fields.", type: "error" });
      return;
    }

    try {
      const response = await fetch("http://localhost:4000/api/request", {
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
      
      const response = await fetch(`http://localhost:4000/api/request/calendar-report?startDate=${firstDay}&endDate=${lastDay}`);
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
      const response = await fetch("http://localhost:4000/api/users/all");
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
    return events.filter(e => {
      if (!e.date) return false;
      const datePart = e.date.split('T')[0];
      const [ey, em, ed] = datePart.split('-').map(Number);
      return ed === day && (em - 1) === monthIndex && ey === year;
    });
  };

  const getUpcomingHolidays = () => {
    const todayStr = new Date().toISOString().split('T')[0];
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
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        <div className="calendarWrapper">
          <div className="pageHeader">
            <div className="title">
              <h1>Calendar Management</h1>
              <span>Manage holidays, leaves, and field work</span>
            </div>
            <div className="actions">
              <button className="btn holiday" onClick={() => setModalType('addHoliday')}>
                <AddIcon /> Add Holiday
              </button>
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

                      const today = new Date();
                      const isToday = 
                        d === today.getDate() && 
                        monthIndex === today.getMonth() && 
                        year === today.getFullYear();

                      let cellClass = "cell";
                      if (hasLeave) cellClass += " has-leave";
                      else if (hasField) cellClass += " has-field";
                      else if (hasOt) cellClass += " has-ot";
                      else if (hasHoliday) cellClass += " has-holiday";
                      if (isToday) cellClass += " is-today";

                      return (
                        <div key={d} className={cellClass}>
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
                    <div className="icons">
                        <EditIcon className="edit" onClick={() => setModalType('editHoliday')} />
                         <button 
                             className="deleteBtn" 
                             onClick={() => initiateDelete(holiday.id)}
                             > <DeleteIcon className="delete" />
                        </button>
                    </div>
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
                             onClick={() => initiateDelete(field.id)}
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
                <form className="modalForm" onSubmit={modalType === 'addFieldWork' ? handleFieldWorkSubmit : (e) => e.preventDefault()}>
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
                      <input type="text" placeholder="Enter name" />
                    )}
                  </div>
                  <div className="inputGroup">
                    <label>Date</label>
                    <input 
                      type="date" 
                      value={modalType === 'addFieldWork' ? fieldWorkForm.date : ""}
                      onChange={(e) => modalType === 'addFieldWork' && setFieldWorkForm({...fieldWorkForm, date: e.target.value})}
                      required
                    />
                  </div>
                  {modalType.includes('Holiday') ? (
                    <div className="inputGroup">
                      <label>Type</label>
                      <select><option>Regular Holiday</option><option>Special Holiday</option></select>
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
        </div>
      </div>
    </div>
  );
};

export default CalendarManagement;