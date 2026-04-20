import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const userDataString = localStorage.getItem("userData");
  const userData = userDataString ? JSON.parse(userDataString) : null;
  const viewMode = localStorage.getItem("viewMode") || "management";
  const isAuthenticated = !!userData;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Determine effective role based on viewMode
  // If we are in employee mode, we treat the user as if they have role 3 for route access purposes,
  // BUT we must allow them to actually be an Admin/Supervisor.
  
  const userRole = userData?.user_RoleId;

  if (allowedRoles && userData) {
    const hasRoleAccess = allowedRoles.includes(userRole);
    
    // Special case: If Admin/Supervisor is in "employee" mode, they should be allowed 
    // to access "Employee (3)" restricted pages.
    const isEmployeeMode = (userRole === 1 || userRole === 2) && viewMode === "employee";
    const canAccessAsEmployee = isEmployeeMode && allowedRoles.includes(3);

    if (!hasRoleAccess && !canAccessAsEmployee) {
      // If user is Employee (3) and tries to access Admin/Staff pages, redirect to profile
      if (userRole === 3) {
        return <Navigate to="/profile" replace />;
      }
      // Otherwise, go to home
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
