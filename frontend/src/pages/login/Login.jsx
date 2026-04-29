import "./login.scss";
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import { Link } from "react-router-dom";
import ForgotPasswordModal from "../../components/forgotPassword/ForgotPasswordModal";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Accepts "MACJ-001", "MACJ-1", "macj-001" — returns the numeric part as an
// integer (e.g. 1), or NaN if the format doesn't match.
const parseMacjId = (value) => {
  const match = value.trim().match(/^MACJ-(\d+)$/i);
  if (!match) return NaN;
  return parseInt(match[1], 10);
};

const validateForm = ({ rawId, password }) => {
  const errors = {};

  if (!rawId.trim()) {
    errors.user_Id = "User ID is required.";
  } 

  if (!password) {
    errors.password = "Password is required.";
  }

  return errors;
};

// ─────────────────────────────────────────────────────────────────────────────

const Login = () => {
  const [rawId, setRawId] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const navigate = useNavigate();

  // ── Redirect if already logged in ──────────────────────────────────────────
  useEffect(() => {
    const userDataString = localStorage.getItem("userData");
    if (userDataString) {
      try {
        const userData = JSON.parse(userDataString);
        if (userData && userData.user_Id) {
          if (userData.user_RoleId === 3) {
            navigate("/employeeHome", { replace: true });
          } else {
            navigate("/", { replace: true });
          }
        }
      } catch (e) {
        localStorage.removeItem("userData");
      }
    }
  }, [navigate]);

  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: "" }));

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
  );

  const handleLogin = async (e) => {
    e.preventDefault();

    // 1. Client-side validation
    const validationErrors = validateForm({ rawId, password });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setToast({
        message: "Please fix the errors before submitting.",
        type: "error",
      });
      return;
    }

    setLoading(true);

    // 3. Submit to auth route
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_Id: rawId.trim(), password }),
        credentials: "include", // Allow server to set HttpOnly cookie
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        // 4. Persist only non-sensitive user data
        localStorage.setItem("userData", JSON.stringify(data.data));

        setToast({
          message: "Login successful! Redirecting…",
          type: "success",
        });

        // 5. Redirect based on role
        setTimeout(() => {
          if (data.data.user_RoleId === 3) {
            // Employee role
            navigate("/employeeHome");
          } else {
            // Admin (1) or Staff (2)
            navigate("/");
          }
        }, 1200);
      } else if (response.status === 403) {
        setToast({
          message: data.error || "Access denied. Unauthorized role.",
          type: "error",
        });
      } else {
        setToast({
          message: data.error || "Invalid user ID or password.",
          type: "error",
        });
      }
    } catch {
      setToast({
        message: "Could not connect to the server. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loginPage">
      {/* ── Toast ── */}
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />

      <div className="loginContainer">
        <div className="top">
          <img src="/logo2.png" alt="MAC-J Logo" className="logo" />
          <h1>Login</h1>
          <hr />
        </div>

        <form onSubmit={handleLogin} noValidate>
          {/* User ID */}
          <div
            className={`inputItem${errors.user_Id ? " inputItem--error" : ""}`}
          >
            <label htmlFor="login-user-id">User ID:</label>
            <input
              id="login-user-id"
              type="text"
              value={rawId}
              onChange={(e) => {
                setRawId(e.target.value);
                clearError("user_Id");
              }}
              placeholder="e.g. MACJ-001"
              autoComplete="username"
              disabled={loading}
            />
            {errors.user_Id && (
              <span className="fieldError">{errors.user_Id}</span>
            )}
          </div>

          {/* Password */}
          <div
            className={`inputItem${errors.password ? " inputItem--error" : ""}`}
          >
            <label htmlFor="login-password">Password:</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError("password");
              }}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
            />
            {errors.password && (
              <span className="fieldError">{errors.password}</span>
            )}
            <div className="forgotPasswordContainer">
              <span className="link" onClick={() => setIsModalOpen(true)}>
                Forgot Password?
              </span>
            </div>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>
      </div>
      <ForgotPasswordModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
    </div>
  );
};

export default Login;
