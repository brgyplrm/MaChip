import "./sidebar.scss";
// Icons
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CurrencyRubleOutlinedIcon from '@mui/icons-material/CurrencyRubleOutlined';
import SecurityIcon from "@mui/icons-material/Security";
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ArchiveIcon from '@mui/icons-material/Archive';

// Libraries
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

//Components
import ActionModal from "../actionModal/ActionModal";


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
        // 1. Tell backend to log logout event
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_Id: userData?.user_Id }),
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

          {/* 1st Category */}
          <p className="title">MAIN</p>
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
          </NavLink><br />

          {/* 2nd Category */}
          {/* Admin Pages*/}
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
                  <BadgeOutlinedIcon className="icon" />
                  <span>Access Logs</span>
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
            </NavLink><br />
            </>
          )}

          {/* Admin only Pages */}
          {!isEmployee && (
            <>
            <p className="title">SYSTEM LOGS</p>
            <NavLink to="/auditLogs" style={{ textDecoration: "none" }}>
              <li>
                <SecurityIcon className="icon" />
                <span>Audit</span>
              </li>
            </NavLink>

            <NavLink to="/transactionLog" style={{ textDecoration: "none" }}>
              <li>
                <PsychologyOutlinedIcon className="icon" />
                <span>Transaction</span>
              </li>
            </NavLink><br />
            </>
          )}

          {/* Employee only Pages*/}
          {isEmployee && (
            <>
            <p className="title">LISTS</p>
            <NavLink to="/requests" style={{ textDecoration: "none" }}>
              <li>
                <PendingActionsIcon className="icon" />
                <span>Requests</span>
              </li>
            </NavLink>

            <NavLink to="/accessLogs" style={{ textDecoration: "none" }}>
              <li>
                <BadgeOutlinedIcon className="icon" />
                <span>Access Logs</span>
              </li>
            </NavLink><br />
            </>
          )}

          <p className="title">USER</p>

          {!isEmployee && (
            <NavLink to="/settings" style={{ textDecoration: "none" }}>
              <li>
                <SettingsApplicationsIcon className="icon" />
                <span>Settings</span>
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
          
          {/* <NavLink to="/profile" style={{ textDecoration: "none" }}>
            <li>
              <AccountCircleOutlinedIcon className="icon" />
              <span>Profile</span>
            </li>
          </NavLink> */}
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
