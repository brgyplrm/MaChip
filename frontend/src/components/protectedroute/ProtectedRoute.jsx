import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";
import { getStoredUser, setStoredUser, getStoredViewMode, clearStoredAuth } from "../../utils/authStorage";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const [isValidating, setIsValidating] = useState(() => !getStoredUser());
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const viewMode = getStoredViewMode("management");

  useEffect(() => {
    let isMounted = true;

    const verifyAuth = async () => {
      try {
        const response = await fetchWithAuth("/api/auth/verify");
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            if (data?.user) {
              setStoredUser(data.user);
              setCurrentUser(data.user);
            }
            setIsValidating(false);
          }
        } else {
          clearStoredAuth();
          if (isMounted) {
            setCurrentUser(null);
            setIsValidating(false);
          }
        }
      } catch (err) {
        clearStoredAuth();
        if (isMounted) {
          setCurrentUser(null);
          setIsValidating(false);
        }
      }
    };

    verifyAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // While validating session with backend, block rendering to prevent Flash of Unauthenticated Content (FOUC)
  if (isValidating) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium tracking-wide">Authenticating session...</span>
        </div>
      </div>
    );
  }

  // Strict check: must have valid authenticated user
  if (!currentUser || !currentUser.user_Id) {
    clearStoredAuth();
    return <Navigate to="/login" replace />;
  }

  const userRole = currentUser?.user_RoleId;

  // If user has no valid role assigned, send to login
  if (!userRole) {
    clearStoredAuth();
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    const hasRoleAccess = allowedRoles.includes(userRole);
    
    const isEmployeeMode = (userRole === 1 || userRole === 2 || userRole === 4) && viewMode === "employee";
    const canAccessAsEmployee = isEmployeeMode && allowedRoles.includes(3);

    if (!hasRoleAccess && !canAccessAsEmployee) {
      if (userRole === 3) {
        return <Navigate to="/profile" replace />;
      }
      
      const fallback = (userRole === 3) ? "/profile" : "/";
      if (window.location.pathname === fallback) {
         return <Navigate to="/login" replace />;
      }

      return <Navigate to={fallback} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
