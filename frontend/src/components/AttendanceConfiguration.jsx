import React, { useState } from 'react';
import { Clock, Coffee, ShieldAlert, CheckCircle, Info, Edit3, Save } from 'lucide-react';

export default function AttendanceConfiguration() {
  // Operational state management for configuration settings
  const [workStart, setWorkStart] = useState("08:00");
  const [gracePeriod, setGracePeriod] = useState("08:35");
  const [lunchStart, setLunchStart] = useState("11:30");
  const [lunchEnd, setLunchEnd] = useState("13:30");
  const [workEnd, setWorkEnd] = useState("17:30");

  return (
    <div className="min-h-screen text-slate-800 font-sans max-w-6xl mx-auto space-y-6">
      
      {/* --- TOP HEADER CARD --- */}
      <div className="bg-[#2A1B4E] text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-white/10 rounded-lg border border-white/10">
            <Clock className="w-6 h-6 text-purple-200" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Attendance Configuration</h1>
            <p className="text-sm text-purple-200/80 mt-0.5">Manage shifts, lunch windows, and gatekeeper rules</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-lg text-sm font-medium shadow-sm transition">
            <Save className="w-4 h-4" /> <span>Save Ruleset</span>
          </button>
        </div>
      </div>

      {/* --- CORE CONFIGURATION FORM GRID --- */}
      <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm space-y-8">
        
        {/* SECTION 1: Standard Shift Constraints */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Clock className="w-4 h-4 text-purple-700" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Official Shift Bounds</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormTimePicker 
              label="Work Start Time"
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
              subtext="Official expected time-in punch threshold"
            />
            <FormTimePicker 
              label="Work End Time"
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
              subtext="Official expected clock-out time marker"
            />
          </div>
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
            />
            
            {/* Display-Only Overtime Entry */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-medium text-slate-500 tracking-wide">
                Overtime Start Time
              </label>
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 font-mono flex items-center justify-between">
                <span>{workEnd} PM</span>
                <span className="text-[10px] uppercase font-bold bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded border border-slate-300/40">
                  Linked to Approved Requests
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal leading-relaxed">
                Time OT calculations officially kick off. Directly tied to corresponding system approvals.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3: Mid-Day Intermission Breaks */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Coffee className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Lunch Intermission Windows</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormTimePicker 
              label="Lunch Break Start"
              value={lunchStart}
              onChange={(e) => setLunchStart(e.target.value)}
              subtext="Opening of the official 'lunch out' checking window"
            />
            <FormTimePicker 
              label="Lunch Break End"
              value={lunchEnd}
              onChange={(e) => setLunchEnd(e.target.value)}
              subtext="Closing of the official 'lunch in' validation window"
            />
          </div>
        </div>

      </div>

      {/* --- PREVIEW BAR SUMMARY --- */}
      <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 flex items-start space-x-3 text-left">
        <Info className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-blue-900">Deterministic Schedule Logic Activated</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Attendance engine parses raw biometric log arrays relative to these settings. Late flags trigger automatic prorated 
            deductions matching the configured **"No Work, No Pay"** system rules.
          </p>
        </div>
      </div>

    </div>
  );
}

{/* --- LOCAL TIME PICKER FORM ELEMENT ATOM --- */}
function FormTimePicker({ label, value, onChange, subtext }) {
  return (
    <div className="space-y-1.5 text-left w-full">
      <label className="block text-xs font-medium text-slate-500 tracking-wide">
        {label}
      </label>
      <input
        type="time"
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-mono transition focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 shadow-xs cursor-pointer"
      />
      {subtext && <p className="text-[11px] text-slate-400 font-normal leading-relaxed">{subtext}</p>}
    </div>
  );
}