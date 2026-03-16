import React, { useState } from "react";
import "./employeeCalendar.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const EmployeeCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // Default to March 2026

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  // Grid Logic
  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

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

          {/* Legend: Matches Admin for Consistency */}
          <div className="legendCard">
            <div className="legendItem"><span className="dot legal"></span> Legal Holiday</div>
            <div className="legendItem"><span className="dot special"></span> Special Holiday</div>
            <div className="legendItem"><span className="dot leave"></span> My Approved Leave</div>
            <div className="legendItem"><span className="dot field"></span> My Field Work</div>
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
                {days.map(d => (
                  <div key={d} className="cell">
                    <span className="dayNum">{d}</span>
                    {/* Event indicators */}
                    {monthName === "March" && d === 25 && <div className="event special">Araw ng Dabaw</div>}
                    {monthName === "March" && d === 18 && <div className="event leave">Vacation Leave</div>}
                    {monthName === "March" && d === 20 && <div className="event field">Field Work</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bottomSection">
            <div className="detailCard">
              <h3>Upcoming Holidays</h3>
              <div className="listWrapper">
                <div className="listItem">
                  <div className="info">
                    <p className="name">Araw ng Dabaw</p>
                    <span className="subtext">3/25/2026 • Special</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="detailCard">
              <h3>My Field Work Assignments</h3>
              <div className="listWrapper">
                <div className="listItem fieldWork">
                  <div className="info">
                    <p className="name">Client Site A</p>
                    <span className="subtext">March 20, 2026</span>
                    <p className="purpose">Project Meeting & Site Inspection</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeCalendar;