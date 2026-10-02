import React, { useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CircularProgress from "@mui/material/CircularProgress";

const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  if (!isOpen) return null;

  const handleClose = () => {
    setEmail("");
    setError("");
    setSuccess(false);
    setSentEmail("");
    onClose();
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await response.json();

      if (response.ok) {
        setSentEmail(cleanEmail);
        setSuccess(true);
      } else {
        setError(data.error || "Failed to send reset link. Please verify your email.");
      }
    } catch (err) {
      console.error(err);
      setError("Network connection error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Modal Overlay */
    <div 
      className="fixed inset-0 w-screen h-screen bg-black/50 z-[3000] flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) handleClose();
      }}
    >
      {/* Modal Content */}
      <div className="bg-white w-full max-w-[430px] p-7 rounded-2xl shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          disabled={loading}
          className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-slate-400 hover:text-brand-primary transition-colors p-1 disabled:opacity-40"
          onClick={handleClose}
          aria-label="Close"
        >
          <CloseIcon fontSize="small" />
        </button>

        {success ? (
          /* Success Screen */
          <div className="flex flex-col items-center text-center py-2">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
              <MarkEmailReadIcon sx={{ fontSize: 36 }} />
            </div>

            <h2 className="text-brand-primary text-xl font-bold mb-2">Reset Link Sent!</h2>
            <p className="text-sm text-slate-600 mb-3 leading-relaxed">
              We have dispatched a password reset link to:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-4 mb-4 text-sm font-semibold text-brand-primary break-all max-w-full">
              {sentEmail}
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-xs text-amber-800 text-left mb-6 leading-normal">
              <p className="font-semibold mb-1">Important:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>The link will expire in <strong>60 minutes</strong>.</li>
                <li>Be sure to inspect your <strong>Spam / Junk</strong> folder if it does not appear in your inbox.</li>
              </ul>
            </div>

            <div className="w-full flex flex-col gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 px-5 bg-brand-primary text-white border-none rounded-lg font-bold text-sm cursor-pointer hover:bg-brand-primary-hover transition-all shadow-md active:scale-95"
              >
                Back to Login
              </button>

              <button
                type="button"
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                  setError("");
                }}
                className="w-full py-2 text-xs text-slate-500 hover:text-brand-primary font-medium transition-colors bg-transparent border-none cursor-pointer"
              >
                Need to try another email address?
              </button>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <img src="/logo2.png" alt="MAC-J Logo" className="w-[170px] mx-auto mb-3" />
              <h2 className="text-brand-primary text-xl font-bold m-0">Forgot Password</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Enter your registered company email address and we will send you a secure link to reset your password.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-150">
                <ErrorOutlineIcon fontSize="small" className="text-red-500 shrink-0 mt-0.5" />
                <span className="leading-tight">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleResetRequest} className="space-y-4">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Registered Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. employee@machip.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  disabled={loading}
                  required
                  autoFocus
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-5 bg-brand-primary text-white border-none rounded-lg font-bold text-sm cursor-pointer hover:bg-brand-primary-hover transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <CircularProgress size={18} sx={{ color: "white" }} />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleClose}
                  className="text-xs text-slate-500 hover:text-brand-primary font-medium bg-transparent border-none cursor-pointer transition-colors"
                >
                  Cancel and Return to Login
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordModal;