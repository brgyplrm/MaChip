import React, { useState, useEffect } from 'react';
import { 
  User, Shield, ShieldAlert, Bell, Server, DollarSign, Settings,
  Clock, Briefcase, FileText, Landmark, Eye, EyeOff, Edit3, Info, Grid, LayoutList, Save, X
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
  const [saveStep, setSaveStep] = useState(0); // 0 = closed, 1 = confirm pop-up, 2 = password modal
  const [saveAdminPassword, setSaveAdminPassword] = useState("");
  const [saveVerifying, setSaveVerifying] = useState(false);
  const [savePwdError, setSavePwdError] = useState("");
  
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

  const executeSave = () => {
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
        otNightRates: Object.fromEntries(
          Object.entries(localData.otNightRates).map(([k, v]) => 
            ['shiftStart', 'shiftEnd'].includes(k) ? [k, v] : [k, sanitize(v)]
          )
        ),
        statutoryConstants: sanitizedStatutory
      },
      payroll: sanitizedStatutory 
    };
    onUpdate(backendData);
    setIsEditing(false);
    setSaveStep(0);
  };

  const handleSaveClick = () => {
    setSavePwdError("");
    setSaveAdminPassword("");
    setSaveStep(1);
  };

  const handleProceedToSavePassword = () => {
    setSaveStep(2);
  };

  const [showSavePassword, setShowSavePassword] = useState(false);

  const handleVerifyAndExecuteSave = async (e) => {
    e.preventDefault();
    if (!saveAdminPassword) {
      setSavePwdError("Admin password is required.");
      return;
    }

    try {
      setSaveVerifying(true);
      setSavePwdError("");
      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: saveAdminPassword })
      });
      const resData = await res.json();

      if (res.ok && resData.success) {
        setSaveStep(0);
        setSaveAdminPassword("");
        executeSave();
      } else {
        setSavePwdError(resData.error || "Incorrect password. Verification failed.");
      }
    } catch (err) {
      setSavePwdError("Error verifying password.");
    } finally {
      setSaveVerifying(false);
    }
  };

  const handleCancel = () => {
    setLocalData(data || DEFAULT_RATES);
    setIsEditing(false);
    setSaveStep(0);
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
        <div className="bg-brand-primary text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
            {/* <button 
              onClick={() => setIsPreviewOpen(true)} 
              className="flex items-center space-x-1.5 px-4 py-2 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-lg text-sm font-medium transition"
            >
              <Eye className="w-4 h-4" /> <span>Preview</span>
            </button> */}
            {isEditing ? (
              <>
                <button 
                  onClick={handleCancel}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  <X className="w-4 h-4" /> <span>Cancel</span>
                </button>
                <button 
                  onClick={handleSaveClick}
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
              className={`font-bold text-brand-primary bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 transition ${isEditing ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
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
              { id: 'batch-rules', label: 'Batch & Cutoff', icon: Clock },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 mx-1 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                    isActive 
                      ? 'bg-brand-primary text-white shadow-sm' 
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
            {activeTab === 'batch-rules' && (
              <BatchRulesView 
                data={localData.batchRules || { gracePeriodDays: localData.payrollGracePeriodDays || 7 }} 
                isEditing={isEditing} 
                onChange={(f, v) => {
                  updateField('batchRules', f, v);
                  setLocalData(prev => ({ ...prev, payrollGracePeriodDays: v }));
                }} 
              />
            )}
          </div>
        </div>

      </main>

      {isPreviewOpen && (
        <ConfigurationPreviewModal data={localData} onClose={() => setIsPreviewOpen(false)} />
      )}

      {/* STEP 1: SAVE CONFIRMATION MODAL */}
      {saveStep === 1 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 border border-slate-100 text-left">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="p-3 bg-amber-100 rounded-full">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Save Payroll Configuration?</h3>
                <p className="text-xs text-slate-500">Step 1 of 2: Security Confirmation</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to save these updated labor rate multipliers and payroll settings? Updating these parameters directly affects batch payroll calculations for all employees across the organization.
            </p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setSaveStep(0)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToSavePassword}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-sm"
              >
                Proceed to Security Verification →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: ADMIN PASSWORD VERIFICATION MODAL FOR SAVE */}
      {saveStep === 2 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleVerifyAndExecuteSave} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 border border-slate-100 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-brand-primary">
                <Shield className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Admin Security Authorization</h3>
              </div>
              <button type="button" onClick={() => setSaveStep(0)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Please enter your <strong>Admin Password</strong> to authorize saving updated labor rates and payroll configuration changes:
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Admin Password</label>
              <div className="relative">
                <input
                  type={showSavePassword ? "text" : "password"}
                  required
                  autoFocus
                  placeholder="Enter password..."
                  value={saveAdminPassword}
                  onChange={(e) => setSaveAdminPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowSavePassword(!showSavePassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  title={showSavePassword ? "Hide password" : "Show password"}
                >
                  {showSavePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {savePwdError && (
                <p className="text-xs text-rose-600 font-medium pt-1">{savePwdError}</p>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setSaveStep(0)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveVerifying}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-sm flex items-center space-x-1.5"
              >
                {saveVerifying ? (
                  <span>Verifying Password...</span>
                ) : (
                  <span>Verify & Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </div>
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

  const safeNum = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  const ordinary = safeNum(data.ordinary);
  const restDay = safeNum(data.restDay);
  const regularHoliday = safeNum(data.regularHoliday);
  const doubleHoliday = safeNum(data.doubleHoliday);
  const doubleSpecialDay = safeNum(data.doubleSpecialDay);
  const specialDayRestDay = safeNum(data.specialDayRestDay);
  const regularHolidayRestDay = safeNum(data.regularHolidayRestDay);
  const doubleHolidayRestDay = safeNum(data.doubleHolidayRestDay);
  const doubleSpecialDayRestDay = safeNum(data.doubleSpecialDayRestDay);

  const compoundLaborData = [
    { type: "Special Day Combo", day: "Special Day on Rest Day", formula: `Base ${ordinary.toFixed(1)} + 30% + 20% rest shift`, coefficient: specialDayRestDay, percentage: `${(specialDayRestDay * 100).toFixed(1)}%` },
    { type: "Holiday Combo", day: "Regular Holiday on Rest Day", formula: `Base ${regularHoliday.toFixed(1)} × ${restDay.toFixed(2)} rest index`, coefficient: regularHolidayRestDay, percentage: `${(regularHolidayRestDay * 100).toFixed(1)}%` },
    { type: "Holiday Combo", day: "Double Holiday on Rest Day", formula: `Base ${doubleHoliday.toFixed(1)} × ${restDay.toFixed(2)} rest index`, coefficient: doubleHolidayRestDay, percentage: `${(doubleHolidayRestDay * 100).toFixed(1)}%` },
    { type: "Special Day Combo", day: "Double Special Day on Rest Day", formula: `Base ${doubleSpecialDay.toFixed(1)} × ${restDay.toFixed(2)} rest index`, coefficient: doubleSpecialDayRestDay, percentage: `${(doubleSpecialDayRestDay * 100).toFixed(1)}%` }
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
        <div className="bg-brand-primary text-white px-5 py-3.5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-purple-200" />
            <span className="text-sm font-semibold tracking-wide">Auto-Compiled Compound Matrices (Read-Only Preview)</span>
          </div>
          
          <div className="flex bg-white/10 p-1 rounded-lg border border-white/10 self-start sm:self-auto">
            <button
              onClick={() => setViewFormat('table')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewFormat === 'table' ? 'bg-white text-brand-primary shadow-xs' : 'text-purple-200 hover:text-white'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewFormat('card')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewFormat === 'card' ? 'bg-white text-brand-primary shadow-xs' : 'text-purple-200 hover:text-white'
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

  const safeNum = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  const nsd = (safeNum(data.nsdRate)) / 100 + 1; // e.g. 1.1
  const otOrd = (safeNum(data.ordinaryOT)) / 100 + 1; // e.g. 1.25
  const otPrem = (safeNum(data.premiumOT)) / 100 + 1; // e.g. 1.3

  const ordRate = safeNum(laborRates.ordinary);
  const restRate = safeNum(laborRates.restDay);
  const specRate = safeNum(laborRates.specialDay);
  const specRestRate = safeNum(laborRates.specialDayRestDay);
  const dblSpecRate = safeNum(laborRates.doubleSpecialDay);
  const dblSpecRestRate = safeNum(laborRates.doubleSpecialDayRestDay);
  const regHolRate = safeNum(laborRates.regularHoliday);
  const regHolRestRate = safeNum(laborRates.regularHolidayRestDay);
  const dblHolRate = safeNum(laborRates.doubleHoliday);
  const dblHolRestRate = safeNum(laborRates.doubleHolidayRestDay);

  const matrixData = [
    // --- NIGHT SHIFT ONLY (Base × 1.1) ---
    { type: "Night Shift", day: "Ordinary Day", formula: `${ordRate.toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: (ordRate * nsd).toFixed(4), percentage: `${(ordRate * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Rest Day", formula: `${restRate.toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: (restRate * nsd).toFixed(4), percentage: `${(restRate * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Special (Non-Working) Day", formula: `${specRate.toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: (specRate * nsd).toFixed(4), percentage: `${(specRate * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Special (Non-Working) Day on Rest Day", formula: `${specRestRate.toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: (specRestRate * nsd).toFixed(4), percentage: `${(specRestRate * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Double Special (Non-Working) Day", formula: `${dblSpecRate.toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: (dblSpecRate * nsd).toFixed(4), percentage: `${(dblSpecRate * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Double Special Day on Rest Day", formula: `${dblSpecRestRate.toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: (dblSpecRestRate * nsd).toFixed(4), percentage: `${(dblSpecRestRate * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Regular Holiday", formula: `${regHolRate.toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: (regHolRate * nsd).toFixed(4), percentage: `${(regHolRate * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Regular Holiday on Rest Day", formula: `${regHolRestRate.toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: (regHolRestRate * nsd).toFixed(4), percentage: `${(regHolRestRate * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Double Regular Holiday", formula: `${dblHolRate.toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: (dblHolRate * nsd).toFixed(4), percentage: `${(dblHolRate * nsd * 100).toFixed(1)}%` },
    { type: "Night Shift", day: "Double Regular Holiday on Rest Day", formula: `${dblHolRestRate.toFixed(2)} × ${nsd.toFixed(2)}`, coefficient: (dblHolRestRate * nsd).toFixed(4), percentage: `${(dblHolRestRate * nsd * 100).toFixed(1)}%` },

    // --- OVERTIME ONLY (Base × 1.25 for Ordinary, Base × 1.3 for Premiums) ---
    { type: "Overtime (OT)", day: "Ordinary Day", formula: `${ordRate.toFixed(2)} × ${otOrd.toFixed(2)}`, coefficient: (ordRate * otOrd).toFixed(4), percentage: `${(ordRate * otOrd * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Rest Day", formula: `${restRate.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (restRate * otPrem).toFixed(4), percentage: `${(restRate * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Special (Non-Working) Day", formula: `${specRate.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (specRate * otPrem).toFixed(4), percentage: `${(specRate * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Special (Non-Working) Day on Rest Day", formula: `${specRestRate.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (specRestRate * otPrem).toFixed(4), percentage: `${(specRestRate * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Double Special (Non-Working) Day", formula: `${dblSpecRate.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (dblSpecRate * otPrem).toFixed(4), percentage: `${(dblSpecRate * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Double Special Day on Rest Day", formula: `${dblSpecRestRate.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (dblSpecRestRate * otPrem).toFixed(4), percentage: `${(dblSpecRestRate * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Regular Holiday", formula: `${regHolRate.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (regHolRate * otPrem).toFixed(4), percentage: `${(regHolRate * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Regular Holiday on Rest Day", formula: `${regHolRestRate.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (regHolRestRate * otPrem).toFixed(4), percentage: `${(regHolRestRate * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Double Regular Holiday", formula: `${dblHolRate.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (dblHolRate * otPrem).toFixed(4), percentage: `${(dblHolRate * otPrem * 100).toFixed(1)}%` },
    { type: "Overtime (OT)", day: "Double Regular Holiday on Rest Day", formula: `${dblHolRestRate.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (dblHolRestRate * otPrem).toFixed(4), percentage: `${(dblHolRestRate * otPrem * 100).toFixed(1)}%` },

    // --- COMPOUND NIGHT SHIFT OVERTIME (Base × 1.1 × OT) ---
    { type: "Night Shift OT", day: "Ordinary Day", formula: `${ordRate.toFixed(2)} × ${nsd.toFixed(2)} × ${otOrd.toFixed(2)}`, coefficient: (ordRate * nsd * otOrd).toFixed(4), percentage: `${(ordRate * nsd * otOrd * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Rest Day", formula: `${restRate.toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (restRate * nsd * otPrem).toFixed(4), percentage: `${(restRate * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Special (Non-Working) Day", formula: `${specRate.toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (specRate * nsd * otPrem).toFixed(4), percentage: `${(specRate * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Special (Non-Working) Day on Rest Day", formula: `${specRestRate.toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (specRestRate * nsd * otPrem).toFixed(4), percentage: `${(specRestRate * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Double Special (Non-Working) Day", formula: `${dblSpecRate.toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (dblSpecRate * nsd * otPrem).toFixed(4), percentage: `${(dblSpecRate * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Double Special Day on Rest Day", formula: `${dblSpecRestRate.toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (dblSpecRestRate * nsd * otPrem).toFixed(4), percentage: `${(dblSpecRestRate * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Regular Holiday", formula: `${regHolRate.toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (regHolRate * nsd * otPrem).toFixed(4), percentage: `${(regHolRate * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Regular Holiday on Rest Day", formula: `${regHolRestRate.toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (regHolRestRate * nsd * otPrem).toFixed(4), percentage: `${(regHolRestRate * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Double Regular Holiday", formula: `${dblHolRate.toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (dblHolRate * nsd * otPrem).toFixed(4), percentage: `${(dblHolRate * nsd * otPrem * 100).toFixed(1)}%` },
    { type: "Night Shift OT", day: "Double Regular Holiday on Rest Day", formula: `${dblHolRestRate.toFixed(2)} × ${nsd.toFixed(2)} × ${otPrem.toFixed(2)}`, coefficient: (dblHolRestRate * nsd * otPrem).toFixed(4), percentage: `${(dblHolRestRate * nsd * otPrem * 100).toFixed(1)}%` },
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
            <FormTimePicker 
              label="Shift Start Time"
              value={data.shiftStart}
              onChange={(e) => onChange('shiftStart', e.target.value)}
              disabled={!isEditing}
            />
            <FormTimePicker 
              label="Shift End Time"
              value={data.shiftEnd}
              onChange={(e) => onChange('shiftEnd', e.target.value)}
              disabled={!isEditing}
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
        <div className="bg-brand-primary text-white px-5 py-3.5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-purple-200" />
            <span className="text-sm font-semibold tracking-wide">Auto-Compiled Compound Coefficient Matrix (Read-Only)</span>
          </div>
          
          <div className="flex bg-white/10 p-1 rounded-lg border border-white/10 self-start sm:self-auto">
            <button
              onClick={() => setViewFormat('table')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewFormat === 'table' ? 'bg-white text-brand-primary shadow-xs' : 'text-purple-200 hover:text-white'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewFormat('card')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewFormat === 'card' ? 'bg-white text-brand-primary shadow-xs' : 'text-purple-200 hover:text-white'
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
                row.type === "Night Shift" ? "border-t-status-info" :
                row.type === "Overtime (OT)" ? "border-t-accent-gold" :
                "border-t-brand-primary";

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
      <div className="border-l-4 border-brand-primary bg-brand-primary/5 p-4 rounded-r-xl space-y-4">
        <h4 className="text-sm font-bold text-brand-primary">Service Incentive Leave (SIL)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput label="Paid Annual Allowance (Days/Year)" value="5" />
          <FormInput label="Service Tenure Trigger (Months)" value="12" />
        </div>
      </div>

      {/* Maternity Leave */}
      <div className="border-l-4 border-accent-gold bg-accent-gold/5 p-4 rounded-r-xl space-y-4">
        <h4 className="text-sm font-bold text-accent-gold">Expanded Maternity Leave (RA 11210)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput label="Standard Live Birth (Days)" value="105" />
          <FormInput label="Solo Parent (Days)" value="120" />
          <FormInput label="Miscarriage/ETP (Days)" value="60" />
        </div>
      </div>

      {/* Paternity Leave */}
      <div className="border-l-4 border-status-info bg-status-info/5 p-4 rounded-r-xl space-y-4">
        <h4 className="text-sm font-bold text-status-info">Paternity Leave (RA 8187)</h4>
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

{/* =========================================================================
    TAB PANEL 6: BATCH & CUTOFF RULES
========================================================================= */}
function BatchRulesView({ data, isEditing, onChange }) {
  const graceDays = data?.gracePeriodDays ?? 7;

  return (
    <div className="space-y-6 text-left">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-base font-bold text-slate-800">Payroll Batch & Cutoff Processing Rules</h3>
        <p className="text-xs text-slate-500 mt-1">Configure post-cutoff grace period accessibility for Process Batch button and archival settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Process Batch Grace Window</h4>
              <p className="text-xs text-slate-500">Number of days after cutoff end date that Process Batch remains open.</p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-slate-700 block">Grace Period Length (Days)</label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="1"
                max="30"
                value={graceDays}
                disabled={!isEditing}
                onChange={(e) => onChange('gracePeriodDays', parseInt(e.target.value) || 7)}
                className={`w-28 px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-sm text-purple-900 ${isEditing ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
              />
              <span className="text-xs font-medium text-slate-600">Days ({graceDays === 7 ? "1 Week Default" : `${graceDays} Days`})</span>
            </div>
            <p className="text-[11px] text-slate-400 italic">Default is 7 days (1 week). During this time, administrators can process late payroll batches without locking issues.</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Automated Archival & Security</h4>
              <p className="text-xs text-slate-500">Security mandates for batch payslips & report zip generation.</p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600 pt-2 font-mono">
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span>PDF File Naming:</span>
              <span className="font-bold text-emerald-700">Payslip_[LastName]_[ID].pdf</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span>PDF Open Password:</span>
              <span className="font-bold text-amber-700">[CutoffDays][Month][LastName][ID]</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span>Batch Storage Directory:</span>
              <span className="font-bold text-purple-700">Editable in Settings</span>
            </div>
            <div className="flex justify-between pb-1.5">
              <span>Audit Trail Policy:</span>
              <span className="font-bold text-blue-700">Mandatory (Paranoid Mode)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 