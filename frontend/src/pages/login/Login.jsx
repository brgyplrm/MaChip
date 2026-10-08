import { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import ForgotPasswordModal from "../../components/forgotPassword/ForgotPasswordModal";
import { getStoredUser, setStoredUser, clearStoredAuth } from "../../utils/authStorage";

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
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── Show notification if redirected due to inactivity ──────────────────────
  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "inactivity") {
      setToast({
        message: "You have been logged out due to 15 minutes of inactivity.",
        type: "error",
      });
    }
  }, [searchParams]);

  // ── Verify session on load against backend before redirecting ───────────────
  useEffect(() => {
    const checkActiveSession = async () => {
      const storedUser = getStoredUser();
      if (!storedUser) return;

      try {
        const response = await fetch("/api/auth/verify", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.user) {
            setStoredUser(data.user);
            if (data.user.user_RoleId === 3) {
              navigate("/employeeHome", { replace: true });
            } else {
              navigate("/", { replace: true });
            }
          }
        } else {
          // Token expired or server restarted: clear stale cache
          clearStoredAuth();
        }
      } catch (err) {
        clearStoredAuth();
      }
    };

    checkActiveSession();
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

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_Id: rawId.trim(), password }),
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setStoredUser(data.data);
        setToast({ message: "Login successful! Redirecting…", type: "success" });

        setTimeout(() => {
          if (data.data.user_RoleId === 3) {
            navigate("/employeeHome");
          } else if (data.data.user_RoleId === 1 || data.data.user_RoleId === 2 || data.data.user_RoleId === 4) {
            navigate("/");
          } else {
            navigate("/employeeHome");
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
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] bg-white font-sans text-slate-800">
      {/* ── Toast Notifications ── */}
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />

      {/* ══════════════════════════════════════════════════════════════════════════
          LEFT PANE: BRANDING, COMPLIANCE & TELEMETRY (Split Enterprise Layout)
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col justify-between p-10 xl:p-14 bg-gradient-to-br from-[#1b0c36] via-[#2a174e] to-[#180933] text-white relative overflow-hidden select-none">
        {/* Ambient Decorative Glows (Green & Purple Brand Palette) */}
        <div 
          className="absolute -top-28 -right-24 w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(163, 182, 34, 0.16) 0%, rgba(42, 23, 78, 0) 70%)"
          }}
        />
        <div 
          className="absolute -bottom-32 -left-20 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(62, 36, 114, 0.45) 0%, rgba(42, 23, 78, 0) 75%)"
          }}
        />

        {/* Top Company Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-white p-1.5 shadow-lg shadow-black/20 flex items-center justify-center shrink-0">
              <img 
                src="/2026-Logo.png" 
                alt="MAC-J Logo" 
                className="max-h-full max-w-full object-contain" 
              />
            </div>
            <div>
              <h2 className="text-[17px] font-extrabold tracking-tight text-white leading-tight">
                MAC-J INT'L FORWARDING
              </h2>
              <p className="text-[12px] text-purple-200/80">
                Cargo &amp; Air Freight Logistics — NAIA Complex
              </p>
            </div>
          </div>

          {/* Hero Content */}
          <div className="mt-14 max-w-md">
            
            <h1 className="text-3xl xl:text-4xl font-extrabold text-white leading-[1.25] tracking-tight mb-3">
              Centralized Access Control &amp;<br />
              <span className="bg-gradient-to-r from-[#a3b622] via-[#b8cc28] to-[#d6ea38] bg-clip-text text-transparent">
                Payroll Management System
              </span>
            </h1>
            <p className="text-sm text-purple-200/85 leading-relaxed">
              Secure LAN-based biometric attendance, RFID authentication, and synchronized batch payroll processing.
            </p>
          </div>
        </div>

        {/* Live Telemetry & Status Badges (Option 1: Full Embedded Hardware Stack) */}
        <div className="relative z-10 grid grid-cols-2 gap-3.5 pt-6 border-t border-purple-800/40">
          <div className="bg-white/[0.05] border border-white/10 rounded-xl p-3.5 backdrop-blur-md">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-200/70 mb-1">
              Hardware Gateway
            </div>
            <div className="text-[13.5px] font-bold text-white flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]" />
              ESP32 · MFRC522 &amp; R307
            </div>
            <div className="text-[11px] text-purple-200/60 mt-0.5">
               2FA RFID + Biometric (ST7789 IPS)
            </div>
          </div>

          <div className="bg-white/[0.05] border border-white/10 rounded-xl p-3.5 backdrop-blur-md">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-200/70 mb-1">
              Next Payroll Cutoff
            </div>
            <div className="text-[13.5px] font-bold text-[#c7db34] flex items-center gap-1.5">
              <span>📅</span> 15th (Processed on 10th)
            </div>
            <div className="text-[11px] text-purple-200/60 mt-0.5">
              Automated Batch Processing
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          RIGHT PANE: AUTHENTICATION FORM PANE
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12 xl:p-16 bg-white min-h-screen">
        <div className="w-full max-w-[420px] mx-auto">
          {/* Mobile Brand Banner (visible only on small screens when left pane is hidden) */}
          <div className="lg:hidden flex flex-col items-center text-center mb-7">
            <div className="p-2 mb-2 bg-white rounded-xl shadow-sm">
              <img 
                src="/2026-Logo.png" 
                alt="MAC-J Logo" 
                className="w-[180px] max-[480px]:w-[140px] mx-auto object-contain"
              />
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#a3b622]/15 text-[#5e6b0a] border border-[#a3b622]/30 mt-1">
              🔒 CTPAT Tier II Certified
            </span>
          </div>

          {/* Form Header */}
          <div className="mb-7 text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2a174e] tracking-tight mb-1">
              Welcome back
            </h2>
            <p className="text-sm text-slate-500">
              Please enter your authorized corporate credentials.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} noValidate className="w-full flex flex-col gap-4.5">
            {/* User ID Field */}
            <div className="flex flex-col gap-1.5 w-full">
              <label 
                htmlFor="login-user-id" 
                className={`text-[12.5px] font-semibold flex justify-between items-center ${errors.user_Id ? 'text-[#c0392b]' : 'text-slate-700'}`}
              >
                <span>Employee / User ID</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  id="login-user-id"
                  type="text"
                  className={`w-full h-11 pl-10.5 pr-3.5 border-[1.5px] rounded-xl text-sm transition-all duration-200 outline-none placeholder:text-slate-400 
                    ${errors.user_Id 
                      ? 'border-[#c0392b] bg-[#fff5f5] focus:ring-4 focus:ring-[#c0392b]/15' 
                      : 'border-slate-300 bg-[#f8fafc] focus:bg-white focus:border-[#2a174e] focus:ring-4 focus:ring-[#2a174e]/10'}`}
                  value={rawId}
                  onChange={(e) => {
                    setRawId(e.target.value);
                    clearError("user_Id");
                  }}
                  placeholder="e.g. MACJ-001"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
              {errors.user_Id && (
                <span className="text-xs text-[#c0392b] flex items-center gap-1 mt-0.5 animate-[fadeInDown_0.2s_ease]">
                  {errors.user_Id}
                </span>
              )}
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5 w-full">
              <label 
                htmlFor="login-password" 
                className={`text-[12.5px] font-semibold flex justify-between items-center ${errors.password ? 'text-[#c0392b]' : 'text-slate-700'}`}
              >
                <span>Password</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className={`w-full h-11 pl-10.5 pr-11 border-[1.5px] rounded-xl text-sm transition-all duration-200 outline-none placeholder:text-slate-400 
                    ${errors.password 
                      ? 'border-[#c0392b] bg-[#fff5f5] focus:ring-4 focus:ring-[#c0392b]/15' 
                      : 'border-slate-300 bg-[#f8fafc] focus:bg-white focus:border-[#2a174e] focus:ring-4 focus:ring-[#2a174e]/10'}`}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError("password");
                  }}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded cursor-pointer"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <span className="text-xs text-[#c0392b] flex items-center gap-1 mt-0.5 animate-[fadeInDown_0.2s_ease]">
                  {errors.password}
                </span>
              )}
            </div>

            {/* Forgot Password Link */}
            <div className="flex items-center justify-end text-[12.5px]">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="font-semibold text-[#2a174e] hover:text-[#8e9e2b] underline cursor-pointer transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full h-12 mt-1.5 bg-gradient-to-r from-[#2a174e] via-[#351d62] to-[#2a174e] hover:from-[#1b0c36] hover:to-[#221240] text-white rounded-xl font-bold text-[14.5px] shadow-[0_6px_18px_rgba(42,23,78,0.25)] hover:shadow-[0_8px_24px_rgba(42,23,78,0.35)] cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span>{loading ? "Signing in…" : "Sign In to Terminal"}</span>
              {!loading && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              )}
            </button>
          </form>

          {/* Security & Idle Policy Footer Note */}
          <p className="mt-8 text-center text-[11px] text-slate-400">
            Authorized MAC-J Personnel Only • Session expires after 15 min idle
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />

      {/* Global CSS Injection for the custom validation animation */}
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