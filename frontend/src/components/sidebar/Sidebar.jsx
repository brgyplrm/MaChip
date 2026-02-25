import "./sidebar.scss";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import { NavLink } from "react-router-dom";

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="top">
        <NavLink to="/" style={{ textDecoration: "none" }}>
          <span className="logo">
            <img src="/images.png" alt="Logo" className="logo-img"/>
          </span>
        </NavLink>
      </div>
      <hr />
      <div className="center">
        <ul>
          <p className="title">MAIN</p>
         <NavLink to="/" style={{ textDecoration: "none" }}>
            <li>
              <DashboardIcon className="icon" />
              <span>Dashboard</span>
            </li>
          </NavLink>
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
          <p className="title">USER</p>
           <NavLink to="/notifications" style={{ textDecoration: "none" }}>
           <li>
              <NotificationsNoneIcon className="icon" />
              <span>Notifications</span>
          </li>
          </NavLink>
          <NavLink to="/settings" style={{ textDecoration: "none" }}>
            <li>
              <SettingsApplicationsIcon className="icon" />
              <span>Settings</span>
            </li>
          </NavLink>
          <NavLink to="/profile" style={{ textDecoration: "none" }}>
          <li>
            <AccountCircleOutlinedIcon className="icon" />
            <span>Profile</span>
          </li>
          </NavLink>
          <li>
            <ExitToAppIcon className="icon" />
            <span>Logout</span>
          </li>

        </ul>
      </div>
      <div className="bottom">
        {/*<div
          className="colorOption"
          onClick={() => dispatch({ type: "LIGHT" })}
        ></div>
        <div
          className="colorOption"
          onClick={() => dispatch({ type: "DARK" })}
        ></div>*/}
      </div>
    </div>
  );
};

export default Sidebar;
