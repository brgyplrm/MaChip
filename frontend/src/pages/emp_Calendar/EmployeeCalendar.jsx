import React, { useState, useEffect } from "react";
import "./employeeCalendar.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import InfoModal from "../../components/infoModal/InfoModal";

const EmployeeCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedHolidayWork, setSelectedHolidayWork] = useState(null);
  const [selectedFieldLog, setSelectedFieldLog] = useState(null);

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

  const handleFieldWorkClick = (fieldWork) => {
    // In a real app, you might fetch specific logs here
    setSelectedFieldLog(fieldWork);
  };

  const userData = JSON.parse(localStorage.getItem("userData") || "{}");
  const userId = userData.user_Id;

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();

  const fetchCalendarEvents = async () => {
    setLoading(true);
    try {
      // Fetch for the whole year
      const firstDay = `${year}-01-01`;
      const lastDay = `${year}-12-31`;
      
      const response = await fetch(`http://localhost:4000/api/request/calendar-report?startDate=${firstDay}&endDate=${lastDay}&user_Id=${userId}`);
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

  useEffect(() => {
    if (userId) fetchCalendarEvents();
  }, [currentDate, userId]);

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  // Grid Logic
  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getEventsForDay = (day) => {
    return events.filter(e => {
      if (!e.date) return false;
      // Handle both YYYY-MM-DD and full ISO strings
      const datePart = e.date.split('T')[0];
      const [ey, em, ed] = datePart.split('-').map(Number);
      return ed === day && (em - 1) === monthIndex && ey === year;
    });
  };

  return (
    <div className="home calendarPage employeeView">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="calendarWrapper">
          <div className="pageHeader">
            <div className="title">
              <h1>My Calendar</h1>
              <span>View holidays, approved leaves, and assignments</span>
            </div>
          </div>

          <div className="legendCard">
            <div className="legendItem"><span className="dot legal"></span> Legal Holiday</div>
            <div className="legendItem"><span className="dot special"></span> Special Holiday</div>
            <div className="legendItem"><span className="dot leave"></span> My Approved Leave</div>
            <div className="legendItem"><span className="dot field"></span> My Field Work</div>
            <div className="legendItem"><span className="dot ot"></span> My Overtime</div>
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
                  if (isToday) cellClass += " is-today";
                  if (hasLeave) cellClass += " has-leave";
                  else if (hasField) cellClass += " has-field";
                  else if (hasOt) cellClass += " has-ot";
                  else if (hasHoliday) cellClass += " has-holiday";

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
            <div className="detailCard">
              <h3>Holidays this Month</h3>
              <div className="listWrapper">
                {events.filter(e => e.type === "Holiday").map((h, idx) => (
                  <div className="listItem clickable" 
                        key={idx} 
                        onClick={() => handleHolidayClick(h)}>
                    <div className="info">
                      <p className="name">{h.name}</p>
                      <span className="subtext">{h.date} • {h.details}</span>
                    </div>
                  </div>
                ))}
                {events.filter(e => e.type === "Holiday").length === 0 && <p className="emptyText">No holidays this month.</p>}
              </div>
            </div>

            <div className="detailCard">
              <h3>My Field Work Assignments</h3>
              <div className="listWrapper">
                {events.filter(e => e.type === "Field Work").map((f, idx) => (
                  <div className="listItem fieldWork clickable" 
                        key={idx} 
                        onClick={() => handleFieldWorkClick(f)}>
                    <div className="info">
                      <p className="name">{f.details}</p>
                      <span className="subtext">{f.date}</span>
                    </div>
                  </div>
                ))}
                {events.filter(e => e.type === "Field Work").length === 0 && <p className="emptyText">No field work assignments.</p>}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
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
  );
};

export default EmployeeCalendar;