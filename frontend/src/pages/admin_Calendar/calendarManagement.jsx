import "./calendarManagement.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from '@mui/icons-material/Close';
import SyncIcon from '@mui/icons-material/Sync';
import { useState, useEffect } from "react";

const CalendarManagement = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // Default to March 2026
  const [modalType, setModalType] = useState(null);
  const [holidays, setHolidays] = useState([]);

  const fetchHolidays = async () => {
    try {
      const response = await fetch("http://localhost:4000/api/system/holidays");
      if (response.ok) {
        const data = await response.json();
        setHolidays(data);
      }
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  // Calendar Logic: Month and Year names   
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const monthIndex = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // Navigation Logic for all months
  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  // Logic to generate the calendar grid
  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  // Helper to get holidays for a specific day
  const getHolidaysForDay = (day) => {
    return holidays.filter(h => {
      const hDate = new Date(h.date);
      return hDate.getDate() === day && 
             hDate.getMonth() === monthIndex && 
             hDate.getFullYear() === year;
    });
  };

  // Helper to get upcoming holidays (today onwards)
  const getUpcomingHolidays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return holidays
      .filter(h => new Date(h.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5); // Show next 5
  };

  return (
    <div className="home calendarPage">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
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
            <div className="legendItem"><span className="dot periodstart"></span> Period Start</div>
            <div className="legendItem"><span className="dot periodend"></span> Period End</div>
          </div>

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
                  const dayHolidays = getHolidaysForDay(d);
                  return (
                    <div key={d} className="cell">
                      <span className="dayNum">{d}</span>
                      {dayHolidays.map((h, i) => (
                        <div key={i} className={`event ${h.type.toLowerCase().includes('special') ? 'special' : 'legal'}`}>
                          {h.name}
                        </div>
                      ))}
                      {/* Approved leaves and other events could be added here similarly */}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Section: Side-by-Side Lists */}
            <div className="bottomSection">
            {/* Holidays List Card */}
            <div className="detailCard">
                <div className="cardHeader">
                <h3>Upcoming Holidays</h3>
                <button className="viewAll">View Calendar</button>
                </div>
                <div className="listWrapper">
                {getUpcomingHolidays().length > 0 ? getUpcomingHolidays().map((holiday, idx) => (
                    <div className="listItem" key={idx}>
                    <div className="info">
                        <p className="name">{holiday.name}</p>
                        <span className="subtext">
                          {new Date(holiday.date).toLocaleDateString()} • {holiday.type}
                        </span>
                    </div>
                    <div className="icons">
                        <EditIcon className="edit" onClick={() => setModalType('editHoliday')} />
                        <DeleteIcon className="delete" />
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
                <div className="listItem fieldWork">
                    <div className="info">
                    <p className="name">Kathleen Pinto</p>
                    <span className="subtext">3/20/2026 • Client Site A</span>
                    <p className="purpose">Project Meeting & Site Inspection</p>
                    </div>
                    <div className="icons">
                    <DeleteIcon className="delete" />
                    </div>
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
                <form className="modalForm">
                  <div className="inputGroup">
                    <label>{modalType === 'addFieldWork' ? 'Employee Name' : 'Holiday Name'}</label>
                    <input type="text" placeholder="Enter name" />
                  </div>
                  <div className="inputGroup">
                    <label>Date</label>
                    <input type="date" />
                  </div>
                  {modalType.includes('Holiday') ? (
                    <div className="inputGroup">
                      <label>Type</label>
                      <select><option>Regular Holiday</option><option>Special Holiday</option></select>
                    </div>
                  ) : (
                    <div className="inputGroup">
                      <label>Location</label>
                      <input type="text" placeholder="e.g., Client Site A" />
                    </div>
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
        </div>
      </div>
    </div>
  );
};

export default CalendarManagement;