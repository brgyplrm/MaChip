import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const isAuthenticated = localStorage.getItem("token");
  const userDataString = localStorage.getItem("userData");
  const userData = userDataString ? JSON.parse(userDataString) : null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && userData && !allowedRoles.includes(userData.user_RoleId)) {
    // If user is Employee (3) and tries to access Admin/Staff pages, redirect to profile
    if (userData.user_RoleId === 3) {
      return <Navigate to="/profile" replace />;
    }
    // Otherwise (or if Staff tries to access something restricted), go to home or profile
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
