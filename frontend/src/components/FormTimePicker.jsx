import React, { useState } from 'react';
import { Clock, Coffee, ShieldAlert, Save, Info } from 'lucide-react';

{/* --- LOCAL TIME PICKER FORM ELEMENT ATOM --- */}
function FormTimePicker({ label, value, onChange, disabled }) {
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
    </div>
  );
}
