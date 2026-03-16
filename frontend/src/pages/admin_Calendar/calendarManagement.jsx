import "./calendarManagement.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from '@mui/icons-material/Close';
import { useState } from "react";

const CalendarManagement = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // Default to March 2026
  const [modalType, setModalType] = useState(null);

  // Calendar Logic: Month and Year names   
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
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
                <AddIcon /> CSV
              </button>
              <button className="btn holiday" onClick={() => setModalType('addHoliday')}>
                <AddIcon /> Add Holiday
              </button>
              <button className="btn fieldWork" onClick={() => setModalType('addFieldWork')}>
                <AddIcon /> Add Field Work
              </button>
            </div>
          </div>

          <div className="legendCard">
            <div className="legendItem"><span className="dot legal"></span> Legal Holiday</div>
            <div className="legendItem"><span className="dot special"></span> Special Holiday</div>
            <div className="legendItem"><span className="dot leave"></span> Approved Leave</div>
            <div className="legendItem"><span className="dot field"></span> Field Work</div>
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
                    {/* Example event logic matching your screenshot */}
                    {monthName === "March" && d === 25 && <div className="event special">Araw ng Dabaw</div>}
                    {monthName === "March" && d === 18 && <div className="event leave">Kathleen Pinto - VL</div>}
                  </div>
                ))}
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
                {[
                    { name: "Araw ng Dabaw", date: "3/25/2026", type: "Special" },
                    { name: "Araw ng Kagitingan", date: "4/9/2026", type: "Legal" },
                    { name: "Labor Day", date: "5/1/2026", type: "Legal" },
                    { name: "Independence Day", date: "6/12/2026", type: "Legal" }
                ].map((holiday, idx) => (
                    <div className="listItem" key={idx}>
                    <div className="info">
                        <p className="name">{holiday.name}</p>
                        <span className="subtext">{holiday.date} • {holiday.type}</span>
                    </div>
                    <div className="icons">
                        <EditIcon className="edit" onClick={() => setModalType('editHoliday')} />
                        <DeleteIcon className="delete" />
                    </div>
                    </div>
                ))}
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