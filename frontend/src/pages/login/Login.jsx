import React, { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import ForgotPasswordModal from "../../components/forgotPassword/ForgotPasswordModal";

// --- Helpers from original Login.jsx ---
const parseMacjId = (value) => {
  const match = value.trim().match(/^MACJ-(\\d+)$/i);
  if (!match) return NaN;
  return parseInt(match[1], 10);
};

const validateForm = ({ rawId, password }) => {
  const errors = {};
  if (!rawId.trim()) errors.user_Id = "User ID is required.";
  if (!password) errors.password = "Password is required.";
  return errors;
};

const Login = () => {
  const [rawId, setRawId] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const navigate = useNavigate();

  const clearError = (field) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formErrors = validateForm({ rawId, password });
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    const numericId = parseMacjId(rawId);
    if (isNaN(numericId)) {
      setErrors({ user_Id: "Invalid format. Use MACJ-001." });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_Id: numericId, user_Password: password }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userData", JSON.stringify(data.user));
        if (data.user.user_RoleId === 1 || data.user.user_RoleId === 2) {
          localStorage.setItem("viewMode", "management");
          navigate("/");
        } else {
          localStorage.setItem("viewMode", "employee");
          navigate("/employeeHome");
        }
      } else {
        setToast({ message: data.message || "Login failed", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Server error. Try again later.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 box-border bg-[linear-gradient(90deg,#2a174e_0%,#ffffff_28%,#ffffff_72%,#ffae00_100%)]">
      {toast.message && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "" })} />
      )}

      {/* Login Container */}
      <div className="w-full max-w-[380px] p-[30px_20px] sm:p-[40px_30px] flex flex-col items-center text-center bg-white rounded-2xl shadow-[0px_10px_25px_rgba(0,0,0,0.1),0_4px_10px_rgba(0,0,0,0.05)] transition-transform duration-300 ease-out hover:-translate-y-1.5">
        
        <div className="mb-6">
          <img src="./logo2.png" alt="MaChip Logo" className="w-60 h-auto mx-auto" />
          <p className="text-gray-500 text-sm mt-1 font-medium italic">Your Secure Entryway</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5 text-left">
          
          {/* User ID Input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-id" className="text-[13px] font-bold text-[#444]">User ID:</label>
            <input
              id="login-id"
              type="text"
              className={`p-2.5 border rounded-lg text-sm transition-colors outline-none placeholder:text-gray-300 focus:border-[#2a174e] focus:bg-[#fbfaff] ${errors.user_Id ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-[#fdfdfd]'}`}
              value={rawId}
              onChange={(e) => { setRawId(e.target.value); clearError("user_Id"); }}
              placeholder="e.g. MACJ-001"
              autoComplete="username"
              disabled={loading}
            />
            {errors.user_Id && <span className="text-[11px] text-red-500 font-medium">{errors.user_Id}</span>}
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-[13px] font-bold text-[#444]">Password:</label>
            <input
              id="login-password"
              type="password"
              className={`p-2.5 border rounded-lg text-sm transition-colors outline-none placeholder:text-gray-300 focus:border-[#2a174e] focus:bg-[#fbfaff] ${errors.password ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-[#fdfdfd]'}`}
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
            />
            {errors.password && <span className="text-[11px] text-red-500 font-medium">{errors.password}</span>}
            
            <div className="flex justify-end mt-1">
              <span 
                className="text-xs text-[#2a174e] underline font-medium cursor-pointer hover:text-[#4f2a94]"
                onClick={() => setIsModalOpen(true)}
              >
                Forgot Password?
              </span>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full p-2.5 mt-2.5 bg-[#2a174e] text-white border-none rounded-lg font-bold text-sm shadow-[0px_4px_6px_rgba(0,0,0,0.2)] cursor-pointer transition-all duration-200 hover:bg-[#3e2475] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
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