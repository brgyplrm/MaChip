import React, { useState } from 'react';
import { 
  User, Shield, Bell, Server, DollarSign, Settings,
  Clock, Briefcase, FileText, Landmark, Eye, Edit3, Info, Grid, LayoutList
} from 'lucide-react';
import ConfigurationPreviewModal from './ConfigurationPreviewModal';

export default function PayrollConfiguration() {
  const [activeTab, setActiveTab] = useState('labor-rates');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // New state to manage changeable cutoff scheme selection
  const [cutoffScheme, setCutoffScheme] = useState('semi-monthly');

  return (
    <div className="min-h-screen text-slate-800 font-sans w-max-6xl">

      {/* --- MAIN CONTENT AREA --- */}
      <main className="space-y-4">
        
        {/* Top Header Card */}
        <div className="bg-[#2A1B4E] text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-white/10 rounded-lg border border-white/10">
              <Landmark className="w-6 h-6 text-purple-200" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Payroll System Configuration</h1>
              <p className="text-sm text-purple-200/80 mt-0.5">Manage statutory rates and computation rules</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsPreviewOpen(true)} 
              className="flex items-center space-x-1.5 px-4 py-2 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-lg text-sm font-medium transition"
            >
              <Eye className="w-4 h-4" /> <span>Preview</span>
            </button>
            <button className="flex items-center space-x-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-lg text-sm font-medium shadow-sm transition">
              <Edit3 className="w-4 h-4" /> <span>Edit Configuration</span>
            </button>
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white border border-slate-100 rounded-xl p-4 shadow-sm text-sm">
          <div className="flex items-center space-x-3 pl-2">
            <span className="text-slate-400 text-xs font-semibold uppercase">Schema Version</span>
            <span className="font-bold text-slate-700">2026.1.0</span>
          </div>
          <div className="flex items-center space-x-3 md:border-x md:border-slate-100 md:px-6">
            <span className="text-slate-400 text-xs font-semibold uppercase">Effective Date</span>
            <span className="font-bold text-slate-700">2026-01-01</span>
          </div>
          <div className="flex items-center space-x-3 md:border-r md:border-slate-100 md:px-6">
            <span className="text-slate-400 text-xs font-semibold uppercase">Status</span>
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE</span>
            </span>
          </div>
          {/* Changeable Cutoff Scheme Selector Dropdown */}
          <div className="flex flex-col justify-center items-start md:pl-6 space-y-0.5">
            <span className="text-slate-400 text-xs font-semibold uppercase">Cutoff Scheme</span>
            <select
              value={cutoffScheme}
              onChange={(e) => setCutoffScheme(e.target.value)}
              className="font-bold text-[#2A1B4E] bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer transition"
            >
              <option value="semi-monthly">Semi-Monthly (1–15, 16–end)</option>
              <option value="weekly">Weekly Cutoff Interval</option>
              <option value="bi-weekly">Bi-Weekly Cutoff Interval</option>
              <option value="monthly">Monthly Standard Cycle</option>
            </select>
          </div>
        </div>

        {/* --- SHADCN TABS INTERFACE --- */}
        <div className="w-full space-y-6">
          {/* Tab List Header */}
          <div className="flex bg-white border border-slate-100 rounded-xl p-1.5 shadow-sm overflow-x-auto">
            {[
              { id: 'labor-rates', label: 'Labor Rates', icon: DollarSign },
              { id: 'ot-night', label: 'OT & Night Shift', icon: Clock },
              { id: 'eemr', label: 'EEMR Factors', icon: Briefcase },
              { id: 'leave-caps', label: 'Leave Caps', icon: FileText },
              { id: 'gov-taxes', label: 'Government Taxes', icon: Landmark },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 mx-1 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                    isActive 
                      ? 'bg-[#2A1B4E] text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Windows */}
          <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm min-h-[400px]">
            {activeTab === 'labor-rates' && <LaborRatesView />}
            {activeTab === 'ot-night' && <OvertimeNightShiftView />}
            {activeTab === 'eemr' && <EEMRFactorsView />}
            {activeTab === 'leave-caps' && <LeaveCapsView />}
            {activeTab === 'gov-taxes' && <GovernmentTaxesView />}
          </div>
        </div>

      </main>

      {isPreviewOpen && (
        <ConfigurationPreviewModal onClose={() => setIsPreviewOpen(false)} />
      )}
    </div>
  );
}

{/* =========================================================================
    TAB PANEL 1: LABOR RATES
========================================================================= */}
function LaborRatesView() {
  const [viewFormat, setViewFormat] = useState('card');

  const compoundLaborData = [
    { type: "Special Day Combo", day: "Special Day on Rest Day", formula: "Base 1.0 + 30% + 20% rest shift", coefficient: "1.50", percentage: "150.0%" },
    { type: "Holiday Combo", day: "Regular Holiday on Rest Day", formula: "Base 2.0 × 1.30 rest index", coefficient: "2.60", percentage: "260.0%" },
    { type: "Holiday Combo", day: "Double Holiday on Rest Day", formula: "Base 3.0 × 1.30 rest index", coefficient: "3.90", percentage: "390.0%" },
    { type: "Special Day Combo", day: "Double Special Day on Rest Day", formula: "Base 1.5 × 1.30 rest index", coefficient: "1.95", percentage: "195.0%" }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Labor Rate Multipliers</h3>
        
        {/* Base Wage Factors */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-bold text-slate-700">Base Wage Factors (Normal: 8 hours/day)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormInput label="Ordinary Workday Multiplier" value="1" subtext="Default Baseline Value" />
            <FormInput label="Rest Day Premium Rate" value="1.3" subtext="+30% statutory premium" />
            <FormInput label="Special Non-Working Day Premium" value="1.3" subtext="+30% statutory premium" />
          </div>
        </div>
      </div>

      {/* Holiday Pay Multipliers */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-sm font-bold text-slate-700">Holiday & Special Day Pay Multipliers</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput label="Regular Holiday Multiplier" value="2" subtext="200% unworked/worked base" />
          <FormInput label="Double Regular Holiday Multiplier" value="3" subtext="300% worked base" />
          <FormInput label="Double Special Non-Working Day" value="1.5" subtext="150% worked base" />
        </div>
      </div>

      {/* Auto-Compiled Compound Matrices */}
      <div className="border border-blue-100 rounded-xl overflow-hidden shadow-xs bg-white">
        <div className="bg-[#2A1B4E] text-white px-5 py-3.5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-purple-200" />
            <span className="text-sm font-semibold tracking-wide">Auto-Compiled Compound Matrices (Read-Only Preview)</span>
          </div>
          
          <div className="flex bg-white/10 p-1 rounded-lg border border-white/10 self-start sm:self-auto">
            <button
              onClick={() => setViewFormat('table')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewFormat === 'table' ? 'bg-white text-[#2A1B4E] shadow-xs' : 'text-purple-200 hover:text-white'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewFormat('card')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewFormat === 'card' ? 'bg-white text-[#2A1B4E] shadow-xs' : 'text-purple-200 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>
        </div>

        {viewFormat === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-5">Matrix Class</th>
                  <th className="py-3 px-5">Target Intersection Classification</th>
                  <th className="py-3 px-5 font-mono">Formula Matrix Logic</th>
                  <th className="py-3 px-5 text-right font-mono">Base Factor</th>
                  <th className="py-3 px-5 text-right">Yield %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {compoundLaborData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                        row.type === "Holiday Combo" ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-amber-50 text-amber-700 border-amber-100"
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="py-3 px-5 font-medium text-slate-800">{row.day}</td>
                    <td className="py-3 px-5 font-mono text-xs text-slate-400">{row.formula}</td>
                    <td className="py-3 px-5 font-mono text-sm font-semibold text-slate-600 text-right">{row.coefficient}</td>
                    <td className="py-3 px-5 text-right">
                      <span className="font-bold text-slate-900">{row.percentage}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-blue-50/10">
            {compoundLaborData.map((row, idx) => (
              <StaticMetricBox 
                key={idx}
                title={row.day} 
                value={row.coefficient} 
                subtext={row.formula} 
              />
            ))}
          </div>
        )}
        <div className="bg-slate-50 px-5 py-2.5 border-t border-slate-100 text-[11px] text-slate-400">
          The system dynamically calculates compound intersections using deterministic scaling logic.
        </div>
      </div>
    </div>
  );
}

{/* =========================================================================
    TAB PANEL 2: OT & NIGHT SHIFT
========================================================================= */}
function OvertimeNightShiftView() {
  const [viewFormat, setViewFormat] = useState('table');

  const matrixData = [
    // --- NIGHT SHIFT ONLY (Base × 1.1) ---
    { type: "Night Shift", day: "Ordinary Day", formula: "1.00 × 1.10", coefficient: "1.1000", percentage: "110.0%" },
    { type: "Night Shift", day: "Rest Day", formula: "1.30 × 1.10", coefficient: "1.4300", percentage: "143.0%" },
    { type: "Night Shift", day: "Special (Non-Working) Day", formula: "1.30 × 1.10", coefficient: "1.4300", percentage: "143.0%" },
    { type: "Night Shift", day: "Special (Non-Working) Day on Rest Day", formula: "1.50 × 1.10", coefficient: "1.6500", percentage: "165.0%" },
    { type: "Night Shift", day: "Double Special (Non-Working) Day", formula: "1.50 × 1.10", coefficient: "1.6500", percentage: "165.0%" },
    { type: "Night Shift", day: "Double Special Day on Rest Day", formula: "1.95 × 1.10", coefficient: "2.1450", percentage: "214.5%" },
    { type: "Night Shift", day: "Regular Holiday", formula: "2.00 × 1.10", coefficient: "2.2000", percentage: "220.0%" },
    { type: "Night Shift", day: "Regular Holiday on Rest Day", formula: "2.60 × 1.10", coefficient: "2.8600", percentage: "286.0%" },
    { type: "Night Shift", day: "Double Regular Holiday", formula: "3.00 × 1.10", coefficient: "3.3000", percentage: "330.0%" },
    { type: "Night Shift", day: "Double Regular Holiday on Rest Day", formula: "3.90 × 1.10", coefficient: "4.2900", percentage: "429.0%" },

    // --- OVERTIME ONLY (Base × 1.25 for Ordinary, Base × 1.3 for Premiums) ---
    { type: "Overtime (OT)", day: "Ordinary Day", formula: "1.00 × 1.25", coefficient: "1.2500", percentage: "125.0%" },
    { type: "Overtime (OT)", day: "Rest Day", formula: "1.30 × 1.30", coefficient: "1.6900", percentage: "169.0%" },
    { type: "Overtime (OT)", day: "Special (Non-Working) Day", formula: "1.30 × 1.30", coefficient: "1.6900", percentage: "169.0%" },
    { type: "Overtime (OT)", day: "Special (Non-Working) Day on Rest Day", formula: "1.50 × 1.30", coefficient: "1.9500", percentage: "195.0%" },
    { type: "Overtime (OT)", day: "Double Special (Non-Working) Day", formula: "1.50 × 1.30", coefficient: "1.9500", percentage: "195.0%" },
    { type: "Overtime (OT)", day: "Double Special Day on Rest Day", formula: "1.95 × 1.30", coefficient: "2.5350", percentage: "253.5%" },
    { type: "Overtime (OT)", day: "Regular Holiday", formula: "2.00 × 1.30", coefficient: "2.6000", percentage: "260.0%" },
    { type: "Overtime (OT)", day: "Regular Holiday on Rest Day", formula: "2.60 × 1.30", coefficient: "3.3800", percentage: "338.0%" },
    { type: "Overtime (OT)", day: "Double Regular Holiday", formula: "3.00 × 1.30", coefficient: "3.9000", percentage: "390.0%" },
    { type: "Overtime (OT)", day: "Double Regular Holiday on Rest Day", formula: "3.90 × 1.30", coefficient: "5.0700", percentage: "507.0%" },

    // --- COMPOUND NIGHT SHIFT OVERTIME (Base × 1.1 × OT) ---
    { type: "Night Shift OT", day: "Ordinary Day", formula: "1.00 × 1.10 × 1.25", coefficient: "1.3750", percentage: "137.5%" },
    { type: "Night Shift OT", day: "Rest Day", formula: "1.30 × 1.10 × 1.30", coefficient: "1.8590", percentage: "185.9%" },
    { type: "Night Shift OT", day: "Special (Non-Working) Day", formula: "1.30 × 1.10 × 1.30", coefficient: "1.8590", percentage: "185.9%" },
    { type: "Night Shift OT", day: "Special (Non-Working) Day on Rest Day", formula: "1.50 × 1.10 × 1.30", coefficient: "2.1450", percentage: "214.5%" },
    { type: "Night Shift OT", day: "Double Special (Non-Working) Day", formula: "1.50 × 1.10 × 1.30", coefficient: "2.1450", percentage: "214.5%" },
    { type: "Night Shift OT", day: "Double Special Day on Rest Day", formula: "1.95 × 1.10 × 1.30", coefficient: "2.7885", percentage: "278.85%" },
    { type: "Night Shift OT", day: "Regular Holiday", formula: "2.00 × 1.10 × 1.30", coefficient: "2.8600", percentage: "286.0%" },
    { type: "Night Shift OT", day: "Regular Holiday on Rest Day", formula: "2.60 × 1.10 × 1.30", coefficient: "3.7180", percentage: "371.8%" },
    { type: "Night Shift OT", day: "Double Regular Holiday", formula: "3.00 × 1.10 × 1.30", coefficient: "4.2900", percentage: "429.0%" },
    { type: "Night Shift OT", day: "Double Regular Holiday on Rest Day", formula: "3.90 × 1.10 × 1.30", coefficient: "5.5770", percentage: "557.7%" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Overtime & Night Shift Coefficients</h3>
        
        {/* NSD Base Config */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-sm font-bold text-slate-700">Night Shift Differential (NSD)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormInput label="Night Shift Premium Rate (%)" value="10" subtext="Statutory premium to base" />
            <FormInput label="Shift Start Time" value="10:00 pm" isText />
            <FormInput label="Shift End Time" value="06:00 am" isText />
          </div>
        </div>
      </div>

      {/* Overtime Premium Rates */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-sm font-bold text-slate-700">Overtime Premium Rates</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput label="Standard Ordinary Day OT Rate (%)" value="25" subtext="Yields total multiplier: 1.25" />
          <FormInput label="Premium Day Overtime Rate (%)" value="30" subtext="Applies to Holiday, Rest, Special Days" />
        </div>
      </div>

      {/* Dynamic Compound Reference Table */}
      <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs bg-white">
        <div className="bg-[#2A1B4E] text-white px-5 py-3.5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-purple-200" />
            <span className="text-sm font-semibold tracking-wide">Auto-Compiled Compound Coefficient Matrix (Read-Only)</span>
          </div>
          
          <div className="flex bg-white/10 p-1 rounded-lg border border-white/10 self-start sm:self-auto">
            <button
              onClick={() => setViewFormat('table')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewFormat === 'table' ? 'bg-white text-[#2A1B4E] shadow-xs' : 'text-purple-200 hover:text-white'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewFormat('card')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewFormat === 'card' ? 'bg-white text-[#2A1B4E] shadow-xs' : 'text-purple-200 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>
        </div>
        
        {viewFormat === 'table' ? (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 sticky top-0 z-10">
                  <th className="py-3 px-5">Scenario Type</th>
                  <th className="py-3 px-5">Day Classification</th>
                  <th className="py-3 px-5 font-mono">Computation Logic</th>
                  <th className="py-3 px-5 text-right font-mono">Hourly Multiplier</th>
                  <th className="py-3 px-5 text-right">Effective Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {matrixData.map((row, idx) => {
                  const badgeStyle = 
                    row.type === "Night Shift" ? "bg-blue-50 text-blue-700 border-blue-100" :
                    row.type === "Overtime (OT)" ? "bg-orange-50 text-orange-700 border-orange-100" :
                    "bg-purple-50 text-purple-700 border-purple-100";

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${badgeStyle}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="py-3 px-5 font-medium text-slate-800">{row.day}</td>
                      <td className="py-3 px-5 font-mono text-xs text-slate-400">{row.formula}</td>
                      <td className="py-3 px-5 font-mono text-sm font-semibold text-slate-600 text-right">{row.coefficient}</td>
                      <td className="py-3 px-5 text-right">
                        <span className="font-bold text-slate-900">{row.percentage}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 bg-slate-50/50 max-h-[500px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {matrixData.map((row, idx) => {
              const borderAccent = 
                row.type === "Night Shift" ? "border-t-blue-500" :
                row.type === "Overtime (OT)" ? "border-t-orange-500" :
                "border-t-purple-500";

              return (
                <div key={idx} className={`bg-white border border-slate-100 border-t-2 ${borderAccent} p-4 rounded-xl shadow-xs flex flex-col justify-between space-y-3`}>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                        {row.type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                        {row.formula}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">
                      {row.day}
                    </h4>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-slate-50 pt-2 mt-auto">
                    <span className="text-xs font-mono text-slate-500">x{row.coefficient}</span>
                    <span className="text-base font-bold text-slate-900">{row.percentage}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="bg-slate-50 px-5 py-2.5 border-t border-slate-100 text-[11px] text-slate-400">
          * Tables are automatically frozen and calculated using active base wage variables, statutory codes, and organizational policies.
        </div>
      </div>
    </div>
  );
}

{/* =========================================================================
    TAB PANEL 3: EEMR FACTORS
========================================================================= */}
function EEMRFactorsView() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Estimated Equivalent Monthly Rate (EEMR) Factors</h3>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-slate-700">Annual Operational Calendar Divisors</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput label="Factor 365 - Paid Every Day" value="365" subtext="Includes unworked rest days & holidays" />
            <FormInput label="Factor 313 - 6-Day Workweek" value="313" subtext="Rest days unworked/unpaid" />
            <FormInput label="Factor 261 - 5-Day Workweek" value="261" subtext="Saturdays & Sundays unworked/unpaid" />
            <FormInput label="Factor 395 - Worked Every Day" value="395" subtext="All days worked including holidays" />
          </div>
        </div>
      </div>

      <div className="border border-blue-100 bg-blue-50/30 rounded-xl p-5 space-y-4">
        <div className="flex items-center space-x-2 text-blue-700">
          <span className="w-4 h-4 border border-blue-500 rounded-full flex items-center justify-center text-[10px] font-bold">✓</span>
          <span className="text-sm font-bold">System-Wide Rule Intercepts</span>
        </div>
        <div className="space-y-3 bg-white border border-slate-100 rounded-lg p-2.5">
          <FormSwitch label="Auto-Adjust Leap Year Calendars" description="Dynamically injects +1 Day to active factor rules" defaultChecked />
          <hr className="border-slate-100" />
          <FormSwitch label="Apply 'No Work, No Pay' Logic" description="Deduct days taken off from workweek mid-month" defaultChecked />
        </div>
      </div>
    </div>
  );
}

{/* =========================================================================
    TAB PANEL 4: LEAVE CAPS
========================================================================= */}
function LeaveCapsView() {
  const [vlCredits, setVlCredits] = useState(7);
  const [slCredits, setSlCredits] = useState(7);
  const [lateFilingDays, setLateFilingDays] = useState(3);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Statutory Leave Thresholds & Accruals</h3>

      {/* Internal Organization Leave Controls */}
      <div className="border border-purple-100 bg-purple-50/10 p-5 rounded-xl space-y-4 mb-6">
        <div className="flex items-center space-x-2">
          <Settings className="w-4 h-4 text-purple-700" />
          <h4 className="text-sm font-bold text-purple-900">Internal Organization Leave Controls</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-lg border border-slate-100">
          <FormInput 
            label="Default Vacation Leave Credits" 
            type="number" 
            disabled={false} 
            value={vlCredits} 
            onChange={(e) => setVlCredits(e.target.value)}
            subtext="VL days given per employee annually" 
          />
          <FormInput 
            label="Default Sick Leave Credits" 
            type="number" 
            disabled={false} 
            value={slCredits} 
            onChange={(e) => setSlCredits(e.target.value)}
            subtext="SL days given per employee annually" 
          />
          <FormInput 
            label="Late Filing Notice for Vacation Leave" 
            type="number" 
            disabled={false} 
            value={lateFilingDays} 
            onChange={(e) => setLateFilingDays(e.target.value)}
            subtext="Minimum days advance notice required before VL start date" 
          />
        </div>
      </div>

      {/* SIL */}
      <div className="border-l-4 border-purple-500 bg-purple-50/20 p-4 rounded-r-xl space-y-4">
        <h4 className="text-sm font-bold text-purple-900">Service Incentive Leave (SIL)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput label="Paid Annual Allowance (Days/Year)" value="5" />
          <FormInput label="Service Tenure Trigger (Months)" value="12" />
        </div>
      </div>

      {/* Maternity Leave */}
      <div className="border-l-4 border-pink-500 bg-pink-50/10 p-4 rounded-r-xl space-y-4">
        <h4 className="text-sm font-bold text-pink-900">Expanded Maternity Leave (RA 11210)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput label="Standard Live Birth (Days)" value="105" />
          <FormInput label="Solo Parent (Days)" value="120" />
          <FormInput label="Miscarriage/ETP (Days)" value="60" />
        </div>
      </div>

      {/* Paternity Leave */}
      <div className="border-l-4 border-blue-500 bg-blue-50/10 p-4 rounded-r-xl space-y-4">
        <h4 className="text-sm font-bold text-blue-900">Paternity Leave (RA 8187)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput label="Paid Core Allowance (Days)" value="7" />
          <FormInput label="Max Deliveries Cap" value="4" subtext="First deliveries only" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-slate-100 p-4 rounded-xl space-y-3">
          <FormInput label="Solo Parent Leave (Days/Year)" value="7" />
        </div>
        <div className="border border-slate-100 p-4 rounded-xl space-y-3">
          <FormInput label="VAWC Leave (Days/Year)" value="10" />
        </div>
      </div>
    </div>
  );
}

{/* =========================================================================
    TAB PANEL 5: GOVERNMENT TAXES
========================================================================= */}
function GovernmentTaxesView() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Government Taxes & Deduction Matrices</h3>

      <div className="border border-emerald-100 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-emerald-800 border-b border-emerald-50/80 pb-2">
          PhilHealth Direct Contributors Premium (RA 11223)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput label="Premium Contribution Rate (%)" value="5" subtext="Of Monthly Basic Salary" />
          <FormInput label="Employee Share Ratio (%)" value="50" subtext="Employer matches remaining" />
          <FormInput label="Minimum Salary Floor (₱)" value="10000" />
          <FormInput label="Maximum Salary Cap (₱)" value="100000" />
        </div>
      </div>

      <div className="border border-blue-100 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-blue-800 border-b border-blue-50/80 pb-2">
          SSS Social Security Matrix (RA 11199)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput label="Combined Total Rate (%)" value="15" />
          <FormInput label="Employer Share (%)" value="10" />
          <FormInput label="Employee Share (%)" value="5" />
          <FormInput label="Lower MSC Bound (₱)" value="5000" />
          <FormInput label="Upper MSC Bound (₱)" value="35000" />
          <FormInput label="MPF Threshold (₱)" value="20000" />
          <div className="md:col-span-1">
            <FormInput label="EC Contribution (Below ₱15K)" value="10" />
          </div>
          <div className="md:col-span-2">
            <FormInput label="EC Contribution (≥ ₱15K)" value="30" />
          </div>
        </div>
      </div>

      <div className="border border-orange-100 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-orange-800 border-b border-orange-50/80 pb-2">
          Pag-IBIG (HDMF) Savings Contributions
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput label="EE Rate (≤ ₱1,500) (%)" value="1" />
          <FormInput label="EE Rate (> ₱1,500) (%)" value="2" />
          <FormInput label="Employer Rate (%)" value="2" subtext="Fixed uniform rate" />
          <FormInput label="Maximum Fund Salary (₱)" value="10000" subtext="Caps computational basis" />
        </div>
      </div>
    </div>
  );
}

{/* =========================================================================
    REUSABLE ATOMIC UI PATTERNS
========================================================================= */}
function FormInput({ label, value, subtext, isText = false, type = "text", disabled = true, onChange }) {
  return (
    <div className="space-y-1.5 flex-1 w-full text-left">
      <label className="block text-xs font-medium text-slate-500 tracking-wide">
        {label}
      </label>
      <input
        type={type}
        disabled={disabled}
        value={value}
        onChange={onChange}
        className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium transition focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-100 ${
          disabled ? 'bg-slate-50/80' : 'bg-white shadow-xs'
        } ${!isText && type !== "number" ? 'font-mono' : ''}`}
      />
      {subtext && <p className="text-[11px] text-slate-400 font-normal leading-relaxed">{subtext}</p>}
    </div>
  );
}

function StaticMetricBox({ title, value, subtext }) {
  return (
    <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs space-y-1 flex flex-col justify-between text-left">
      <div>
        <div className="text-xs font-medium text-slate-400 line-clamp-1 mb-1">{title}</div>
        <div className="text-lg font-bold text-slate-800 font-mono">{value}</div>
      </div>
      <div className="text-[11px] text-slate-400 border-t border-slate-50 pt-1 mt-2 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
        {subtext}
      </div>
    </div>
  );
}

function FormSwitch({ label, description, defaultChecked }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between py-2 px-2">
      <div className="space-y-0.5 text-left">
        <div className="text-xs font-semibold text-slate-700">{label}</div>
        <div className="text-[11px] text-slate-400">{description}</div>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
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