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
import MenuIcon from "@mui/icons-material/Menu"; // NEW: Icon for the toggle button
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SavingsIcon from '@mui/icons-material/Savings';
import HistoryIcon from '@mui/icons-material/History';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import CrisisAlertIcon from '@mui/icons-material/CrisisAlert';

// Libraries
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react"; // Added useEffect
import { useNavigate, useLocation } from "react-router-dom";

//Components
import ActionModal from "../actionModal/ActionModal";


const Sidebar = () => {
  const location = useLocation();
  const userDataString = localStorage.getItem("userData");
  const userData = userDataString ? JSON.parse(userDataString) : null;
  const roleId = userData?.user_RoleId;
  
  // Real roles
  const isAdminRole = roleId === 1;
  const isSupervisorRole = roleId === 2;
  const isEmployeeRole = roleId === 3;

  // View Mode Logic
  const viewMode = localStorage.getItem("viewMode") || "management";
  const isManagementView = viewMode === "management" && (isAdminRole || isSupervisorRole);
  const isEmployeeView = isEmployeeRole || viewMode === "employee";

  const [showLogoutModal, setShowLogoutModal] = useState(false); // Modal state
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth <= 768);  const navigate = useNavigate();

  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isPayrollOpen, setIsPayrollOpen] = useState(location.pathname.startsWith("/payroll"));

  useEffect(() => {
    if (location.pathname.startsWith("/payroll")) {
      setIsPayrollOpen(true);
    }
  }, [location.pathname]);

  const handleLogoClick = (e) => {
    e.preventDefault();
    if (window.innerWidth <= 768) {
      setIsOverlayOpen(!isOverlayOpen); // Open overlay on mobile
    } else {
      navigate(isEmployeeView ? "/employeeHome" : "/"); // Navigate home on desktop
    }
  };

  const closeOverlay = () => {
    if (window.innerWidth <= 768) {
      setIsOverlayOpen(false);
    }
  };
  
useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) { // Adjust this pixel value (e.g., 1024) if you want it to collapse sooner
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    window.addEventListener("resize", handleResize);
    
    // Cleanup listener on component unmount
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogoutClick = () => {
    setShowLogoutModal(true); // Open the modal instead of navigating
  };

  const confirmLogout = async () => {
      try {
        // 1. Tell backend to log logout event and clear HttpOnly cookie
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_Id: userData?.user_Id }),
          credentials: "include", // Required to send/clear cookies
        });

        // 2. Clear local storage
        localStorage.removeItem("token");
        localStorage.removeItem("userData");
        localStorage.removeItem("viewMode");

        // 3. Redirect to login
        navigate("/login");
      } catch (err) {
        console.error("Logout failed:", err);
        // Fallback: clear local data anyway
        localStorage.clear();
        navigate("/login");
      }
    };

  return (
    <>
    {isOverlayOpen && <div className="sidebarBackdrop" onClick={closeOverlay}></div>}

    <div className={`sidebar ${isCollapsed && !isOverlayOpen ? "collapsed" : ""} ${isOverlayOpen ? "mobileOverlay" : ""}`}>
      <div className="top">
        {/* NEW: Toggle Button */}
        <div className="toggleBtn" onClick={() => setIsCollapsed(!isCollapsed)}>
        </div>

        <NavLink to={isEmployeeView ? "/employeeHome" : "/"} style={{ textDecoration: "none" }}>
          <span className="logo" onClick={handleLogoClick} style={{ cursor: "pointer" }}>
            {/* Show small logo when collapsed, full logo when expanded */}
            {isCollapsed ? (
               <div className="smallLogo">
                  {!isOverlayOpen ? "M" : <img src="/images.png" alt="Logo" className="logo-img" />}
               </div>
            ) : (
               <img src="/images.png" alt="Logo" className="logo-img" />
            )}
          </span>
        </NavLink>
      </div>
      <hr />
      <div className="center" onClick={closeOverlay}>
        <ul>
          {/* Main Category */}
          <p className="title">{(isCollapsed && !isOverlayOpen) ? "..." : "MAIN"}</p>
            
            <NavLink to={isEmployeeView ? "/employeeHome" : "/"} style={{ textDecoration: "none" }}>
              <li title="Dashboard">
                <DashboardIcon className="icon" />
                <span>Dashboard</span>
              </li>
            </NavLink>

          <NavLink to={isEmployeeView ? "/employeeCalendar" : "/calendar"} style={{ textDecoration: "none" }}>
            <li title="Calendar">
              <CalendarMonthOutlinedIcon className="icon" />
              <span>Calendar</span>
            </li>
          </NavLink><br />

          {/* Management Lists */}
          {isManagementView && (
            <>
              <p className="title">{(isCollapsed && !isOverlayOpen) ? "..." : "LISTS"}</p>

              {isAdminRole && (
                <NavLink to="/users" style={{ textDecoration: "none" }}>
                  <li title="Users">
                    <PersonOutlineIcon className="icon" />
                    <span>Users</span>
                  </li>
                </NavLink>
              )}

              {isAdminRole && (
                <NavLink to="/logs" style={{ textDecoration: "none" }}>
                  <li title="Access Logs">
                    <BadgeOutlinedIcon className="icon" />
                    <span>Access Logs</span>
                  </li>
                </NavLink>
              )}

            <NavLink to="/adminRequests" style={{ textDecoration: "none" }}>
              <li title="Requests">
                <PendingActionsIcon className="icon" />
                <span>Requests</span>
              </li>
            </NavLink>

            {isAdminRole && (
              <div className="menu-item-group">
                <NavLink to="/payroll" style={{ textDecoration: "none" }} end={false}>
                  <li 
                    title="Payroll" 
                    onClick={() => setIsPayrollOpen(true)}
                  >
                    <CurrencyRubleOutlinedIcon className="icon" />
                    <span>Payroll</span>
                    {!isCollapsed && (
                      <div 
                        className="expand-toggle"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsPayrollOpen(!isPayrollOpen);
                        }}
                      >
                        {isPayrollOpen ? <ExpandMoreIcon className="expand-icon" /> : <ChevronRightIcon className="expand-icon" />}
                      </div>
                    )}
                  </li>
                </NavLink>
                {isPayrollOpen && !isCollapsed && (
                  <ul className="sub-menu">
                    <NavLink to="/payroll" style={{ textDecoration: "none" }} end>
                      <li title="Management">
                        <ListAltIcon className="icon sub-icon" />
                        <span>Management</span>
                      </li>
                    </NavLink>
                    <NavLink to="/payroll/maxicare" style={{ textDecoration: "none" }}>
                      <li title="Maxicare">
                        <LocalHospitalIcon className="icon sub-icon" />
                        <span>Maxicare</span>
                      </li>
                    </NavLink>
                    <NavLink to="/payroll/eastwest" style={{ textDecoration: "none" }}>
                      <li title="Eastwest Loan">
                        <CreditCardIcon className="icon sub-icon" />
                        <span>Eastwest Loan</span>
                      </li>
                    </NavLink>
                    <NavLink to="/payroll/gov-loans" style={{ textDecoration: "none" }}>
                      <li title="Governmental Loans">
                        <AccountBalanceIcon className="icon sub-icon" />
                        <span>Governmental Loans</span>
                      </li>
                    </NavLink>
                    <NavLink to="/payroll/cash-advance" style={{ textDecoration: "none" }}>
                      <li title="Cash Advances">
                        <PaymentsIcon className="icon sub-icon" />
                        <span>Cash Advances</span>
                      </li>
                    </NavLink>
                    <NavLink to="/payroll/leave-summary" style={{ textDecoration: "none" }}>
                      <li title="Leave Summary">
                        <HistoryIcon className="icon sub-icon" />
                        <span>Leave Summary</span>
                      </li>
                    </NavLink>
                  </ul>
                )}
              </div>
            )}

            {isAdminRole && (
              <NavLink to="/adminReports" style={{ textDecoration: "none" }}>
                <li title="Reports">
                  <RequestQuoteOutlinedIcon className="icon" />
                  <span>Reports</span>
                </li>
              </NavLink>
            )}<br />
            </>
          )}

          {/* Admin only Pages */}
          {isManagementView && isAdminRole && (
            <>
            <p className="title">{(isCollapsed && !isOverlayOpen) ? "..." : "SYSTEM LOGS"}</p>
            <NavLink to="/auditLogs" style={{ textDecoration: "none" }}>
              <li title="Audit">
                <SecurityIcon className="icon" />
                <span>Audit</span>
              </li>
            </NavLink>

            <NavLink to="/transactionLog" style={{ textDecoration: "none" }}>
              <li title="Transaction">
                <PsychologyOutlinedIcon className="icon" />
                <span>Transaction</span>
              </li>
            </NavLink><br />
            </>
          )}

          {/* Employee only Pages */}
          {isEmployeeView && (
            <>
            <p className="title">{(isCollapsed && !isOverlayOpen) ? "..." : "LISTS"}</p>
            <NavLink to="/requests" style={{ textDecoration: "none" }}>
              <li title="Requests">
                <PendingActionsIcon className="icon" />
                <span>Requests</span>
              </li>
            </NavLink>

            <NavLink to="/accessLogs" style={{ textDecoration: "none" }}>
              <li title="Access Logs">
                <BadgeOutlinedIcon className="icon" />
                <span>Access Logs</span>
              </li>
            </NavLink><br />
            </>
          )}

          <p className="title">{(isCollapsed && !isOverlayOpen) ? "..." : "USER"}</p>

          {isManagementView && (
            <NavLink to="/settings" style={{ textDecoration: "none" }}>
              <li title="Settings">
                <SettingsApplicationsIcon className="icon" />
                <span>Settings</span>
              </li>
            </NavLink>
          )}

          <NavLink to="/notifications" style={{ textDecoration: "none" }}>
            <li title="Notifications">
              <NotificationsNoneIcon className="icon" />
              <span>Notifications</span>
            </li>
          </NavLink>
          
          <div className="logoutItem" onClick={handleLogoutClick}>
          <li title="Logout">
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
    </>
  );
};

export default Sidebar;
