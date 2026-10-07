import React from "react";
import { Link, useLocation } from "react-router-dom";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import HomeIcon from "@mui/icons-material/Home";

const Breadcrumbs = () => {
  const location = useLocation();
  // Splits the URL path into segments and removes empty strings
  const pathnames = location.pathname.split("/").filter((x) => x);

  const userData = JSON.parse(localStorage.getItem("userData"));
  const viewMode = localStorage.getItem("viewMode") || "management";
  const roleId = userData?.user_RoleId;
  const isManagement = (roleId === 1 || roleId === 4) && viewMode === "management";
  const isSupervisor = (roleId === 2) && viewMode === "management";
  
  const homePath = isManagement || isSupervisor ? "/" : "/employeeHome";
  const homeLabel = "Home";

  const getBreadcrumbs = () => {
    if (location.pathname === "/" || location.pathname === "/employeeHome") {
      return [{ label: homeLabel, path: null }];
    }

    const items = [{ label: homeLabel, path: homePath }];

    // Employee Payroll sub-routes
    if (location.pathname === "/employee/payroll") {
      items.push({ label: "My Payroll", path: null });
      return items;
    }
    if (location.pathname.startsWith("/employee/payslip/")) {
      items.push({ label: "My Payroll", path: "/employee/payroll" });
      items.push({ label: "Payslip Details", path: null });
      return items;
    }
    if (location.pathname.startsWith("/employee/payroll-details/")) {
      items.push({ label: "My Payroll", path: "/employee/payroll" });
      items.push({ label: "Computation Details", path: null });
      return items;
    }
    if (location.pathname.startsWith("/employee/13th-month/")) {
      items.push({ label: "My Payroll", path: "/employee/payroll" });
      items.push({ label: "13th Month Details", path: null });
      return items;
    }

    // Users sub-routes
    if (location.pathname === "/users") {
      items.push({ label: "User List", path: null });
      return items;
    }
    if (location.pathname === "/users/newUser") {
      items.push({ label: "Users", path: "/users" });
      items.push({ label: "Add New User", path: null });
      return items;
    }
    if (location.pathname === "/users/archived") {
      items.push({ label: "Users", path: "/users" });
      items.push({ label: "Archived Users", path: null });
      return items;
    }
    if (location.pathname === "/users/hardware") {
      items.push({ label: "Users", path: "/users" });
      items.push({ label: "Hardware Registry", path: null });
      return items;
    }
    if (location.pathname.startsWith("/users/edit/")) {
      items.push({ label: "Users", path: "/users" });
      items.push({ label: "Edit User Profile", path: null });
      return items;
    }
    if (location.pathname.startsWith("/users/")) {
      items.push({ label: "Users", path: "/users" });
      items.push({ label: "User Profile", path: null });
      return items;
    }

    // Admin Payroll sub-routes
    if (location.pathname === "/payroll") {
      items.push({ label: "Payroll Management", path: null });
      return items;
    }
    if (location.pathname.startsWith("/payrollDetails/")) {
      items.push({ label: "Payroll Management", path: "/payroll" });
      items.push({ label: "Payroll Details", path: null });
      return items;
    }
    if (location.pathname === "/payroll/payrollPeriod") {
      items.push({ label: "Payroll Management", path: "/payroll" });
      items.push({ label: "Payroll Period", path: null });
      return items;
    }
    if (location.pathname === "/payroll/employeeList") {
      items.push({ label: "Payroll Management", path: "/payroll" });
      items.push({ label: "Employee List", path: null });
      return items;
    }
    if (location.pathname === "/payroll/leave-summary") {
      items.push({ label: "Payroll Management", path: "/payroll" });
      items.push({ label: "Leave Summary", path: null });
      return items;
    }

    // Labor Benefits
    if (location.pathname === "/laborBenefits") {
      items.push({ label: "Labor Benefits", path: null });
      return items;
    }
    if (location.pathname === "/thirteenth-month") {
      items.push({ label: "Labor Benefits", path: "/laborBenefits" });
      items.push({ label: "13th Month Pay", path: null });
      return items;
    }
    if (location.pathname === "/separation-pay") {
      items.push({ label: "Labor Benefits", path: "/laborBenefits" });
      items.push({ label: "Separation Pay", path: null });
      return items;
    }
    if (location.pathname === "/retirement-pay") {
      items.push({ label: "Labor Benefits", path: "/laborBenefits" });
      items.push({ label: "Retirement Pay", path: null });
      return items;
    }

    // Loans
    if (location.pathname === "/loanManagement" || location.pathname === "/loanmod" || location.pathname === "/loanManagementHub" || location.pathname === "/govloans") {
      items.push({ label: "Government Loans", path: null });
      return items;
    }
    if (location.pathname.startsWith("/loanDetails/")) {
      items.push({ label: "Government Loans", path: "/loanManagement" });
      items.push({ label: "Loan Details", path: null });
      return items;
    }
    if (location.pathname.startsWith("/govloans/history")) {
      items.push({ label: "Government Loans", path: "/loanManagement" });
      items.push({ label: "Loan History", path: null });
      return items;
    }
    if (location.pathname === "/eastwestloan") {
      items.push({ label: "Employee Loans", path: null });
      return items;
    }
    if (location.pathname.startsWith("/eastwestloan/history")) {
      items.push({ label: "Employee Loans", path: "/eastwestloan" });
      items.push({ label: "Loan History", path: null });
      return items;
    }
    if (location.pathname === "/cashadvances") {
      items.push({ label: "Cash Advances", path: null });
      return items;
    }
    if (location.pathname.startsWith("/cashadvances/history")) {
      items.push({ label: "Cash Advances", path: "/cashadvances" });
      items.push({ label: "Cash Advance History", path: null });
      return items;
    }
    if (location.pathname === "/maxicare") {
      items.push({ label: "HMOs", path: null });
      return items;
    }
    if (location.pathname.startsWith("/maxicare/history")) {
      items.push({ label: "HMOs", path: "/maxicare" });
      items.push({ label: "HMO History", path: null });
      return items;
    }

    // Reports
    if (location.pathname === "/adminReports") {
      items.push({ label: "Admin Reports", path: null });
      return items;
    }
    if (location.pathname.startsWith("/adminReports/payslip/")) {
      items.push({ label: "Admin Reports", path: "/adminReports" });
      items.push({ label: "Payslip Details", path: null });
      return items;
    }

    // Access Logs
    if (location.pathname === "/logs" || location.pathname === "/accessLogs") {
      items.push({ label: "Access Logs", path: null });
      return items;
    }
    if (location.pathname === "/visitorLogs") {
      items.push({ label: "Visitor Access", path: null });
      return items;
    }
    if (location.pathname.startsWith("/logs/edit/")) {
      items.push({ label: "Access Logs", path: "/logs" });
      items.push({ label: "Edit Attendance", path: null });
      return items;
    }

    // Requests
    if (location.pathname === "/adminRequests") {
      items.push({ label: "Requests", path: null });
      return items;
    }
    if (location.pathname === "/adminoversight") {
      items.push({ label: "Requests Oversight", path: null });
      return items;
    }
    if (location.pathname === "/adminLoanEnrollment") {
      items.push({ label: "Loan Enrollment", path: null });
      return items;
    }
    if (location.pathname === "/requestSum") {
      items.push({ label: "Request Summary", path: null });
      return items;
    }
    if (location.pathname === "/requests" || location.pathname === "/userRequests") {
      items.push({ label: "My Requests", path: null });
      return items;
    }
    if (location.pathname.startsWith("/requests/")) {
      items.push({ label: "My Requests", path: "/requests" });
      items.push({ label: "Request Details", path: null });
      return items;
    }

    // Calendar
    if (location.pathname === "/calendar" || location.pathname === "/employeeCalendar") {
      items.push({ label: "Calendar", path: null });
      return items;
    }

    // Settings / Misc
    if (location.pathname === "/settings") {
      items.push({ label: "Configurations", path: null });
      return items;
    }
    if (location.pathname === "/auditLogs") {
      items.push({ label: "Audit Logs", path: null });
      return items;
    }
    if (location.pathname === "/transactionLog") {
      items.push({ label: "Transaction Logs", path: null });
      return items;
    }
    if (location.pathname === "/faq") {
      items.push({ label: "Help & Support", path: null });
      return items;
    }
    if (location.pathname === "/profile") {
      items.push({ label: "My Profile", path: null });
      return items;
    }
    if (location.pathname === "/notifications") {
      items.push({ label: "Notifications", path: null });
      return items;
    }
    if (location.pathname === "/transitions") {
      items.push({ label: "UI Animations Lab", path: null });
      return items;
    }

    // Generic fallback for any other single-level paths
    const segments = location.pathname.split("/").filter(Boolean);
    segments.forEach((seg, idx) => {
      const isLast = idx === segments.length - 1;
      items.push({
        label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
        path: isLast ? null : `/${segments.slice(0, idx + 1).join("/")}`
      });
    });

    return items;
  };

  const breadcrumbsList = getBreadcrumbs();

  return (
    <nav className="flex items-center py-2.5 gap-2 font-['Nunito',_sans-serif]">
      {breadcrumbsList.map((item, index) => {
        const isLast = index === breadcrumbsList.length - 1;
        return (
          <React.Fragment key={index}>
            {index > 0 && <NavigateNextIcon className="text-[#ccc] !text-[18px]" />}
            {isLast || !item.path ? (
              <span className="text-brand-primary font-bold text-xs md:text-sm">
                {index === 0 ? (
                  <span className="flex items-center gap-1.5">
                    <HomeIcon className="!text-[15px] md:!text-[18px]" />
                    <span>{item.label}</span>
                  </span>
                ) : (
                  item.label
                )}
              </span>
            ) : (
              <Link 
                to={item.path} 
                className="flex items-center gap-1.5 text-[#888] text-xs md:text-sm transition-all duration-200 ease-in hover:text-brand-primary hover:underline"
              >
                {index === 0 && <HomeIcon className="!text-[15px] md:!text-[18px]" />}
                <span>{item.label}</span>
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;