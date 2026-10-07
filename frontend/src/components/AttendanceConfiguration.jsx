import React, { useState } from 'react';
import { Clock, Coffee, ShieldAlert, Save, Info, Edit3, X, Moon } from 'lucide-react';
import { Switch } from "@/components/ui/switch";

export default function AttendanceConfiguration({
  enableNightShift, setEnableNightShift,
  workStart, setWorkStart,
  workEnd, setWorkEnd,
  eveningStart, setEveningStart,
  eveningEnd, setEveningEnd,
  gracePeriod, setGracePeriod,
  lunchStart, setLunchStart,
  lunchEnd, setLunchEnd,
  lunchDuration, setLunchDuration,
  flexibleThreshold, setFlexibleThreshold,
  workHourThreshold, setWorkHourThreshold,
  onSave,
  saving,
  isAdmin
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [snapshot, setSnapshot] = useState(null);

  const handleStartEdit = () => {
    setSnapshot({
      enableNightShift,
      workStart,
      workEnd,
      eveningStart,
      eveningEnd,
      gracePeriod,
      lunchStart,
      lunchEnd,
      lunchDuration,
      flexibleThreshold,
      workHourThreshold
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (snapshot) {
      if (setEnableNightShift) setEnableNightShift(snapshot.enableNightShift);
      setWorkStart(snapshot.workStart);
      setWorkEnd(snapshot.workEnd);
      if (setEveningStart) setEveningStart(snapshot.eveningStart);
      if (setEveningEnd) setEveningEnd(snapshot.eveningEnd);
      setGracePeriod(snapshot.gracePeriod);
      setLunchStart(snapshot.lunchStart);
      setLunchEnd(snapshot.lunchEnd);
      setLunchDuration(snapshot.lunchDuration);
      setFlexibleThreshold(snapshot.flexibleThreshold);
      setWorkHourThreshold(snapshot.workHourThreshold);
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    await onSave();
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen text-slate-800 font-sans max-w-6xl mx-auto space-y-6">
      
      {/* --- TOP HEADER CARD --- */}
      <div className="bg-brand-primary text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-white/10 rounded-lg border border-white/10">
            <Clock className="w-6 h-6 text-purple-200" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Attendance Configuration</h1>
            <p className="text-sm text-purple-200/80 mt-0.5">Manage shifts, flexible lunch thresholds, and gatekeeper rules</p>
          </div>
        </div>
        
        {isAdmin && (
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
                  disabled={saving}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> <span>{saving ? "Saving..." : "Save Changes"}</span>
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
        )}
      </div>

      {/* --- CORE CONFIGURATION FORM GRID --- */}
      <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm space-y-8">
        
        {/* SECTION 1: Standard Shift Constraints */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Clock className="w-4 h-4 text-purple-700" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Official Shift Bounds</h3>
          </div>

          {/* Night Shift Operational Mode Toggle */}
          <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-800">Company Operates Night Shift</h4>
                {enableNightShift ? (
                  <span className="text-[10px] uppercase font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">Active</span>
                ) : (
                  <span className="text-[10px] uppercase font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded border border-slate-300">Disabled (Day-Shift Only)</span>
                )}
              </div>
              <p className="text-xs text-slate-500 max-w-xl">
                Enable if your company schedules evening/night shifts (20:30 – 05:30). When disabled, any scans past 5:30 PM without approved overtime are strictly flagged as Irregular, and night shift options are hidden.
              </p>
            </div>
            <Switch 
              checked={Boolean(enableNightShift)}
              onCheckedChange={(checked) => setEnableNightShift && setEnableNightShift(checked)}
              disabled={!isAdmin || !isEditing}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormTimePicker 
              label="Morning Shift Start Time"
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
              subtext="Official expected time-in punch threshold"
              disabled={!isAdmin || !isEditing}
            />
            <FormTimePicker 
              label="Morning Shift End Time"
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
              subtext="Official expected clock-out time marker"
              disabled={!isAdmin || !isEditing}
            />
          </div>

          {enableNightShift && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-100 animate-in fade-in">
              <FormTimePicker 
                label="Evening Shift Start Time"
                value={eveningStart}
                onChange={(e) => setEveningStart && setEveningStart(e.target.value)}
                subtext="Official expected time-in for night shift workers"
                disabled={!isAdmin || !isEditing}
              />
              <FormTimePicker 
                label="Evening Shift End Time"
                value={eveningEnd}
                onChange={(e) => setEveningEnd && setEveningEnd(e.target.value)}
                subtext="Official expected clock-out for night shift workers"
                disabled={!isAdmin || !isEditing}
              />
            </div>
          )}
        </div>

        {/* SECTION 2: Buffer Zones & Gatekeeping */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Grace Periods & Gatekeeping</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormTimePicker 
              label="Grace Period End Time"
              value={gracePeriod}
              onChange={(e) => setGracePeriod(e.target.value)}
              subtext="The last minute allowed before an employee's time card is flagged as tardy"
              disabled={!isAdmin || !isEditing}
            />
            
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-medium text-slate-500 tracking-wide">
                Overtime Calculation Threshold
              </label>
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 font-mono flex items-center justify-between">
                <span>{workEnd}</span>
                <span className="text-[10px] uppercase font-bold bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded border border-slate-300/40">
                  System Linked
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal leading-relaxed">
                OT begins immediately after {workEnd}. Total payable units depend on approved requests.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3: Flexible Lunch Configuration */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Coffee className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Flexible Lunch Intermission</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FormTimePicker 
              label="Lunch Window Start (Earliest)"
              value={lunchStart}
              onChange={(e) => setLunchStart(e.target.value)}
              subtext="Punches after this are tagged as Lunch Out"
              disabled={!isAdmin || !isEditing}
            />
            <FormTimePicker 
              label="Lunch Window End (Latest)"
              value={lunchEnd}
              onChange={(e) => setLunchEnd(e.target.value)}
              subtext="Punches before this are tagged as Lunch In"
              disabled={!isAdmin || !isEditing}
            />
            <div className="space-y-1.5 text-left w-full">
              <label className="block text-xs font-medium text-slate-500 tracking-wide">
                Lunch Duration (Minutes)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={(lunchDuration || "").toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '');
                  if (raw === '' || raw === '.' || !isNaN(raw)) setLunchDuration(raw);
                }}
                onBlur={() => setLunchDuration(parseFloat(lunchDuration) || 0)}
                disabled={!isAdmin || !isEditing}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-mono transition focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 shadow-xs disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-400 font-normal leading-relaxed">
                Fixed time deducted from total hours
              </p>
            </div>
            <div className="space-y-1.5 text-left w-full">
              <label className="block text-xs font-medium text-slate-500 tracking-wide">
                Min. Work for Deduction (Mins)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={(flexibleThreshold || "").toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '');
                  if (raw === '' || raw === '.' || !isNaN(raw)) setFlexibleThreshold(raw);
                }}
                onBlur={() => setFlexibleThreshold(parseFloat(flexibleThreshold) || 0)}
                disabled={!isAdmin || !isEditing}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-mono transition focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 shadow-xs disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-400 font-normal leading-relaxed">
                Break is only deducted if total shift exceeds this (e.g. 300 for 5 hrs)
              </p>
            </div>
            <div className="space-y-1.5 text-left w-full">
              <label className="block text-xs font-medium text-slate-500 tracking-wide">
                Absenteeism Threshold (Hrs)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={(workHourThreshold || "").toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '');
                  if (raw === '' || raw === '.' || !isNaN(raw)) setWorkHourThreshold(raw);
                }}
                onBlur={() => setWorkHourThreshold(parseFloat(workHourThreshold) || 0)}
                disabled={!isAdmin || !isEditing}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-mono transition focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 shadow-xs disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-400 font-normal leading-relaxed">
                Min. worked hours to avoid being marked as Absent by system
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* --- PREVIEW BAR SUMMARY --- */}
      <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 flex items-start space-x-3 text-left">
        <Info className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-blue-900">Dynamic Attendance Rules Active</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            The system now uses a flexible lunch window. Any "Out" punch between <b>{lunchStart}</b> and <b>{lunchEnd}</b> is automatically 
            categorized as a break. A fixed <b>{lunchDuration} minutes</b> will be used for hour calculations, but only if the total work duration 
            exceeds <b>{flexibleThreshold} minutes</b>.
          </p>
        </div>
      </div>

    </div>
  );
}

{/* --- LOCAL TIME PICKER FORM ELEMENT ATOM --- */}
function FormTimePicker({ label, value, onChange, subtext, disabled }) {
  return (
    <div className="space-y-1.5 text-left w-full">
      <label className="block text-xs font-medium text-slate-500 tracking-wide">
        {label}
      </label>
      <input
        type="time"
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-mono transition focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 shadow-xs cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
      />
      {subtext && <p className="text-[11px] text-slate-400 font-normal leading-relaxed">{subtext}</p>}
    </div>
  );
}
