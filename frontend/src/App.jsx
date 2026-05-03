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
import RequestDetails from "./pages/request_Details/RequestDetails";
import Payroll from "./pages/admin_Payroll/PayrollManagement";
import PayrollPeriod from "./pages/admin_Payroll/PayrollPeriod";
import PayrollDetails from "./pages/admin_Payroll/DetailsPayroll";
import PayrollList from "./pages/admin_Payroll/PayrollEmployeeList";
import Maxicare from "./pages/admin_Payroll/subtabs/Maxicare";
import EastwestLoan from "./pages/admin_Payroll/subtabs/EastwestLoan";
import GovLoans from "./pages/admin_Payroll/subtabs/GovLoans";
import Cashadvances from "./pages/admin_Payroll/subtabs/Cashadvances";
import LoanModule from "./pages/admin_Payroll/subtabs/LoanModule";
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

function App() {
  return (
    <div className="app w-full">
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/employeeHome"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3]}>
              <EmployeeHome/>
            </ProtectedRoute>
          }
        />

        <Route
          path="/adminRequests"
          element={
            <ProtectedRoute allowedRoles={[1, 2]}>
              <AdminRequests />
            </ProtectedRoute>
          }
        />

        <Route
          path="/requests"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3]}>
              <UserRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accessLogs"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3]}>
              <UserLogs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/requests/:requestId"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3]}>
              <RequestDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <Payroll />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll/maxicare"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <Maxicare />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll/eastwest"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <EastwestLoan />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll/gov-loans"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <GovLoans />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll/cash-advance"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <Cashadvances />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll/payrollPeriod"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <PayrollPeriod />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll/employeeList"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <PayrollList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payrollDetails/:payrollId"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <PayrollDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/adminReports"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <AdminReports />
            </ProtectedRoute>
          }
        />

        <Route 
          path="/adminReports/payslip/:id" 
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <Payslip />
            </ProtectedRoute>
          } 
        />

        <Route
          path="/calendar"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3]}>
              <CalendarRedirect />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employeeCalendar"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3]}>
              <EmployeeCalendar />
            </ProtectedRoute>
          }
        />

        {/* Wrap all protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={[1, 2]}>
              <Home />
            </ProtectedRoute>
          }
        />

        {/* Users Management: Admin (1) & Supervisor (2) */}
        <Route path="users">
          <Route
            index
            element={
              <ProtectedRoute allowedRoles={[1, 2]}>
                <List />
              </ProtectedRoute>
            }
          />
          <Route
            path=":userId"
            element={
              <ProtectedRoute allowedRoles={[1, 2]}>
                <Single />
              </ProtectedRoute>
            }
          />
          <Route
            path="edit/:userId"
            element={
              <ProtectedRoute allowedRoles={[1, 2, 3]}>
                <Edit inputs={userInputs} title="Edit User Profile" />
              </ProtectedRoute>
            }
          />
          <Route
            path="newUser"
            element={
              <ProtectedRoute allowedRoles={[1, 2]}>
                <New inputs={userInputs} title="Add New User" />
              </ProtectedRoute>
            }
          />
          <Route
            path="archived"
            element={
              <ProtectedRoute allowedRoles={[1, 2]}>
                <ArchivedUsers />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Logs & Settings: Admin (1) & Supervisor (2) */}
        <Route
          path="logs"
          element={
            <ProtectedRoute allowedRoles={[1, 2]}>
              <Logs />
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
            <ProtectedRoute allowedRoles={[1, 2]}>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route
          path="transactionLog"
          element={
            <ProtectedRoute allowedRoles={[1, 2]}>
              <TransactionLog />
            </ProtectedRoute>
          }
        />

        <Route
          path="auditLogs"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <AuditLog />
            </ProtectedRoute>
          }
        />

        {/* Profile & Notifications: All Roles (1, 2, 3) */}
        <Route
          path="notifications"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3]}>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3]}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}

export default App;
