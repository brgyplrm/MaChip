import Home from "./pages/admin/Home";
import EmployeeHome from "./pages/employeeHome/EmployeeHome";
import UserRequests from "./pages/userRequests/UserRequests"; 
import Login from "./pages/login/Login";
import List from "./pages/list/List";
import Single from "./pages/single/Single";
import New from "./pages/new/New";
import Edit from "./pages/editUser/Edit";
import EditAttendance from "./pages/editAttendance/EditAttendance";
import Logs from "./pages/logs-management/Logs";
import AdminRequests from "./pages/admin_Requests/AdminRequests";
import RequestSummary from "./pages/admin_Requests/RequestSummary";
import RequestDetails from "./pages/request_Details/RequestDetails";
import Payroll from "./pages/admin_Payroll/PayrollManagement";
import PayrollPeriod from "./pages/admin_Payroll/PayrollPeriod";
import PayrollDetails from "./pages/admin_Payroll/DetailsPayroll";
import PayrollList from "./pages/admin_Payroll/PayrollEmployeeList";
import Maxicare from "./pages/admin_Payroll/subtabs/Maxicare";
import MaxicareHistory from "./pages/admin_Payroll/subtabs/MaxicareHistory";
import EastwestLoan from "./pages/admin_Payroll/subtabs/EastwestLoan";
import EastwestLoanHistory from "./pages/admin_Payroll/subtabs/EastwestLoanHistory";
import GovLoans from "./pages/admin_Payroll/subtabs/GovLoans";
import GovLoansHistory from "./pages/admin_Payroll/subtabs/GovLoansHistory";
import Cashadvances from "./pages/admin_Payroll/subtabs/Cashadvances";
import CashAdvancesHistory from "./pages/admin_Payroll/subtabs/CashAdvanceHistory";
import LoanModule from "./pages/admin_Payroll/subtabs/LoanModule";
import LeaveSummary from "./pages/admin_Payroll/subtabs/LeaveSummary";
import EmployeeCalendar from "./pages/emp_Calendar/EmployeeCalendar"; 
import Notifications from "./pages/notifications/Notifications";
import Profile from "./pages/profile/Profile";
import Settings from "./pages/settings/Settings";
import { Routes, Route, Navigate } from "react-router-dom";
import { userInputs } from "./utils/formSource";
import ProtectedRoute from "./components/protectedroute/ProtectedRoute";
import CalendarRedirect from "./components/calendarredirect/CalendarRedirect";
import AdminReports from "./pages/admin_reports/AdminReports";
import Payslip from "./pages/admin_reports/Payslip";
import UserLogs from "./pages/emp_UserLogs/UserLogs";
import TransactionLog from "./components/transactionLog/TransactionLog";
import AuditLog from "./components/auditLog/AuditLog";
import ArchivedUsers from "./pages/archivedUsers/ArchivedUsers";
import AdminRequestsOversight from "./pages/AdminRequestsOversight";
import RequestsHistory from "./pages/RequestsHistory";
import FAQ from "./components/FAQ";

function App() {

  return (
    <div className="app w-full">
      <Routes>
        <Route path="/login" element={<Login />} />

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
          path="/requestsHistory"
          element={
            <ProtectedRoute allowedRoles={[4]}>
              <RequestsHistory />
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
          path="logs/edit/:userId/:date"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 4]}>
              <EditAttendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 4]}>
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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}

export default App;
