import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockResetIcon from "@mui/icons-material/LockReset";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // ── Verify Reset Token on Mount ──────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setTokenError("No reset token provided in the link. Please request a new password reset.");
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/auth/verify-reset-token/${encodeURIComponent(token)}`);
        const data = await response.json();

        if (response.ok && data.valid) {
          setTokenValid(true);
          setUserInfo({ name: data.name, email: data.email });
        } else {
          setTokenValid(false);
          setTokenError(data.error || "This password reset link is invalid or has expired.");
        }
      } catch (err) {
        console.error("Token verification error:", err);
        setTokenValid(false);
        setTokenError("Could not connect to the server to verify your link. Please check your network connection.");
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  // ── Handle Password Reset Submission ─────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    if (!password) {
      setSubmitError("Please enter a new password.");
      return;
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      setSubmitError("Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.");
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match. Please verify.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
      } else {
        setSubmitError(data.error || "Failed to update password. Please try again.");
      }
    } catch (err) {
      console.error("Password reset error:", err);
      setSubmitError("A network error occurred while updating your password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 box-border bg-[linear-gradient(90deg,var(--color-brand-primary)_0%,#ffffff_28%,#ffffff_72%,#ffae00_100%)]">
      <div className="w-full max-w-[420px] p-[35px_30px] flex flex-col items-center text-center bg-white rounded-[16px] shadow-[0px_10px_25px_rgba(0,0,0,0.1),0_4px_10px_rgba(0,0,0,0.05)] transition-transform duration-300 ease-in-out">
        
        {/* Top Logo */}
        <div className="flex flex-col items-center w-full mb-5">
          <img
            src="/logo2.png"
            alt="MAC-J Logo"
            className="w-[180px] max-[480px]:w-[140px] mb-2 mx-auto"
          />
        </div>

        {/* ── 1. Verifying Token State ── */}
        {verifying && (
          <div className="flex flex-col items-center py-8">
            <CircularProgress size={42} sx={{ color: "var(--color-brand-primary)" }} />
            <h3 className="text-base font-bold text-brand-primary mt-4 mb-1">Verifying Reset Link</h3>
            <p className="text-xs text-slate-500">Please wait while we validate your security token...</p>
          </div>
        )}

        {/* ── 2. Invalid or Expired Token State ── */}
        {!verifying && !tokenValid && !isSuccess && (
          <div className="flex flex-col items-center w-full py-2 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-4 shadow-sm">
              <ErrorOutlineIcon sx={{ fontSize: 36 }} />
            </div>

            <h2 className="text-brand-primary text-xl font-bold mb-2">Invalid or Expired Link</h2>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed max-w-xs">
              {tokenError}
            </p>

            <div className="bg-amber-50 border border-amber-200/70 rounded-lg p-3 text-xs text-amber-800 text-left mb-6 w-full leading-relaxed">
              <p className="font-semibold mb-1">Why did this happen?</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Password reset links expire after <strong>1 hour</strong>.</li>
                <li>Each link can only be used <strong>once</strong>.</li>
                <li>A newer reset link may have been requested.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full py-3 px-5 bg-brand-primary text-white border-none rounded-lg font-bold text-sm cursor-pointer hover:bg-brand-primary-hover transition-all shadow-md active:scale-95"
            >
              Back to Login
            </button>
          </div>
        )}

        {/* ── 3. Success State ── */}
        {!verifying && isSuccess && (
          <div className="flex flex-col items-center w-full py-2 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
              <CheckCircleIcon sx={{ fontSize: 38 }} />
            </div>

            <h2 className="text-brand-primary text-xl font-bold mb-2">Password Reset Complete!</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-xs">
              Your password has been successfully updated. You can now use your new password to sign in.
            </p>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full py-3 px-5 bg-brand-primary text-white border-none rounded-lg font-bold text-sm cursor-pointer hover:bg-brand-primary-hover transition-all shadow-md active:scale-95"
            >
              Proceed to Login
            </button>
          </div>
        )}

        {/* ── 4. Set New Password Form State ── */}
        {!verifying && tokenValid && !isSuccess && (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-200">
            <div className="mb-4">
              <h2 className="text-brand-primary text-xl font-bold m-0 flex items-center justify-center gap-1.5">
                <LockResetIcon className="text-brand-primary" />
                Set New Password
              </h2>
              {userInfo.name ? (
                <p className="text-xs text-slate-500 mt-1.5">
                  Resetting credentials for <strong className="text-slate-700">{userInfo.name}</strong>
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-1.5">
                  Please create a strong new password for your account.
                </p>
              )}
            </div>

            {submitError && (
              <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700 text-left animate-in fade-in duration-150">
                <ErrorOutlineIcon fontSize="small" className="text-red-500 shrink-0 mt-0.5" />
                <span className="leading-tight">{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="w-full flex flex-col gap-3.5 text-left">
              {/* New Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  New Password
                </label>
                <div className="relative w-full">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (submitError) setSubmitError("");
                    }}
                    placeholder="Enter strong password (8+ chars)"
                    disabled={submitting}
                    required
                    className="w-full p-[11px_38px_11px_12px] border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 transition-all disabled:bg-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-600">
                    <p className="font-semibold text-[11px] mb-1">Password Requirements:</p>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <span className={password.length >= 8 ? "text-emerald-600 font-medium" : "text-slate-400"}>
                        {password.length >= 8 ? "✓" : "○"} At least 8 characters
                      </span>
                      <span className={/[A-Z]/.test(password) ? "text-emerald-600 font-medium" : "text-slate-400"}>
                        {/[A-Z]/.test(password) ? "✓" : "○"} Uppercase (A-Z)
                      </span>
                      <span className={/[a-z]/.test(password) ? "text-emerald-600 font-medium" : "text-slate-400"}>
                        {/[a-z]/.test(password) ? "✓" : "○"} Lowercase (a-z)
                      </span>
                      <span className={/[0-9]/.test(password) ? "text-emerald-600 font-medium" : "text-slate-400"}>
                        {/[0-9]/.test(password) ? "✓" : "○"} Number (0-9)
                      </span>
                      <span className={`col-span-2 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                        {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? "✓" : "○"} Special character (!@#$%^&*)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Confirm Password
                </label>
                <div className="relative w-full">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (submitError) setSubmitError("");
                    }}
                    placeholder="Re-enter your new password"
                    disabled={submitting}
                    required
                    className="w-full p-[11px_38px_11px_12px] border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 transition-all disabled:bg-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </button>
                </div>
              </div>

              {/* Password Requirement Hints */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-[11px] text-slate-600 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${password.length >= 6 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className={password.length >= 6 ? 'text-emerald-700 font-medium' : ''}>
                    At least 6 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${password && confirmPassword && password === confirmPassword ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className={password && confirmPassword && password === confirmPassword ? 'text-emerald-700 font-medium' : ''}>
                    Passwords match
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-5 mt-2 bg-brand-primary text-white border-none rounded-lg font-bold text-sm cursor-pointer hover:bg-brand-primary-hover transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <CircularProgress size={18} sx={{ color: "white" }} />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  "Update Password"
                )}
              </button>

              <div className="text-center mt-1">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-xs text-slate-500 hover:text-brand-primary font-medium bg-transparent border-none cursor-pointer transition-colors"
                >
                  Cancel and Return to Login
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
