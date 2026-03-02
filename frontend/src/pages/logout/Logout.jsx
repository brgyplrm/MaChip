import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const performLogout = async () => {
      try {
        // 1. Optional: Tell your backend (Express/Flask) to end the session
        // Based on your port 4000 setup
        await fetch("http://localhost:4000/api/users/logout", {
          method: "POST",
        });

        // 2. Clear local storage/Session storage
        localStorage.removeItem("token");
        localStorage.removeItem("userData");

        // 3. Redirect back to the login page you just created
        navigate("/login");
      } catch (err) {
        console.error("Logout failed:", err);
        // Fallback: clear local data anyway
        localStorage.clear();
        navigate("/login");
      }
    };

    performLogout();
  }, [navigate]);

  return (
    <div className="logout-loading">
      <p>Logging out, please wait...</p>
    </div>
  );
};

export default Logout;
