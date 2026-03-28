import Home from "./pages/home/Home";
import EmployeeHome from "./pages/employeeHome/EmployeeHome";
import UserRequests from "./pages/userRequests/UserRequests"; 
import Login from "./pages/login/Login";
import List from "./pages/list/List";
import Single from "./pages/single/Single";
import New from "./pages/new/New";
import Edit from "./pages/editUser/Edit";
import Logs from "./pages/logs-management/Logs";
import AdminRequests from "./pages/admin_Requests/adminRequests";
import RequestDetails from "./pages/request_Details/requestDetails";
import Payroll from "./pages/admin_Payroll/payroll_Management";
import PayrollPeriod from "./pages/admin_Payroll/payroll_Period";
import PayrollDetails from "./pages/admin_Payroll/details_Payroll";
import PayrollList from "./pages/admin_Payroll/payroll_EmployeeList";
import EmployeeCalendar from "./pages/emp_Calendar/employeeCalendar"; 
import Notifications from "./pages/notifications/Notifications";
import Profile from "./pages/profile/Profile";
import Settings from "./pages/settings/Settings";
import Logout from "./pages/logout/Logout";
import { Routes, Route } from "react-router-dom";
import { userInputs } from "./formSource";
import ProtectedRoute from "./components/protectedroute/ProtectedRoute";
import CalendarRedirect from "./components/CalendarRedirect";
import AdminReports from "./pages/admin_reports/adminReports";
import Payslip from "./pages/admin_reports/payslip";

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/employeeHome"
          element={
            <ProtectedRoute allowedRoles={[3]}>
              <EmployeeHome/>
            </ProtectedRoute>
          }
        />

        <Route
          path="/adminRequests"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <AdminRequests />
            </ProtectedRoute>
          }
        />

        <Route
          path="/requests"
          element={
            <ProtectedRoute allowedRoles={[3]}>
              <UserRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/:requestId"
          element={
            <ProtectedRoute allowedRoles={[1, 3]}>
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
          path="/payrollPeriod"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <PayrollPeriod />
            </ProtectedRoute>
          }
        />


        <Route
          path="/payrollList"
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
            <ProtectedRoute allowedRoles={[1, 3]}>
              <CalendarRedirect />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employeeCalendar"
          element={
            <ProtectedRoute allowedRoles={[3]}>
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

        {/* Users Management: Admin (1) & Staff (2) */}
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
              <ProtectedRoute allowedRoles={[1, 2]}>
                <Edit inputs={userInputs} title="Edit User Profile" />
              </ProtectedRoute>
            }
          />
          <Route
            path="new"
            element={
              <ProtectedRoute allowedRoles={[1, 2]}>
                <New inputs={userInputs} title="Add New User" />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Logs & Settings: Admin (1) & Staff (2) */}
        <Route
          path="logs"
          element={
            <ProtectedRoute allowedRoles={[1, 2]}>
              <Logs />
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
        <Route path="logout" element={<Logout />} />
      </Routes>
    </div>
  );
}

export default App;
