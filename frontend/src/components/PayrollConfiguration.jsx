import React, { useState, useEffect } from 'react';
import { 
  User, Shield, Bell, Server, DollarSign, Settings,
  Clock, Briefcase, FileText, Landmark, Eye, Edit3, Info, Grid, LayoutList, Save, X
} from 'lucide-react';
import ConfigurationPreviewModal from './ConfigurationPreviewModal';

const DEFAULT_RATES = {
  metadata: {
    schemaVersion: "2026.1.1",
    effectiveDate: "2026-05-20",
    status: "LIVE",
    cutoffScheme: "semi-monthly"
  },
  shiftConfig: {
    morningShiftStart: "08:30",
    morningShiftEnd: "17:30",
    eveningShiftStart: "20:30",
    eveningShiftEnd: "05:30"
  },
  laborRates: {
    ordinary: 1.0,
    restDay: 1.3,
    specialDay: 1.3,
    regularHoliday: 2.0,
    doubleHoliday: 3.0,
    doubleSpecialDay: 1.5,
    specialDayRestDay: 1.5,
    doubleSpecialDayRestDay: 1.95,
    regularHolidayRestDay: 2.6,
    doubleHolidayRestDay: 3.9
  },
  otNightRates: {
    nsdRate: 10,
    shiftStart: "10:00 pm",
    shiftEnd: "06:00 am",
    ordinaryOT: 25,
    premiumOT: 30
  },
  statutoryConstants: {
    sss: {
      employer_rate: 0.10,
      employee_rate: 0.05,
      msc_floor: 5000,
      msc_ceiling: 35000,
      ec_threshold: 15000,
      ec_low: 10,
      ec_high: 30
    },
    philhealth: {
      rate: 0.05,
      floor: 10000,
      ceiling: 100000,
      share_ratio: 0.50
    },
    hdmf: {
      ee_rate_low: 0.01,
      ee_rate_high: 0.02,
      er_rate: 0.02,
      ceiling: 10000,
      threshold: 1500
    }
  }
};

/**
 * Normalizes statutory constants from various possible backend formats 
 * (nested, flat legacy, or empty) into the canonical nested structure.
 */
const normalizeStatutory = (input) => {
  const base = DEFAULT_RATES.statutoryConstants;
  if (!input) {
    // Convert base defaults to percentages
    return {
      sss: { ...base.sss, employer_rate: base.sss.employer_rate * 100, employee_rate: base.sss.employee_rate * 100 },
      philhealth: { ...base.philhealth, rate: base.philhealth.rate * 100, share_ratio: base.philhealth.share_ratio * 100 },
      hdmf: { ...base.hdmf, ee_rate_low: base.hdmf.ee_rate_low * 100, ee_rate_high: base.hdmf.ee_rate_high * 100, er_rate: base.hdmf.er_rate * 100 }
    };
  }
  
  const result = JSON.parse(JSON.stringify(base));
  
  if (input.sss && input.philhealth && input.hdmf) {
    // Nested structure present
    result.sss = { ...base.sss, ...input.sss, employer_rate: (input.sss.employer_rate <= 1 ? input.sss.employer_rate * 100 : input.sss.employer_rate), employee_rate: (input.sss.employee_rate <= 1 ? input.sss.employee_rate * 100 : input.sss.employee_rate) };
    result.philhealth = { ...base.philhealth, ...input.philhealth, rate: (input.philhealth.rate <= 1 ? input.philhealth.rate * 100 : input.philhealth.rate), share_ratio: (input.philhealth.share_ratio <= 1 ? input.philhealth.share_ratio * 100 : input.philhealth.share_ratio) };
    result.hdmf = { ...base.hdmf, ...input.hdmf, ee_rate_low: (input.hdmf.ee_rate_low <= 1 ? input.hdmf.ee_rate_low * 100 : input.hdmf.ee_rate_low), ee_rate_high: (input.hdmf.ee_rate_high <= 1 ? input.hdmf.ee_rate_high * 100 : input.hdmf.ee_rate_high), er_rate: (input.hdmf.er_rate <= 1 ? input.hdmf.er_rate * 100 : input.hdmf.er_rate) };
  } else {
    // Flat legacy structure
    if (input.sssRate !== undefined) result.sss.employee_rate = input.sssRate;
    if (input.philhealthRate !== undefined) result.philhealth.rate = input.philhealthRate;
    if (input.pagibigEmployee !== undefined) result.hdmf.ee_rate_high = (input.pagibigEmployee / 5000) * 100;
  }
  
  return result;
};

export default function PayrollConfiguration({ data, onUpdate }) {
  const [activeTab, setActiveTab] = useState('labor-rates');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Robust initialization that ensures nested objects exist
  const [localData, setLocalData] = useState(() => {
    const base = (data && Object.keys(data).length > 0) ? data : DEFAULT_RATES;
    const rawStatutory = base.statutoryConstants || base.payrollRates?.statutoryConstants || base.payroll;
    
    return {
      ...DEFAULT_RATES,
      ...base,
      laborRates: { ...DEFAULT_RATES.laborRates, ...(base.laborRates || {}) },
      shiftConfig: { ...DEFAULT_RATES.shiftConfig, ...(base.shiftConfig || {}) },
      otNightRates: { ...DEFAULT_RATES.otNightRates, ...(base.otNightRates || {}) },
      statutoryConstants: normalizeStatutory(rawStatutory)
    };
  });

  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      const rawStatutory = data.statutoryConstants || data.payrollRates?.statutoryConstants || data.payroll;
      setLocalData(prev => ({
        ...DEFAULT_RATES,
        ...prev, // Keep current local changes
        ...data,
        laborRates: { ...DEFAULT_RATES.laborRates, ...(data.laborRates || prev.laborRates) },
        shiftConfig: { ...DEFAULT_RATES.shiftConfig, ...(data.shiftConfig || prev.shiftConfig) },
        otNightRates: { ...DEFAULT_RATES.otNightRates, ...(data.otNightRates || prev.otNightRates) },
        statutoryConstants: normalizeStatutory(rawStatutory)
      }));
    }
  }, [data]);

  const handleSave = () => {
    const sanitize = (val) => {
      if (typeof val === 'string') return parseFloat(val.replace(/,/g, '')) || 0;
      return parseFloat(val) || 0;
    };

    const s = localData.statutoryConstants;
    const sanitizedStatutory = {
      ...s,
      philhealth: {
        ...s.philhealth,
        rate: sanitize(s.philhealth.rate) / 100,
        share_ratio: sanitize(s.philhealth.share_ratio) / 100,
        floor: sanitize(s.philhealth.floor),
        ceiling: sanitize(s.philhealth.ceiling)
      },
      sss: {
        ...s.sss,
        employer_rate: sanitize(s.sss.employer_rate) / 100,
        employee_rate: sanitize(s.sss.employee_rate) / 100,
        msc_floor: sanitize(s.sss.msc_floor),
        msc_ceiling: sanitize(s.sss.msc_ceiling),
        ec_low: sanitize(s.sss.ec_low),
        ec_high: sanitize(s.sss.ec_high)
      },
      hdmf: {
        ...s.hdmf,
        ee_rate_low: sanitize(s.hdmf.ee_rate_low) / 100,
        ee_rate_high: sanitize(s.hdmf.ee_rate_high) / 100,
        er_rate: sanitize(s.hdmf.er_rate) / 100,
        ceiling: sanitize(s.hdmf.ceiling)
      }
    };

    const backendData = {
      ...localData.metadata,
      ...localData.shiftConfig,
      ordinaryDayRate: sanitize(localData.laborRates.ordinary),
      specialDayRate: sanitize(localData.laborRates.specialDay),
      restDayRate: sanitize(localData.laborRates.restDay),
      regularHolidayRate: sanitize(localData.laborRates.regularHoliday),
      doubleRegularHolidayRate: sanitize(localData.laborRates.doubleHoliday),
      doubleSpecialDayRate: sanitize(localData.laborRates.doubleSpecialDay),
      specialDayRestDayRate: sanitize(localData.laborRates.specialDayRestDay),
      regularHolidayRestDayRate: sanitize(localData.laborRates.regularHolidayRestDay),
      doubleRegularHolidayRestDayRate: sanitize(localData.laborRates.doubleHolidayRestDay),
      doubleSpecialDayRestDayRate: sanitize(localData.laborRates.doubleSpecialDayRestDay),
      nightDiffRate: 1 + (sanitize(localData.otNightRates.nsdRate) / 100),
      overtimeRate: 1 + (sanitize(localData.otNightRates.ordinaryOT) / 100),
      payrollRates: {
        ...localData,
        laborRates: Object.fromEntries(Object.entries(localData.laborRates).map(([k, v]) => [k, sanitize(v)])),
        otNightRates: Object.fromEntries(Object.entries(localData.otNightRates).map(([k, v]) => [k, sanitize(v)])),
        statutoryConstants: sanitizedStatutory
      },
      payroll: sanitizedStatutory 
    };
    onUpdate(backendData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalData(data || DEFAULT_RATES);
    setIsEditing(false);
  };

  const updateField = (category, field, value) => {
    setLocalData(prev => {
      const updated = {
        ...prev,
        [category]: {
          ...prev[category],
          [field]: value
        }
      };
      
      const sanitize = (val) => {
        if (typeof val === 'string') return parseFloat(val.replace(/,/g, '')) || 0;
        return parseFloat(val) || 0;
      };

      if (category === 'laborRates') {
        const ordinary = sanitize(updated.laborRates.ordinary);
        const restDay = sanitize(updated.laborRates.restDay);
        const regularHoliday = sanitize(updated.laborRates.regularHoliday);
        const doubleHoliday = sanitize(updated.laborRates.doubleHoliday);
        const doubleSpecialDay = sanitize(updated.laborRates.doubleSpecialDay);

        if (['ordinary', 'restDay', 'regularHoliday', 'doubleHoliday', 'doubleSpecialDay'].includes(field)) {
          updated.laborRates.specialDayRestDay = parseFloat((ordinary + 0.5).toFixed(2));
          updated.laborRates.regularHolidayRestDay = parseFloat((regularHoliday * restDay).toFixed(2));
          updated.laborRates.doubleHolidayRestDay = parseFloat((doubleHoliday * restDay).toFixed(2));
          updated.laborRates.doubleSpecialDayRestDay = parseFloat((doubleSpecialDay * restDay).toFixed(2));
        }
      }
      return updated;
    });
  };

  const updateStatutory = (section, field, value) => {
    setLocalData(prev => ({
      ...prev,
      statutoryConstants: {
        ...prev.statutoryConstants,
        [section]: {
          ...prev.statutoryConstants[section],
          [field]: value
        }
      }
    }));
  };


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
            {isEditing ? (
              <>
                <button 
                  onClick={handleCancel}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  <X className="w-4 h-4" /> <span>Cancel</span>
                </button>
                <button 
                  onClick={handleSave}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  <Save className="w-4 h-4" /> <span>Save Changes</span>
                </button>
              </>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-lg text-sm font-medium shadow-sm transition"
              >
                <Edit3 className="w-4 h-4" /> <span>Edit Configuration</span>
              </button>
            )}
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white border border-slate-100 rounded-xl p-4 shadow-sm text-sm">
          <div className="flex flex-col justify-center items-start pl-2 space-y-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tight">Schema Version</span>
            {isEditing ? (
              <input 
                type="text" 
                value={localData.metadata?.schemaVersion || ""} 
                onChange={(e) => updateField('metadata', 'schemaVersion', e.target.value)}
                className="font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs w-full focus:outline-none"
              />
            ) : (
              <span className="font-bold text-slate-700">{localData.metadata?.schemaVersion || "2026.1.0"}</span>
            )}
          </div>
          <div className="flex flex-col justify-center items-start md:border-x md:border-slate-100 md:px-6 space-y-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tight">Effective Date</span>
            {isEditing ? (
              <input 
                type="date" 
                value={localData.metadata?.effectiveDate || ""} 
                onChange={(e) => updateField('metadata', 'effectiveDate', e.target.value)}
                className="font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs w-full focus:outline-none"
              />
            ) : (
              <span className="font-bold text-slate-700">{localData.metadata?.effectiveDate || "2026-01-01"}</span>
            )}
          </div>
          <div className="flex flex-col justify-center items-start md:border-r md:border-slate-100 md:px-6 space-y-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tight">Status</span>
            {isEditing ? (
              <select
                value={localData.metadata?.status || "LIVE"}
                onChange={(e) => updateField('metadata', 'status', e.target.value)}
                className="font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs w-full focus:outline-none cursor-pointer"
              >
                <option value="LIVE">LIVE</option>
                <option value="DRAFT">DRAFT</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            ) : (
              <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                localData.metadata?.status === 'LIVE' || !localData.metadata?.status
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {localData.metadata?.status === 'LIVE' || !localData.metadata?.status ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ) : null}
                <span>{localData.metadata?.status || "LIVE"}</span>
              </span>
            )}
          </div>
          {/* Changeable Cutoff Scheme Selector Dropdown */}
          <div className="flex flex-col justify-center items-start md:pl-6 space-y-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tight">Cutoff Scheme</span>
            <select
              value={localData.metadata?.cutoffScheme || "semi-monthly"}
              onChange={(e) => updateField('metadata', 'cutoffScheme', e.target.value)}
              disabled={!isEditing}
              className={`font-bold text-[#2A1B4E] bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 transition ${isEditing ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
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
              { id: 'ot-night', label: 'OT & Night Shift', icon: Shield },
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
            {activeTab === 'labor-rates' && (
              <LaborRatesView 
                data={localData.laborRates} 
                isEditing={isEditing} 
                onChange={(f, v) => updateField('laborRates', f, v)} 
              />
            )}
            {activeTab === 'ot-night' && (
              <OvertimeNightShiftView 
                data={localData.otNightRates} 
                laborRates={localData.laborRates}
                isEditing={isEditing} 
                onChange={(f, v) => updateField('otNightRates', f, v)} 
              />
            )}
            {activeTab === 'eemr' && <EEMRFactorsView />}
            {activeTab === 'leave-caps' && <LeaveCapsView />}
            {activeTab === 'gov-taxes' && (
              <GovernmentTaxesView 
                data={localData.statutoryConstants} 
                isEditing={isEditing} 
                onChange={updateStatutory} 
              />
            )}
          </div>
        </div>

      </main>

      {isPreviewOpen && (
        <ConfigurationPreviewModal data={localData} onClose={() => setIsPreviewOpen(false)} />
      )}
    </div>
  );
}

{/* =========================================================================
    TAB PANEL 1: LABOR RATES
========================================================================= */}
function LaborRatesView({ data, isEditing, onChange }) {
  const [viewFormat, setViewFormat] = useState('card');

  if (!data) return <div className="p-8 text-center text-slate-400">Loading labor rates...</div>;

  const compoundLaborData = [
    { type: "Special Day Combo", day: "Special Day on Rest Day", formula: `Base ${(data.ordinary || 0).toFixed(1)} + 30% + 20% rest shift`, coefficient: data.specialDayRestDay, percentage: `${((data.specialDayRestDay || 0) * 100).toFixed(1)}%` },
    { type: "Holiday Combo", day: "Regular Holiday on Rest Day", formula: `Base ${(data.regularHoliday || 0).toFixed(1)} × ${(data.restDay || 0).toFixed(2)} rest index`, coefficient: data.regularHolidayRestDay, percentage: `${((data.regularHolidayRestDay || 0) * 100).toFixed(1)}%` },
    { type: "Holiday Combo", day: "Double Holiday on Rest Day", formula: `Base ${(data.doubleHoliday || 0).toFixed(1)} × ${(data.restDay || 0).toFixed(2)} rest index`, coefficient: data.doubleHolidayRestDay, percentage: `${((data.doubleHolidayRestDay || 0) * 100).toFixed(1)}%` },
    { type: "Special Day Combo", day: "Double Special Day on Rest Day", formula: `Base ${(data.doubleSpecialDay || 0).toFixed(1)} × ${(data.restDay || 0).toFixed(2)} rest index`, coefficient: data.doubleSpecialDayRestDay, percentage: `${((data.doubleSpecialDayRestDay || 0) * 100).toFixed(1)}%` }
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
            <FormInput 
              label="Ordinary Workday Multiplier" 
              type="number"
              value={data.ordinary} 
              onChange={(e) => onChange('ordinary', e.target.value)}
              disabled={!isEditing}
              subtext="Default Baseline Value" 
            />
            <FormInput 
              label="Rest Day Premium Rate" 
              type="number"
              value={data.restDay} 
              onChange={(e) => onChange('restDay', e.target.value)}
              disabled={!isEditing}
              subtext="+30% statutory premium" 
            />
            <FormInput 
              label="Special Non-Working Day Premium" 
              type="number"
              value={data.specialDay} 
              onChange={(e) => onChange('specialDay', e.target.value)}
              disabled={!isEditing}
              subtext="+30% statutory premium" 
            />
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
          <FormInput 
            label="Regular Holiday Multiplier" 
            type="number"
            value={data.regularHoliday} 
            onChange={(e) => onChange('regularHoliday', e.target.value)}
            disabled={!isEditing}
            subtext="200% unworked/worked base" 
          />
          <FormInput 
            label="Double Regular Holiday Multiplier" 
            type="number"
            value={data.doubleHoliday} 
            onChange={(e) => onChange('doubleHoliday', e.target.value)}
            disabled={!isEditing}
            subtext="300% worked base" 
          />
          <FormInput 
            label="Double Special Non-Working Day" 
            type="number"
            value={data.doubleSpecialDay} 
            onChange={(e) => onChange('doubleSpecialDay', e.target.value)}
            disabled={!isEditing}
            subtext="150% worked base" 
          />
        </div>
      </div>

      {/* Compound Intersection Multipliers (New) */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-bold text-slate-700">Compound Intersection Multipliers</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormInput 
            label="Special Day on Rest Day" 
            type="number"
            value={data.specialDayRestDay} 
            onChange={(e) => onChange('specialDayRestDay', e.target.value)}
            disabled={!isEditing}
            subtext="150% worked base" 
          />
          <FormInput 
            label="Regular Holiday on Rest Day" 
            type="number"
            value={data.regularHolidayRestDay} 
            onChange={(e) => onChange('regularHolidayRestDay', e.target.value)}
            disabled={!isEditing}
            subtext="260% worked base" 
          />
          <FormInput 
            label="Double Holiday on Rest Day" 
            type="number"
            value={data.doubleHolidayRestDay} 
            onChange={(e) => onChange('doubleHolidayRestDay', e.target.value)}
            disabled={!isEditing}
            subtext="390% worked base" 
          />
          <FormInput 
            label="Double Special on Rest Day" 
            type="number"
            value={data.doubleSpecialDayRestDay} 
            onChange={(e) => onChange('doubleSpecialDayRestDay', e.target.value)}
            disabled={!isEditing}
            subtext="195% worked base" 
          />
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
function OvertimeNightShiftView({ data, laborRates, isEditing, onChange }) {
  const [viewFormat, setViewFormat] = useState('table');

  if (!data || !laborRates) return <div className="p-8 text-center text-slate-400">Loading OT & Night Shift rates...</div>;

  const nsd = (data.nsdRate || 0) / 100 + 1; // e.g. 1.1
  const otOrd = (data.ordinaryOT || 0) / 100 + 1; // e.g. 1.25
  const otPrem = (data.premiumOT || 0) / 100 + 1; // e.g. 1.3

  const matrixData = [
    // --- NIGHT SHIFT ONLY (Base × 1.1) ---
    { type: "Night Shift", day: "Ordinary Day", formula: `${(laborRates.ordinary || 0).toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: ((laborRates.ordinary || 0) * nsd).toFixed(4), percentage: `${((laborRates.ordinary || 0) * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Rest Day", formula: `${(laborRates.restDay || 0).toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: ((laborRates.restDay || 0) * nsd).toFixed(4), percentage: `${((laborRates.restDay || 0) * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Special (Non-Working) Day", formula: `${(laborRates.specialDay || 0).toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: ((laborRates.specialDay || 0) * nsd).toFixed(4), percentage: `${((laborRates.specialDay || 0) * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Special (Non-Working) Day on Rest Day", formula: `${(laborRates.specialDayRestDay || 0).toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: ((laborRates.specialDayRestDay || 0) * nsd).toFixed(4), percentage: `${((laborRates.specialDayRestDay || 0) * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Double Special (Non-Working) Day", formula: `${(laborRates.doubleSpecialDay || 0).toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: ((laborRates.doubleSpecialDay || 0) * nsd).toFixed(4), percentage: `${((laborRates.doubleSpecialDay || 0) * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Double Special Day on Rest Day", formula: `${(laborRates.doubleSpecialDayRestDay || 0).toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: ((laborRates.doubleSpecialDayRestDay || 0) * nsd).toFixed(4), percentage: `${((laborRates.doubleSpecialDayRestDay || 0) * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Regular Holiday", formula: `${(laborRates.regularHoliday || 0).toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: ((laborRates.regularHoliday || 0) * nsd).toFixed(4), percentage: `${((laborRates.regularHoliday || 0) * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Regular Holiday on Rest Day", formula: `${(laborRates.regularHolidayRestDay || 0).toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: ((laborRates.regularHolidayRestDay || 0) * nsd).toFixed(4), percentage: `${((laborRates.regularHolidayRestDay || 0) * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Double Regular Holiday", formula: `${(laborRates.doubleHoliday || 0).toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: ((laborRates.doubleHoliday || 0) * nsd).toFixed(4), percentage: `${((laborRates.doubleHoliday || 0) * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Double Regular Holiday on Rest Day", formula: `${(laborRates.doubleHolidayRestDay || 0).toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: ((laborRates.doubleHolidayRestDay || 0) * nsd).toFixed(4), percentage: `${((laborRates.doubleHolidayRestDay || 0) * nsd * 100).toFixed(1)}%` },

    // --- OVERTIME ONLY (Base × 1.25 for Ordinary, Base × 1.3 for Premiums) ---
    { type: "Overtime (OT)", day: "Ordinary Day", formula: `${(laborRates.ordinary || 0).toFixed(2)} × ${otOrd.toFixed(2)}`, coefficient: ((laborRates.ordinary || 0) * otOrd).toFixed(4), percentage: `${((laborRates.ordinary || 0) * otOrd * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Rest Day", formula: `${(laborRates.restDay || 0).toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.restDay || 0) * otPrem).toFixed(4), percentage: `${((laborRates.restDay || 0) * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Special (Non-Working) Day", formula: `${(laborRates.specialDay || 0).toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.specialDay || 0) * otPrem).toFixed(4), percentage: `${((laborRates.specialDay || 0) * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Special (Non-Working) Day on Rest Day", formula: `${(laborRates.specialDayRestDay || 0).toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.specialDayRestDay || 0) * otPrem).toFixed(4), percentage: `${((laborRates.specialDayRestDay || 0) * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Double Special (Non-Working) Day", formula: `${(laborRates.doubleSpecialDay || 0).toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.doubleSpecialDay || 0) * otPrem).toFixed(4), percentage: `${((laborRates.doubleSpecialDay || 0) * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Double Special Day on Rest Day", formula: `${(laborRates.doubleSpecialDayRestDay || 0).toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.doubleSpecialDayRestDay || 0) * otPrem).toFixed(4), percentage: `${((laborRates.doubleSpecialDayRestDay || 0) * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Regular Holiday", formula: `${(laborRates.regularHoliday || 0).toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.regularHoliday || 0) * otPrem).toFixed(4), percentage: `${((laborRates.regularHoliday || 0) * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Regular Holiday on Rest Day", formula: `${(laborRates.regularHolidayRestDay || 0).toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.regularHolidayRestDay || 0) * otPrem).toFixed(4), percentage: `${((laborRates.regularHolidayRestDay || 0) * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Double Regular Holiday", formula: `${(laborRates.doubleHoliday || 0).toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.doubleHoliday || 0) * otPrem).toFixed(4), percentage: `${((laborRates.doubleHoliday || 0) * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Double Regular Holiday on Rest Day", formula: `${(laborRates.doubleHolidayRestDay || 0).toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.doubleHolidayRestDay || 0) * otPrem).toFixed(4), percentage: `${((laborRates.doubleHolidayRestDay || 0) * otPrem * 100).toFixed(1)}%` },

    // --- COMPOUND NIGHT SHIFT OVERTIME (Base × 1.1 × OT) ---
    { type: "Night Shift OT", day: "Ordinary Day", formula: `${(laborRates.ordinary || 0).toFixed(2)} × ${nsd.toFixed(2)} × ${otOrd.toFixed(2)}`, coefficient: ((laborRates.ordinary || 0) * nsd * otOrd).toFixed(4), percentage: `${((laborRates.ordinary || 0) * nsd * otOrd * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Rest Day", formula: `${(laborRates.restDay || 0).toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.restDay || 0) * nsd * otPrem).toFixed(4), percentage: `${((laborRates.restDay || 0) * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Special (Non-Working) Day", formula: `${(laborRates.specialDay || 0).toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.specialDay || 0) * nsd * otPrem).toFixed(4), percentage: `${((laborRates.specialDay || 0) * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Special (Non-Working) Day on Rest Day", formula: `${(laborRates.specialDayRestDay || 0).toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.specialDayRestDay || 0) * nsd * otPrem).toFixed(4), percentage: `${((laborRates.specialDayRestDay || 0) * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Double Special (Non-Working) Day", formula: `${(laborRates.doubleSpecialDay || 0).toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.doubleSpecialDay || 0) * nsd * otPrem).toFixed(4), percentage: `${((laborRates.doubleSpecialDay || 0) * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Double Special Day on Rest Day", formula: `${(laborRates.doubleSpecialDayRestDay || 0).toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.doubleSpecialDayRestDay || 0) * nsd * otPrem).toFixed(4), percentage: `${((laborRates.doubleSpecialDayRestDay || 0) * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Regular Holiday", formula: `${(laborRates.regularHoliday || 0).toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.regularHoliday || 0) * nsd * otPrem).toFixed(4), percentage: `${((laborRates.regularHoliday || 0) * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Regular Holiday on Rest Day", formula: `${(laborRates.regularHolidayRestDay || 0).toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.regularHolidayRestDay || 0) * nsd * otPrem).toFixed(4), percentage: `${((laborRates.regularHolidayRestDay || 0) * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Double Regular Holiday", formula: `${(laborRates.doubleHoliday || 0).toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.doubleHoliday || 0) * nsd * otPrem).toFixed(4), percentage: `${((laborRates.doubleHoliday || 0) * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Double Regular Holiday on Rest Day", formula: `${(laborRates.doubleHolidayRestDay || 0).toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: ((laborRates.doubleHolidayRestDay || 0) * nsd * otPrem).toFixed(4), percentage: `${((laborRates.doubleHolidayRestDay || 0) * nsd * otPrem * 100).toFixed(1)}%` },
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
            <FormInput 
              label="Night Shift Premium Rate (%)" 
              type="number"
              value={data.nsdRate} 
              onChange={(e) => onChange('nsdRate', e.target.value)}
              disabled={!isEditing}
              subtext="Statutory premium to base" 
            />
            <FormInput 
              label="Shift Start Time" 
              value={data.shiftStart} 
              onChange={(e) => onChange('shiftStart', e.target.value)}
              disabled={!isEditing}
              isText 
            />
            <FormInput 
              label="Shift End Time" 
              value={data.shiftEnd} 
              onChange={(e) => onChange('shiftEnd', e.target.value)}
              disabled={!isEditing}
              isText 
            />
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
          <FormInput 
            label="Standard Ordinary Day OT Rate (%)" 
            type="number"
            value={data.ordinaryOT} 
            onChange={(e) => onChange('ordinaryOT', e.target.value)}
            disabled={!isEditing}
            subtext="Yields total multiplier: 1.25" 
          />
          <FormInput 
            label="Premium Day Overtime Rate (%)" 
            type="number"
            value={data.premiumOT} 
            onChange={(e) => onChange('premiumOT', e.target.value)}
            disabled={!isEditing}
            subtext="Applies to Holiday, Rest, Special Days" 
          />
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
function GovernmentTaxesView({ data, isEditing, onChange }) {
  if (!data || !data.philhealth || !data.sss || !data.hdmf) return <div className="p-10 text-center text-slate-400">Loading statutory matrix...</div>;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Government Taxes & Deduction Matrices</h3>

      {/* PhilHealth */}
      <div className="border border-emerald-100 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-emerald-800 border-b border-emerald-50/80 pb-2">
          PhilHealth Direct Contributors Premium (RA 11223)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput 
            label="Premium Contribution Rate (%)" 
            type="number"
            value={data.philhealth.rate} 
            onChange={(e) => onChange('philhealth', 'rate', e.target.value)}
            disabled={!isEditing}
            subtext="Of Monthly Basic Salary" 
          />
          <FormInput 
            label="Employee Share Ratio (%)" 
            type="number"
            value={data.philhealth.share_ratio} 
            onChange={(e) => onChange('philhealth', 'share_ratio', e.target.value)}
            disabled={!isEditing}
            subtext="Employer matches remaining" 
          />
          <FormInput 
            label="Minimum Salary Floor (₱)" 
            type="number"
            value={data.philhealth.floor} 
            onChange={(e) => onChange('philhealth', 'floor', e.target.value)}
            disabled={!isEditing}
          />
          <FormInput 
            label="Maximum Salary Cap (₱)" 
            type="number"
            value={data.philhealth.ceiling} 
            onChange={(e) => onChange('philhealth', 'ceiling', e.target.value)}
            disabled={!isEditing}
          />
        </div>
      </div>

      {/* SSS */}
      <div className="border border-blue-100 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-blue-800 border-b border-blue-50/80 pb-2">
          SSS Social Security Matrix (RA 11199)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput 
            label="Employer Share (%)" 
            type="number"
            value={data.sss.employer_rate} 
            onChange={(e) => onChange('sss', 'employer_rate', e.target.value)}
            disabled={!isEditing}
          />
          <FormInput 
            label="Employee Share (%)" 
            type="number"
            value={data.sss.employee_rate} 
            onChange={(e) => onChange('sss', 'employee_rate', e.target.value)}
            disabled={!isEditing}
          />
          <FormInput 
            label="Lower MSC Bound (₱)" 
            type="number"
            value={data.sss.msc_floor} 
            onChange={(e) => onChange('sss', 'msc_floor', e.target.value)}
            disabled={!isEditing}
          />
          <FormInput 
            label="Upper MSC Bound (₱)" 
            type="number"
            value={data.sss.msc_ceiling} 
            onChange={(e) => onChange('sss', 'msc_ceiling', e.target.value)}
            disabled={!isEditing}
          />
          <FormInput 
            label="EC Contribution (Below ₱15K)" 
            type="number"
            value={data.sss.ec_low} 
            onChange={(e) => onChange('sss', 'ec_low', e.target.value)}
            disabled={!isEditing}
          />
          <FormInput 
            label="EC Contribution (≥ ₱15K)" 
            type="number"
            value={data.sss.ec_high} 
            onChange={(e) => onChange('sss', 'ec_high', e.target.value)}
            disabled={!isEditing}
          />
        </div>
      </div>

      {/* Pag-IBIG */}
      <div className="border border-orange-100 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-orange-800 border-b border-orange-50/80 pb-2">
          Pag-IBIG (HDMF) Savings Contributions
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput 
            label="EE Rate (≤ ₱1,500) (%)" 
            type="number"
            value={data.hdmf.ee_rate_low} 
            onChange={(e) => onChange('hdmf', 'ee_rate_low', e.target.value)}
            disabled={!isEditing}
          />
          <FormInput 
            label="EE Rate (> ₱1,500) (%)" 
            type="number"
            value={data.hdmf.ee_rate_high} 
            onChange={(e) => onChange('hdmf', 'ee_rate_high', e.target.value)}
            disabled={!isEditing}
          />
          <FormInput 
            label="Employer Rate (%)" 
            type="number"
            value={data.hdmf.er_rate} 
            onChange={(e) => onChange('hdmf', 'er_rate', e.target.value)}
            disabled={!isEditing}
            subtext="Fixed uniform rate" 
          />
          <FormInput 
            label="Maximum Fund Salary (₱)" 
            type="number"
            value={data.hdmf.ceiling} 
            onChange={(e) => onChange('hdmf', 'ceiling', e.target.value)}
            disabled={!isEditing}
            subtext="Caps computational basis" 
          />
        </div>
      </div>
    </div>
  );
}

{/* =========================================================================
    REUSABLE ATOMIC UI PATTERNS
========================================================================= */}
function FormInput({ label, value, subtext, isText = false, type = "text", step = "any", disabled = true, onChange }) {
  const isNumeric = type === "number";
  
  // Helper to format number with commas
  const formatNumber = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const str = val.toString();
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
  };

  const displayValue = isNumeric ? formatNumber(value) : (value || "");

  const handleChange = (e) => {
    if (isNumeric) {
      const rawValue = e.target.value.replace(/,/g, '');
      // Allow empty, partial decimals, or valid numbers
      if (rawValue === '' || rawValue === '-' || rawValue === '.' || !isNaN(rawValue)) {
        onChange({ target: { value: rawValue } });
      }
    } else {
      onChange(e);
    }
  };

  return (
    <div className="space-y-1.5 flex-1 w-full text-left">
      <label className="block text-xs font-medium text-slate-500 tracking-wide">
        {label}
      </label>
      <input
        type="text"
        inputMode={isNumeric ? "decimal" : undefined}
        disabled={disabled}
        value={displayValue}
        onChange={handleChange}
        className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium transition focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-100 ${
          disabled ? 'bg-slate-50/80' : 'bg-white shadow-xs'
        } ${isNumeric || type === "mono" ? 'font-mono' : ''}`}
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