import "./sidebar.scss";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CurrencyRubleOutlinedIcon from '@mui/icons-material/CurrencyRubleOutlined';
import { NavLink } from "react-router-dom";
import ActionModal from "../actionModal/ActionModal"; // Import your component
import { useState } from "react";
import { useNavigate } from "react-router-dom";


const Sidebar = () => {
  const userDataString = localStorage.getItem("userData");
  const userData = userDataString ? JSON.parse(userDataString) : null;
  const isEmployee = userData?.user_RoleId === 3;
  const [showLogoutModal, setShowLogoutModal] = useState(false); // Modal state
  const navigate = useNavigate();
  

  const handleLogoutClick = () => {
    setShowLogoutModal(true); // Open the modal instead of navigating
  };

  const confirmLogout = async () => {
      try {
        // 1. Optional: Tell your backend (Express/Flask) to end the session
        // Based on your port 4000 setup
        await fetch("http://localhost:4000/api/users/logout", {
          method: "POST",
        });

        // 2. Clear local storage/Session storage
        localStorage.removeItem("token");
        localStorage.removeItem("userData");

        // 3. Redirect back to the login page you just created
        navigate("/login");
      } catch (err) {
        console.error("Logout failed:", err);
        // Fallback: clear local data anyway
        localStorage.clear();
        navigate("/login");
      }
    };

  return (
    <div className="sidebar">
      <div className="top">
        {/* Updated logo link to go to appropriate dashboard */}
        <NavLink to={isEmployee ? "/employeeHome" : "/"} style={{ textDecoration: "none" }}>
          <span className="logo">
            <img src="/images.png" alt="Logo" className="logo-img" />
          </span>
        </NavLink>
      </div>
      <hr />
      <div className="center">
        <ul>
          <p className="title">MAIN</p>
          {/* Dashboard is now visible to everyone, but points to different routes */}
          <NavLink to={isEmployee ? "/employeeHome" : "/"} style={{ textDecoration: "none" }}>
            <li>
              <DashboardIcon className="icon" />
              <span>Dashboard</span>
            </li>
          </NavLink>

          <NavLink to="/calendar" style={{ textDecoration: "none" }}>
            <li>
              <CalendarMonthOutlinedIcon className="icon" />
              <span>Calendar</span>
            </li>
          </NavLink>

          {/* Admin and Staff Only Sections */}
          {!isEmployee && (
            <>
              <p className="title">LISTS</p>
              <NavLink to="/users" style={{ textDecoration: "none" }}>
                <li>
                  <PersonOutlineIcon className="icon" />
                  <span>Users</span>
                </li>
              </NavLink>
              <NavLink to="/logs" style={{ textDecoration: "none" }}>
                <li>
                  <PsychologyOutlinedIcon className="icon" />
                  <span>Logs</span>
                </li>
              </NavLink>
            <NavLink to="/adminRequests" style={{ textDecoration: "none" }}>
              <li>
                <PendingActionsIcon className="icon" />
                <span>Requests</span>
              </li>
            </NavLink>
            <NavLink to="/payroll" style={{ textDecoration: "none" }}>
              <li>
                  <CurrencyRubleOutlinedIcon className="icon" />
                  <span>Payroll</span>
              </li>
            </NavLink>
            <NavLink to="/adminReports" style={{ textDecoration: "none" }}>
              <li>
                <RequestQuoteOutlinedIcon className="icon" />
                <span>Reports</span>
              </li>
            </NavLink>
            </>
          )}

          {/* Employee only */}
          <p className="title">USER</p>
          {isEmployee && (
            <NavLink to="/requests" style={{ textDecoration: "none" }}>
              <li>
                <PendingActionsIcon className="icon" />
                <span>Requests</span>
              </li>
            </NavLink>
          )}
          {isEmployee && (
            <NavLink to="/accessLogs" style={{ textDecoration: "none" }}>
              <li>
                <RequestQuoteOutlinedIcon className="icon" />
                <span>Access Logs</span>
              </li>
            </NavLink>
          )}


          {/* Shared Routes */}
          <NavLink to="/notifications" style={{ textDecoration: "none" }}>
            <li>
              <NotificationsNoneIcon className="icon" />
              <span>Notifications</span>
            </li>
          </NavLink>
          
          {/* Admin only Settings */}
          {!isEmployee && (
            <NavLink to="/settings" style={{ textDecoration: "none" }}>
              <li>
                <SettingsApplicationsIcon className="icon" />
                <span>Settings</span>
              </li>
            </NavLink>
          )}
          <NavLink to="/profile" style={{ textDecoration: "none" }}>
            <li>
              <AccountCircleOutlinedIcon className="icon" />
              <span>Profile</span>
            </li>
          </NavLink>
          <div className="logoutItem" onClick={handleLogoutClick}>
          <li>
            <ExitToAppIcon className="icon" />
            <span>Logout</span>
          </li>
          </div>
        </ul>
      </div>

      <ActionModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        title="Confirm Logout"
        message="Are you sure you want to log out of the MaChip system?"
      />
    </div>
  );
};

export default Sidebar;
