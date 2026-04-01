import React from "react";
import { Link, useLocation } from "react-router-dom";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import HomeIcon from "@mui/icons-material/Home";
import "./breadcrumbs.scss";

const Breadcrumbs = () => {
  const location = useLocation();
  // Splits the URL path into segments and removes empty strings
  const pathnames = location.pathname.split("/").filter((x) => x);

  const userData = JSON.parse(localStorage.getItem("userData"));
  const isEmployee = userData?.user_RoleId === 3; // Check for Employee role
  
  const homePath = isEmployee ? "/employeeHome" : "/";
  const homeLabel = isEmployee ? "Home" : "Home";

  // Map of technical route paths to user-friendly display names
  const breadcrumbNameMap = {
    "payroll": "Payroll Management",
    "payrollDetails": "Payroll Details",
    "createPayroll": "Create Payroll",
    "editPayroll": "Edit Payroll",
    "adminReports": "Reports & Export",
    "payslip": "Employee Payslip",
    "adminRequests": "Request Management",  
    "calendar": "Calendar Management",
    "users": "User List",
    "profile": "My Profile",
    "newUser": "Add New User",
    "employeeList": "Employee List",
    "payrollPeriod": "Payroll Period",
    "employeeHome": "Dashboard",
  };

  return (
    <nav className="breadcrumbs">
      {/* Root Home Link */}
      <Link to={homePath} className="breadcrumb-link">
        <HomeIcon className="home-icon" />
        <span>{homeLabel}</span>
      </Link>

      {pathnames.map((value, index) => {
        if (isEmployee && value === "employeeHome") return null;
        const last = index === pathnames.length - 1;
        // Construct the cumulative URL for each breadcrumb segment
        const to = `/${pathnames.slice(0, index + 1).join("/")}`;
        const displayName = breadcrumbNameMap[value] || 
                            value.charAt(0).toUpperCase() + value.slice(1);

        return (
          <React.Fragment key={to}>
            <NavigateNextIcon className="separator" />
            {last ? (
              // Current page is text only (not clickable)
              <span className="breadcrumb-current">{displayName}</span>
            ) : (
              // Parent pages are clickable Links
              <Link to={to} className="breadcrumb-link">
                {displayName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;