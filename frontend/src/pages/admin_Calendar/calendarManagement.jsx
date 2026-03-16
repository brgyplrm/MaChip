import React from "react";
import "./calendarManagement.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const CalendarManagement = () => {
  return (
    <div className="home calendarPage">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="calendarWrapper">
          {/* Header Section */}
          <div className="pageHeader">
            <div className="title">
              <h1>Calendar Management</h1>
              <span>Manage holidays, leaves, and field work</span>
            </div>
            <div className="actions">
              <button className="btn holiday"><AddIcon /> Add Holiday</button>
              <button className="btn fieldWork"><AddIcon /> Add Field Work</button>
            </div>
          </div>

          {/* Legend */}
          <div className="legendCard">
            <div className="legendItem"><span className="dot legal"></span> Legal Holiday</div>
            <div className="legendItem"><span className="dot special"></span> Special Holiday</div>
            <div className="legendItem"><span className="dot regular"></span> Regular Holiday</div>
            <div className="legendItem"><span className="dot leave"></span> Approved Leave</div>
            <div className="legendItem"><span className="dot field"></span> Field Work</div>
          </div>

          {/* Main Calendar */}
          <div className="calendarCard">
            <div className="calendarHeader">
              <ChevronLeftIcon className="arrow" />
              <h2>March 2026</h2>
              <ChevronRightIcon className="arrow" />
            </div>
            <table className="calendarGrid">
              <thead>
                <tr>
                  <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>
                </tr>
              </thead>
              <tbody>
                {/* Simplified row example - row 3 & 4 from screenshot */}
                <tr>
                  <td>15</td><td className="today">16</td><td>17</td>
                  <td>
                    18 <div className="event leave">Kathleen Pinto - Vacation Leave</div>
                  </td>
                  <td>
                    19 <div className="event leave">Kathleen Pinto - Vacation Leave</div>
                  </td>
                  <td>
                    20 <div className="event field">Kathleen Pinto - Field Work</div>
                  </td>
                  <td>21</td>
                </tr>
                <tr>
                  <td>
                    22 <div className="event leave sick">John Dela Cruz - Sick Leave</div>
                  </td>
                  <td>23</td><td>24</td>
                  <td>
                    25 <div className="event special">Araw ng Dabaw</div>
                  </td>
                  <td>26</td><td>27</td><td>28</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bottom Detail Cards */}
          <div className="bottomSection">
            <div className="detailCard">
              <h3>Holidays</h3>
              <div className="listItem">
                <div className="info">
                  <p className="name">Araw ng Dabaw</p>
                  <span>3/25/2026 • Special</span>
                </div>
                <div className="icons"><EditIcon /><DeleteIcon className="del" /></div>
              </div>
              {/* Additional list items per image_e58280.png */}
            </div>

            <div className="detailCard">
              <h3>Field Work Assignments</h3>
              <div className="listItem">
                <div className="info">
                  <p className="name">Kathleen Pinto</p>
                  <span>3/20/2026 • Client Site A</span>
                  <p className="sub">Project Meeting</p>
                </div>
                <div className="icons"><DeleteIcon className="del" /></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarManagement;