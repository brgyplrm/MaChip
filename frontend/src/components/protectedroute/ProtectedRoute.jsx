import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const userDataString = localStorage.getItem("userData");
  const userData = userDataString ? JSON.parse(userDataString) : null;
  const viewMode = localStorage.getItem("viewMode") || "management";
  
  // Strict check: must have userData and a valid user_Id
  const isAuthenticated = !!(userData && userData.user_Id);

  if (!isAuthenticated) {
    // If not authenticated, clear any garbage and go to login
    localStorage.removeItem("userData");
    return <Navigate to="/login" replace />;
  }

  const userRole = userData?.user_RoleId;

  // If we have an authenticated user but they have no role assigned, send to login
  if (!userRole) {
    localStorage.removeItem("userData");
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    const hasRoleAccess = allowedRoles.includes(userRole);
    
    const isEmployeeMode = (userRole === 1 || userRole === 2) && viewMode === "employee";
    const canAccessAsEmployee = isEmployeeMode && allowedRoles.includes(3);

    if (!hasRoleAccess && !canAccessAsEmployee) {
      // If user is Employee (3) and tries to access Admin/Supervisor pages, redirect to profile
      if (userRole === 3) {
        return <Navigate to="/profile" replace />;
      }
      
      // If user is Admin/Supervisor but trying to access an Employee-only page without viewMode="employee"
      // or if they just don't have access to this specific admin page.
      // We go to employeeHome for role 3, or root for others.
      const fallback = (userRole === 3) ? "/profile" : "/";
      
      // If we are already at the fallback destination, we have a problem (access denied to home).
      // In that case, just go to login to be safe.
      if (window.location.pathname === fallback) {
         return <Navigate to="/login" replace />;
      }

      return <Navigate to={fallback} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
