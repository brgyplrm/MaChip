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
import CreatePayroll from "./pages/admin_Payroll/create_Payroll";
import PayrollDetails from "./pages/admin_Payroll/details_Payroll";
import EditPayroll from "./pages/admin_Payroll/edit_Payroll";
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

        <Route path="/requests">
        <Route index element={<UserRequests />} /> {/* Your list page */}
        <Route path=":requestId" element={<RequestDetails />} /> {/* The dynamic details page */}
        </Route>

        <Route
          path="/payroll"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <Payroll />
            </ProtectedRoute>
          }
        />

        <Route
          path="/createPayroll"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <CreatePayroll />
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
          path="/editPayroll/:payrollId"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <EditPayroll />
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
          element={<Payslip />} />

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
