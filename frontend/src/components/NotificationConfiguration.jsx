import React, { useState } from 'react';
import { Bell, Mail, ShieldAlert, Clock, Info, Save, Edit3, X, CheckCircle } from 'lucide-react';

export default function NotificationConfiguration() {
  // Stateful hooks to manage configuration states
  const [isEditing, setIsEditing] = useState(false);
  const [emailPayslip, setEmailPayslip] = useState(true);
  const [suspiciousScans, setSuspiciousScans] = useState(true);
  const [absentTriggerTime, setAbsentTriggerTime] = useState("17:30");
  const [snapshot, setSnapshot] = useState(null);
  const [savedToast, setSavedToast] = useState(false);

  const handleStartEdit = () => {
    setSnapshot({ emailPayslip, suspiciousScans, absentTriggerTime });
    setIsEditing(true);
    setSavedToast(false);
  };

  const handleCancel = () => {
    if (snapshot) {
      setEmailPayslip(snapshot.emailPayslip);
      setSuspiciousScans(snapshot.suspiciousScans);
      setAbsentTriggerTime(snapshot.absentTriggerTime);
    }
    setIsEditing(false);
  };

  const handleSave = () => {
    setIsEditing(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <div className="min-h-screen text-slate-800 font-sans max-w-6xl mx-auto space-y-6">
      
      {/* --- TOP HEADER CARD --- */}
      <div className="bg-[#2A1B4E] text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-white/10 rounded-lg border border-white/10">
            <Bell className="w-6 h-6 text-purple-200" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Notification Configuration</h1>
            <p className="text-sm text-purple-200/80 mt-0.5">Manage automated dispatches, webhooks, and security flags</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {isEditing ? (
            <>
              <button 
                type="button"
                onClick={handleCancel}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-sm font-medium shadow-sm transition"
              >
                <X className="w-4 h-4" /> <span>Cancel</span>
              </button>
              <button 
                type="button"
                onClick={handleSave}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
              >
                <Save className="w-4 h-4" /> <span>Save Changes</span>
              </button>
            </>
          ) : (
            <button 
              type="button"
              onClick={handleStartEdit}
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-lg text-sm font-medium shadow-sm transition"
            >
              <Edit3 className="w-4 h-4" /> <span>Edit Configuration</span>
            </button>
          )}
        </div>
      </div>

      {savedToast && (
        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center space-x-2 text-emerald-800 text-xs font-semibold animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Notification configuration saved successfully!</span>
        </div>
      )}

      {/* --- CORE SETTINGS CARD --- */}
      <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm space-y-6">
        
        {/* SECTION 1: Automated Toggles */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Bell className="w-4 h-4 text-purple-700" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Automated Intercept Alerts</h3>
          </div>

          <div className="space-y-2 split-rows">
            <FormSwitch 
              label="Email Notifications"
              description="Automatically trigger and distribute secure digital payslips via email to registered employee addresses upon closing out payroll cycles."
              icon={<Mail className="w-4 h-4 text-slate-500" />}
              checked={emailPayslip}
              disabled={!isEditing}
              onChange={() => setEmailPayslip(!emailPayslip)}
            />
            
            <hr className="border-slate-100" />

            <FormSwitch 
              label="Suspicious Scan Alerts"
              description="Instantly flag and dispatch high-priority notifications to system administrators when biometrics register duplicate location logs or impossible time gaps."
              icon={<ShieldAlert className="w-4 h-4 text-amber-500" />}
              checked={suspiciousScans}
              disabled={!isEditing}
              onChange={() => setSuspiciousScans(!suspiciousScans)}
            />
          </div>
        </div>

        {/* SECTION 2: Scheduled Engine Triggers */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Clock className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Automated Chron Jobs</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-medium text-slate-500 tracking-wide">
                Absent Auto-Mark Time
              </label>
              <input
                type="time"
                value={absentTriggerTime}
                disabled={!isEditing}
                onChange={(e) => setAbsentTriggerTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-mono transition focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 shadow-xs cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-400 font-normal leading-relaxed">
                The targeted system clock timestamp where empty active shift records dynamically roll into an explicit "Absenteeism" state.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* --- PREVIEW METRIC SUMMARY --- */}
      <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 flex items-start space-x-3 text-left">
        <Info className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-blue-900">System Notification Interceptor</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            All updates operate natively with localized SMTP parameters. Disabling critical scanning notifications might cause delay anomalies on time logs to pass unflagged down to payroll evaluation modules.
          </p>
        </div>
      </div>

    </div>
  );
}

{/* --- REUSABLE ATOMIC FORM SWITCH WITH INTEGRATED ICON --- */}
function FormSwitch({ label, description, icon, checked, disabled = false, onChange }) {
  return (
    <div className="flex items-start justify-between py-3 px-2 rounded-lg hover:bg-slate-50/50 transition">
      <div className="flex items-start space-x-3 text-left max-w-[85%]">
        <div className="mt-0.5 bg-slate-100 p-2 rounded-lg border border-slate-200/40">
          {icon}
        </div>
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-slate-700">{label}</div>
          <div className="text-xs text-slate-400 leading-relaxed">{description}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={disabled ? undefined : onChange}
        disabled={disabled}
        className={`relative inline-flex h-5 w-10 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-2 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${
          checked ? 'bg-emerald-500' : 'bg-slate-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}