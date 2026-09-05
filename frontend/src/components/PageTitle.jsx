import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const routeTitleMap = [
  { path: /^\/login\/?$/, title: "Login" },
  { path: /^\/$/, title: "Dashboard" },
  { path: /^\/employeeHome\/?$/, title: "Home" },
  { path: /^\/adminRequests\/?$/, title: "Requests Management" },
  { path: /^\/adminLoanEnrollment\/?$/, title: "Loan Enrollment & Certification" },
  { path: /^\/requestSum\/?$/, title: "Request Summary" },
  { path: /^\/adminoversight\/?$/, title: "Admin Requests Oversight" },
  { path: /^\/requests\/[^/]+$/, title: "Request Details" },
  { path: /^\/requests\/?$/, title: "My Requests" },
  { path: /^\/accessLogs\/?$/, title: "Access Logs" },
  { path: /^\/payroll\/leave-summary\/?$/, title: "Leave Summary" },
  { path: /^\/payroll\/payrollPeriod\/?$/, title: "Payroll Period" },
  { path: /^\/payroll\/employeeList\/?$/, title: "Employee List" },
  { path: /^\/payrollDetails\/[^/]+$/, title: "Payroll Details" },
  { path: /^\/payroll\/?$/, title: "Payroll Management" },
  { path: /^\/laborBenefits\/?$/, title: "Labor Benefits" },
  { path: /^\/loanmod\/?$/, title: "Loan Module" },
  { path: /^\/loanManagementHub\/?$/, title: "Loan Management Hub" },
  { path: /^\/loanManagement\/?$/, title: "Government Loans" },
  { path: /^\/loanDetails\/[^/]+$/, title: "Loan Details" },
  { path: /^\/maxicare\/history\/?$/, title: "Maxicare History" },
  { path: /^\/maxicare\/?$/, title: "HMO Management" },
  { path: /^\/eastwestloan\/history\/?$/, title: "Eastwest Loan History" },
  { path: /^\/eastwestloan\/?$/, title: "Employee Loan" },
  { path: /^\/govloans\/history\/?$/, title: "Government Loans History" },
  { path: /^\/govloans\/?$/, title: "Government Loans" },
  { path: /^\/cashadvances\/history\/?$/, title: "Cash Advances History" },
  { path: /^\/cashadvances\/?$/, title: "Cash Advances" },
  { path: /^\/thirteenth-month\/?$/, title: "13th Month Pay" },
  { path: /^\/separation-pay\/?$/, title: "Separation Pay" },
  { path: /^\/retirement-pay\/?$/, title: "Retirement Pay" },
  { path: /^\/adminReports\/payslip\/[^/]+$/, title: "Admin Payslip" },
  { path: /^\/adminReports\/?$/, title: "Reports" },
  { path: /^\/calendar\/?$/, title: "Calendar" },
  { path: /^\/employeeCalendar\/?$/, title: "Calendar" },
  { path: /^\/employee\/payslip\/[^/]+$/, title: "Payslip" },
  { path: /^\/employee\/13th-month\/[^/]+$/, title: "13th Month Details" },
  { path: /^\/employee\/payroll-details\/[^/]+$/, title: "Payroll Details" },
  { path: /^\/employee\/payroll\/?$/, title: "My Payroll" },
  { path: /^\/users\/newUser\/?$/, title: "Add New User" },
  { path: /^\/users\/hardware\/?$/, title: "Hardware Management" },
  { path: /^\/users\/archived\/?$/, title: "Archived Users" },
  { path: /^\/users\/edit\/[^/]+$/, title: "Edit User Profile" },
  { path: /^\/users\/[^/]+$/, title: "User Profile" },
  { path: /^\/users\/?$/, title: "User Management" },
  { path: /^\/visitorLogs\/?$/, title: "Visitor Logs" },
  { path: /^\/logs\/edit\/[^/]+\/[^/]+$/, title: "Edit Attendance Log" },
  { path: /^\/logs\/?$/, title: "Attendance Logs" },
  { path: /^\/settings\/?$/, title: "System Settings" },
  { path: /^\/transactionLog\/?$/, title: "Transaction Log" },
  { path: /^\/auditLogs\/?$/, title: "Audit Log" },
  { path: /^\/notifications\/?$/, title: "Notifications" },
  { path: /^\/profile\/?$/, title: "My Profile" },
  { path: /^\/faq\/?$/, title: "Help & Support" },
  { path: /^\/transitions\/?$/, title: "Transition Playground" },
];

function getTitleFromPathname(pathname) {
  const matchedRoute = routeTitleMap.find((route) => route.path.test(pathname));
  if (matchedRoute) {
    return matchedRoute.title;
  }

  // Fallback title formatter for unmapped routes
  const cleanPath = pathname.split("/").filter(Boolean).pop();
  if (!cleanPath) return "Dashboard";

  return cleanPath
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function PageTitle() {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = getTitleFromPathname(location.pathname);
    document.title = `MAChip | ${pageTitle}`;
  }, [location.pathname]);

  return null;
}
