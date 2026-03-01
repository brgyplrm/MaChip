import "./login.scss";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../../components/toast/Toast";

// ── Validation helpers ────────────────────────────────────────────────────────

const validateForm = ({ username, password }) => {
  const errors = {};

  if (!username.trim()) {
    errors.username = "Username is required.";
  } else if (username.trim().length < 3) {
    errors.username = "Username must be at least 3 characters.";
  }

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  return errors;
};

// ─────────────────────────────────────────────────────────────────────────────

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // field-level error messages
  const [errors, setErrors] = useState({});

  // toast notification: { message, type }
  const [toast, setToast] = useState({ message: "", type: "success" });

  const navigate = useNavigate();

  // Clear a single field error when the user starts typing again
  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: "" }));

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
  );

  const handleLogin = async (e) => {
    e.preventDefault();

    // 1. Validate
    const validationErrors = validateForm({ username, password });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setToast({
        message: "Please fix the errors before submitting.",
        type: "error",
      });
      return;
    }

    // 2. Submit
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (response.ok) {
        setToast({
          message: "Login successful! Redirecting…",
          type: "success",
        });
        setTimeout(() => navigate("/"), 1200);
      } else {
        const data = await response.json().catch(() => ({}));
        setToast({
          message: data.error || "Invalid username or password.",
          type: "error",
        });
      }
    } catch {
      setToast({
        message: "Could not connect to the server. Please try again.",
        type: "error",
      });
    }
  };

  return (
    <div className="loginPage">
      {/* ── Toast ── */}
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />

      <div className="loginContainer">
        <div className="top">
          <img src="/logo2.png" alt="MAC-J Logo" className="logo" />
          <h1>Admin Login</h1>
          <hr />
        </div>

        <form onSubmit={handleLogin} noValidate>
          {/* Username */}
          <div
            className={`inputItem${errors.username ? " inputItem--error" : ""}`}
          >
            <label htmlFor="login-username">Username:</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                clearError("username");
              }}
              placeholder="Enter your username"
              autoComplete="username"
            />
            {errors.username && (
              <span className="fieldError">{errors.username}</span>
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
            />
            {errors.password && (
              <span className="fieldError">{errors.password}</span>
            )}
          </div>

          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
