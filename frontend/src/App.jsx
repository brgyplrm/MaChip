import Home from "./pages/home/Home";
import Login from "./pages/login/Login";
import List from "./pages/list/List";
import Single from "./pages/single/Single";
import New from "./pages/new/New";
import Edit from "./pages/edit/Edit";
import Logs from "./pages/logs-management/Logs";
import Notifications from "./pages/notifications/Notifications";
import Profile from "./pages/profile/Profile";
import Settings from "./pages/settings/Settings";
import Logout from "./pages/logout/logout";
import { Routes, Route } from "react-router-dom";
import { userInputs } from "./formSource";
import ProtectedRoute from "./components/protectedroute/ProtectedRoute";

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="login" element={<Login />} />
        
        {/* Wrap all protected routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } />

        <Route path="users">
          <Route index element={<ProtectedRoute><List /></ProtectedRoute>} />
          <Route path=":userId" element={<ProtectedRoute><Single /></ProtectedRoute>} />
          <Route path="edit/:userId" element={<ProtectedRoute><Edit inputs={userInputs} title="Edit User Profile" /></ProtectedRoute>} />
          <Route path="new" element={<ProtectedRoute><New inputs={userInputs} title="Add New User" /></ProtectedRoute>} />
        </Route>

        <Route path="logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
        <Route path="notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="logout" element={<Logout />} />
      </Routes>
    </div>
  );
}

export default App;
