import React, { useState } from "react";
import { KeyRound, ShieldCheck, Eye, EyeOff, LogOut, Loader2, Check, Circle } from "lucide-react";
import { fetchWithAuth } from "../../utils/api";
import { setStoredUser, clearStoredAuth } from "../../utils/authStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function FirstLoginModal({ currentUser, onPasswordChanged, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial && isMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!currentPassword) {
      setError("Please enter your current temporary password.");
      return;
    }

    if (!isValid) {
      if (!isMatch) {
        setError("New password and confirm password do not match.");
      } else {
        setError("Please ensure your new password satisfies all security requirements.");
      }
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password cannot be identical to your temporary password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/auth/set-initial-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update password. Please check your credentials.");
        return;
      }

      // Update cached user data using centralized auth storage
      const updatedUser = { ...currentUser, is_first_login: false };
      setStoredUser(updatedUser);

      if (onPasswordChanged) {
        onPasswordChanged(updatedUser);
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    setLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      } else {
        await fetchWithAuth("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_Id: currentUser?.user_Id }),
        });
        clearStoredAuth();
        window.location.href = "/login";
      }
    } catch {
      clearStoredAuth();
      window.location.href = "/login";
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-primary to-purple-800 text-white p-6 relative">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <KeyRound className="h-6 w-6 text-purple-200" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Welcome to MaChip</h3>
              <p className="text-xs text-purple-200 font-medium">First-Time Login Security Setup</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-semibold block mb-0.5">Password Update Mandatory</span>
              You have signed in using a temporary system-generated password. Please create a private, permanent password to continue.
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 font-medium">
              {error}
            </div>
          )}

          {/* Current Temporary Password */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Current Temporary Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                placeholder="Enter current temporary password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
                className="h-10 pr-10 bg-white"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              New Permanent Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                placeholder="Create new permanent password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                className="h-10 pr-10 bg-white"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Confirm Permanent Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-type new permanent password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="h-10 pr-10 bg-white"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Requirements Checklist */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <p className="text-slate-600 font-semibold text-[11px] mb-1.5">Password Requirements:</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <span className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                {hasMinLength ? <Check className="h-3 w-3 stroke-[3]" /> : <Circle className="h-2.5 w-2.5" />} At least 8 characters
              </span>
              <span className={`flex items-center gap-1.5 ${hasUpper ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                {hasUpper ? <Check className="h-3 w-3 stroke-[3]" /> : <Circle className="h-2.5 w-2.5" />} Uppercase letter (A-Z)
              </span>
              <span className={`flex items-center gap-1.5 ${hasLower ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                {hasLower ? <Check className="h-3 w-3 stroke-[3]" /> : <Circle className="h-2.5 w-2.5" />} Lowercase letter (a-z)
              </span>
              <span className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                {hasNumber ? <Check className="h-3 w-3 stroke-[3]" /> : <Circle className="h-2.5 w-2.5" />} Numeric digit (0-9)
              </span>
              <span className={`flex items-center gap-1.5 col-span-2 ${hasSpecial ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                {hasSpecial ? <Check className="h-3 w-3 stroke-[3]" /> : <Circle className="h-2.5 w-2.5" />} Special symbol (!@#$%^&*)
              </span>
              {confirmPassword.length > 0 && (
                <span className={`flex items-center gap-1.5 col-span-2 ${isMatch ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}`}>
                  {isMatch ? <Check className="h-3 w-3 stroke-[3]" /> : <Circle className="h-2.5 w-2.5" />} Passwords match
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <Button
              type="submit"
              disabled={loading || !isValid}
              className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold h-11 rounded-xl shadow"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving New Password...
                </>
              ) : (
                "Set Password & Enter Portal"
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleLogoutClick}
              disabled={loggingOut || loading}
              className="w-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 font-medium text-xs h-9"
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5 text-slate-400" /> Log Out
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
