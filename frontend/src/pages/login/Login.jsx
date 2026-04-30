import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import ForgotPasswordModal from "../../components/forgotPassword/ForgotPasswordModal";

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseMacjId = (value) => {
  const match = value.trim().match(/^MACJ-(\d+)$/i);
  if (!match) return NaN;
  return parseInt(match[1], 10);
};

const validateForm = ({ rawId, password }) => {
  const errors = {};
  if (!rawId.trim()) errors.user_Id = "User ID is required.";
  if (!password) errors.password = "Password is required.";
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
    const numericId = parseMacjId(rawId);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_Id: numericId, password }),
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        localStorage.setItem("userData", JSON.stringify(data.data));
        setToast({ message: "Login successful! Redirecting…", type: "success" });

        setTimeout(() => {
          if (data.data.user_RoleId === 3) {
            navigate("/employeeHome");
          } else {
            navigate("/");
          }
        }, 1200);
      } else if (response.status === 403) {
        setToast({ message: data.error || "Access denied. Unauthorized role.", type: "error" });
      } else {
        setToast({ message: data.error || "Invalid user ID or password.", type: "error" });
      }
    } catch {
      setToast({ message: "Could not connect to the server. Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 box-border bg-[linear-gradient(90deg,#2a174e_0%,#ffffff_28%,#ffffff_72%,#ffae00_100%)]">
      {/* ── Toast ── */}
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />

      <div className="w-full max-w-[380px] p-[40px_30px] sm:max-[480px]:p-[30px_20px] flex flex-col items-center text-center bg-white rounded-[16px] shadow-[0px_10px_25px_rgba(0,0,0,0.1),0_4px_10px_rgba(0,0,0,0.05)] transition-transform duration-300 ease-in-out hover:-translate-y-[5px]">
        
        <div className="flex flex-col items-center w-fulls mb-[20px]">
          <img 
            src="/logo2.png" 
            alt="MAC-J Logo" 
            className="w-[200px] max-[480px]:w-[150px] mb-[15px] mx-auto pb-[15px]"/>
        </div>

        <form onSubmit={handleLogin} noValidate className="w-full flex flex-col gap-[15px]">
          
          {/* User ID */}
          <div className="flex flex-col items-start gap-2 relative w-full">
            <label 
              htmlFor="login-user-id" 
              className={`text-[14px] font-medium ${errors.user_Id ? 'text-[#c0392b]' : 'text-[#555]'}`}
            >
              User ID:
            </label>
            <input
              id="login-user-id"
              type="text"
              className={`w-full p-[12px_10px] border-[1.5px] rounded-lg text-[14px] transition-all duration-200 outline-none placeholder:text-[#aaa] placeholder:text-[13px] 
                ${errors.user_Id 
                  ? 'border-[#c0392b] bg-[#fff5f5] focus:ring-3 focus:ring-[#c0392b]/15' 
                  : 'border-[#ccc] bg-white focus:border-[#2a174e] focus:ring-3 focus:ring-[#2a174e]/12'}`}
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
              <span className="text-[12px] text-[#c0392b] flex items-center gap-1 mt-[-4px] animate-[fadeInDown_0.2s_ease]">
                {errors.user_Id}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col items-start gap-2 relative w-full">
            <label 
              htmlFor="login-password" 
              className={`text-[14px] font-medium ${errors.password ? 'text-[#c0392b]' : 'text-[#555]'}`}
            >
              Password:
            </label>
            <input
              id="login-password"
              type="password"
              className={`w-full p-[12px_10px] border-[1.5px] rounded-lg text-[14px] transition-all duration-200 outline-none placeholder:text-[#aaa] placeholder:text-[13px] 
                ${errors.password 
                  ? 'border-[#c0392b] bg-[#fff5f5] focus:ring-3 focus:ring-[#c0392b]/15' 
                  : 'border-[#ccc] bg-white focus:border-[#2a174e] focus:ring-3 focus:ring-[#2a174e]/12'}`}
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
              <span className="text-[12px] text-[#c0392b] flex items-center gap-1 mt-[-4px] animate-[fadeInDown_0.2s_ease]">
                {errors.password}
              </span>
            )}
            <div className="flex justify-end w-full mt-[5px]">
              <span 
                className="text-[12px] text-[#2a174e] underline font-medium cursor-pointer hover:text-[#4f2a94]"
                onClick={() => setIsModalOpen(true)}
              >
                Forgot Password?
              </span>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full p-[10px] mt-[10px] bg-[#2a174e] text-white border-none rounded-lg font-bold text-[14px] shadow-[0px_4px_6px_rgba(0,0,0,0.2)] cursor-pointer transition-all duration-200 hover:bg-[#3e2472] active:scale-[0.97] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>
      </div>

      <ForgotPasswordModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />

      {/* Global CSS Injection for the custom animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
};

export default Login;