import { useState, useEffect, lazy, Suspense } from "react";
import Login from "./pages/login/Login";
import ResetPassword from "./pages/resetPassword/ResetPassword";
import { Routes, Route, Navigate } from "react-router-dom";
import { userInputs } from "./utils/formSource";
import ProtectedRoute from "./components/protectedroute/ProtectedRoute";
import CalendarRedirect from "./components/calendarredirect/CalendarRedirect";
import PageTitle from "./components/PageTitle";
import InactivityHandler from "./components/InactivityHandler";
import ScrollToTop from "./components/common/ScrollToTop";
import { getStoredUser, setStoredUser } from "./utils/authStorage";
import FirstLoginModal from "./components/auth/FirstLoginModal";

// Lazy-loaded route chunks to eliminate monolithic bundle lag
const Home = lazy(() => import("./pages/admin/Home"));
const EmployeeHome = lazy(() => import("./pages/employeeHome/EmployeeHome"));
const UserRequests = lazy(() => import("./pages/userRequests/UserRequests")); 
const List = lazy(() => import("./pages/list/List"));
const Single = lazy(() => import("./pages/single/Single"));
const New = lazy(() => import("./pages/new/New"));
const HardwareManagement = lazy(() => import("./pages/new/HardwareManagement"));
const Edit = lazy(() => import("./pages/editUser/Edit"));
const EditAttendance = lazy(() => import("./pages/editAttendance/EditAttendance"));
const Logs = lazy(() => import("./pages/logs-management/Logs"));
const VisitorLogs = lazy(() => import("./pages/logs-management/VisitorLogs"));
const AdminRequests = lazy(() => import("./pages/admin_Requests/AdminRequests"));
const AdminLoanEnrollment = lazy(() => import("./pages/admin_Requests/AdminLoanEnrollment"));
const RequestSummary = lazy(() => import("./pages/admin_Requests/RequestSummary"));
const RequestDetails = lazy(() => import("./pages/request_Details/RequestDetails"));
const Payroll = lazy(() => import("./pages/admin_Payroll/PayrollManagement"));
const PayrollPeriod = lazy(() => import("./pages/admin_Payroll/PayrollPeriod"));
const PayrollDetails = lazy(() => import("./pages/admin_Payroll/DetailsPayroll"));
const PayrollList = lazy(() => import("./pages/admin_Payroll/PayrollEmployeeList"));
const Maxicare = lazy(() => import("./pages/admin_Payroll/subtabs/Maxicare"));
const MaxicareHistory = lazy(() => import("./pages/admin_Payroll/subtabs/MaxicareHistory"));
const EastwestLoan = lazy(() => import("./pages/admin_Payroll/subtabs/EastwestLoan"));
const EastwestLoanHistory = lazy(() => import("./pages/admin_Payroll/subtabs/EastwestLoanHistory"));
const GovLoans = lazy(() => import("./pages/admin_Payroll/subtabs/GovLoans"));
const GovLoansHistory = lazy(() => import("./pages/admin_Payroll/subtabs/GovLoansHistory"));
const Cashadvances = lazy(() => import("./pages/admin_Payroll/subtabs/Cashadvances"));
const CashAdvancesHistory = lazy(() => import("./pages/admin_Payroll/subtabs/CashAdvanceHistory"));
const LoanModule = lazy(() => import("./pages/admin_Payroll/subtabs/LoanModule"));
const LeaveSummary = lazy(() => import("./pages/admin_Payroll/subtabs/LeaveSummary"));
const EmployeeCalendar = lazy(() => import("./pages/emp_Calendar/EmployeeCalendar")); 
const EmployeePayslip = lazy(() => import("./pages/emp_payroll/EmployeePayslip"));
const EmployeePayrollHistory = lazy(() => import("./pages/emp_payroll/EmployeePayrollHistory"));
const ThirteenthMonthDetails = lazy(() => import("./pages/emp_payroll/ThirteenthMonthDetails"));
const PayrollComputationDetails = lazy(() => import("./pages/emp_payroll/PayrollComputationDetails"));
const EmployeeLoans = lazy(() => import("./pages/emp_loans/EmployeeLoans"));
const Notifications = lazy(() => import("./pages/notifications/Notifications"));
const Profile = lazy(() => import("./pages/profile/Profile"));
const Settings = lazy(() => import("./pages/settings/Settings"));
const AdminReports = lazy(() => import("./pages/admin_reports/AdminReports"));
const Payslip = lazy(() => import("./pages/admin_reports/Payslip"));
const UserLogs = lazy(() => import("./pages/emp_UserLogs/UserLogs"));
const TransactionLog = lazy(() => import("./components/transactionLog/TransactionLog"));
const AuditLog = lazy(() => import("./components/auditLog/AuditLog"));
const ArchivedUsers = lazy(() => import("./pages/archivedUsers/ArchivedUsers"));
const AdminRequestsOversight = lazy(() => import("./pages/AdminRequestsOversight"));
const FAQ = lazy(() => import("./components/FAQ"));
const LoanManagement = lazy(() => import("./pages/admin_Payroll/subtabs/LoanManagement"));
const TransitionPlayground = lazy(() => import("./pages/admin/TransitionPlayground"));
const LoanManagementHub = lazy(() => import("./pages/admin_Payroll/subtabs/LoanManagementHub"));
const LoanDetails = lazy(() => import("./pages/admin_Payroll/subtabs/LoanDetails"));
const LoanDetailsPage = lazy(() => import("./components/LoanDetailsPage"));
const ThirteenthMonth = lazy(() => import("./pages/admin_Payroll/subtabs/ThirteenthMonth"));
const SeparationPay = lazy(() => import("./pages/admin_Payroll/subtabs/SeparationPay"));
const RetirementPay = lazy(() => import("./pages/admin_Payroll/subtabs/RetirementPay"));
const LaborBenefits = lazy(() => import("./pages/admin_Payroll/LaborBenefits"));

function App() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());

  useEffect(() => {
    const handleUserUpdate = () => {
      setCurrentUser(getStoredUser());
    };
    window.addEventListener("userUpdate", handleUserUpdate);
    window.addEventListener("storage", handleUserUpdate);
    return () => {
      window.removeEventListener("userUpdate", handleUserUpdate);
      window.removeEventListener("storage", handleUserUpdate);
    };
  }, []);

  return (
    <div className="app w-full min-h-screen bg-slate-50 text-slate-900">
      <PageTitle />
      <InactivityHandler />
      <ScrollToTop />
      {currentUser?.is_first_login && (
        <FirstLoginModal
          currentUser={currentUser}
          onPasswordChanged={(updated) => {
            setStoredUser(updated);
            setCurrentUser(updated);
          }}
        />
      )}
      <Suspense fallback={<div className="w-full min-h-screen bg-slate-50" />}>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/employeeHome"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <EmployeeHome/>
            </ProtectedRoute>
          }
        />

        <Route
          path="/adminRequests"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 4]}>
              <AdminRequests />
            </ProtectedRoute>
          }
        />

        <Route
          path="/adminLoanEnrollment"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 4]}>
              <AdminLoanEnrollment />
            </ProtectedRoute>
          }
        />

        <Route
          path="/requestSum"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 4]}>
              <RequestSummary />
            </ProtectedRoute>
          }
        />

        <Route
          path="/adminoversight"
          element={
            <ProtectedRoute allowedRoles={[4]}>
              <AdminRequestsOversight />
            </ProtectedRoute>
          }
        />

        <Route
          path="/requests"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <UserRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accessLogs"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <UserLogs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/requests/:requestId"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <RequestDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <Payroll />
            </ProtectedRoute>
          }
        />

         <Route
          path="/laborBenefits"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <LaborBenefits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loanmod"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <LoanModule />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/loanManagement" 
          element={<ProtectedRoute allowedRoles={[1, 4]}><LoanManagement /></ProtectedRoute>} />
        <Route 
          path="/loanDetails/:id" 
          element={<ProtectedRoute allowedRoles={[1, 4]}><LoanDetails /></ProtectedRoute>} />

        <Route
          path="/loanManagementHub"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <LoanManagementHub />
            </ProtectedRoute>
          }
        />

        <Route
          path="/loanManagement"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <LoanManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/maxicare"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <Maxicare />
            </ProtectedRoute>
          }
        />

        <Route
          path="/maxicare/history"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <MaxicareHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/eastwestloan"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <EastwestLoan />
            </ProtectedRoute>
          }
        />

        <Route
          path="/eastwestloan/history"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <EastwestLoanHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/govloans"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <GovLoans />
            </ProtectedRoute>
          }
        />

        <Route
          path="/govloans/history"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <GovLoansHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cashadvances"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <Cashadvances />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cashadvances/history"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <CashAdvancesHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll/leave-summary"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <LeaveSummary />
            </ProtectedRoute>
          }
        />

        <Route
          path="/thirteenth-month"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <ThirteenthMonth />
            </ProtectedRoute>
          }
        />

        <Route
          path="/separation-pay"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <SeparationPay />
            </ProtectedRoute>
          }
        />

        <Route
          path="/retirement-pay"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <RetirementPay />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll/payrollPeriod"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <PayrollPeriod />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll/employeeList"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <PayrollList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payrollDetails/:payrollId"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <PayrollDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/adminReports"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <AdminReports />
            </ProtectedRoute>
          }
        />

        <Route 
          path="/adminReports/payslip/:id" 
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <Payslip />
            </ProtectedRoute>
          } 
        />

        <Route
          path="/calendar"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <CalendarRedirect />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employeeCalendar"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <EmployeeCalendar />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee"
          element={<Navigate to="/employee/payroll" replace />}
        />

        <Route
          path="/employee/payroll"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <EmployeePayrollHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/payslip/:id"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <EmployeePayslip />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/13th-month/:year"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <ThirteenthMonthDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/payroll-details/:id"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <PayrollComputationDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/loans"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <EmployeeLoans />
            </ProtectedRoute>
          }
        />

        {/* Wrap all protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 4]}>
              <Home />
            </ProtectedRoute>
          }
        />

        {/* Users Management: Admin (1) & Supervisor (2) & Accountant (4) */}
        <Route path="users">
          <Route
            index
            element={
              <ProtectedRoute allowedRoles={[1, 2, 4]}>
                <List />
              </ProtectedRoute>
            }
          />
          <Route
            path=":userId"
            element={
              <ProtectedRoute allowedRoles={[1, 2, 4]}>
                <Single />
              </ProtectedRoute>
            }
          />
          <Route
            path="edit/:userId"
            element={
              <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
                <Edit inputs={userInputs} title="Edit User Profile" />
              </ProtectedRoute>
            }
          />
          <Route
            path="newUser"
            element={
              <ProtectedRoute allowedRoles={[1, 2, 4]}>
                <New inputs={userInputs} title="Add New User" />
              </ProtectedRoute>
            }
          />
          <Route
            path="hardware"
            element={
              <ProtectedRoute allowedRoles={[1, 2, 4]}>
                <HardwareManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="archived"
            element={
              <ProtectedRoute allowedRoles={[1, 2, 4]}>
                <ArchivedUsers />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Logs & Settings: Admin (1) & Supervisor (2) & Accountant (4) */}
        <Route
          path="logs"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 4]}>
              <Logs />
            </ProtectedRoute>
          }
        />
        <Route
          path="visitorLogs"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 4]}>
              <VisitorLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="logs/edit/:userId/:date"
          element={
            <ProtectedRoute allowedRoles={[1, 2]}>
              <EditAttendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route
          path="transactionLog"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <TransactionLog />
            </ProtectedRoute>
          }
        />

        <Route
          path="auditLogs"
          element={
            <ProtectedRoute allowedRoles={[1, 4]}>
              <AuditLog />
            </ProtectedRoute>
          }
        />

        {/* Profile & Notifications: All Roles (1, 2, 3, 4) */}
        <Route
          path="notifications"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="faq"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <FAQ />
            </ProtectedRoute>
          }
        />
        <Route
          path="transitions"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <TransitionPlayground />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
    </div>
  );
}

export default App;
