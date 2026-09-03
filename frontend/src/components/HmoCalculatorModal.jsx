import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "../utils/api";
import Toast from "./toast/Toast";
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import EventIcon from '@mui/icons-material/Event';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ShieldIcon from '@mui/icons-material/Shield';

const HmoCalculatorModal = ({ 
  premium, 
  setPremium, 
  cutoffs, 
  setCutoffs, 
  employerShare, 
  setEmployerShare,
  cycleStartDate,
  setCycleStartDate,
  onSuccess,
  onClose,
  onSave
}) => {
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [saving, setSaving] = useState(false);

  // Derived calculations
  const employeeSharePct = 100 - employerShare;
  const employerCost = (premium || 0) * (employerShare / 100);
  const employeeLiability = (premium || 0) * (employeeSharePct / 100);
  const deduction = cutoffs > 0 ? employeeLiability / cutoffs : 0;

  const getRenewalPeriod = () => {
    if (!cycleStartDate) return "Not Set";
    const start = new Date(cycleStartDate);
    const end = new Date(start);
    const months = cutoffs / 2;
    end.setMonth(start.getMonth() + (months || 12));
    end.setDate(end.getDate() - 1);
    
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${start.toLocaleDateString('en-PH', options)} TO ${start.toLocaleDateString('en-PH', options) === end.toLocaleDateString('en-PH', options) ? '...' : end.toLocaleDateString('en-PH', options)}`.toUpperCase();
  };

  // Formatting helper
  const formatMoney = (val) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
  };

  const handleReset = () => {
    setPremium(0);
    setCutoffs(24);
    setEmployerShare(50);
  };

  const handleSaveNewConfig = async () => {
    try {
      setSaving(true);
      const year = new Date(cycleStartDate).getFullYear();
      if (isNaN(year)) {
        setToast({ message: "Invalid start date", type: "error" });
        return;
      }

      // Fetch the existing configs and dates to keep them
      const settingsRes = await fetchWithAuth("/api/system/settings");
      const settingsData = await settingsRes.json();
      const existingConfigs = settingsData.maxicareDates?.configs || {};
      const existingDates = settingsData.maxicareDates?.dates || [];

      const updatedConfigs = {
        ...existingConfigs,
        [year]: {
          totalGross: premium,
          monthsToPay: cutoffs / 2,
          cycleStartDate: cycleStartDate
        }
      };

      const saveRes = await fetchWithAuth("/api/system/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxicareDates: {
            dates: existingDates,
            configs: updatedConfigs
          }
        })
      });

      if (saveRes.ok) {
        setToast({ message: `Configuration for Cycle ${year} saved!`, type: "success" });
        setTimeout(() => {
          onSuccess?.();
          onClose?.();
        }, 1200);
      } else {
        setToast({ message: "Failed to save configuration", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Error saving configuration", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = async () => {
    if (onSave) {
      try {
        setSaving(true);
        await onSave();
        setToast({ message: "Configuration saved successfully!", type: "success" });
        setTimeout(() => {
          onSuccess?.();
          onClose?.();
        }, 1200);
      } catch (err) {
        console.error(err);
        setToast({ message: "Error saving configuration", type: "error" });
      } finally {
        setSaving(false);
      }
    } else {
      await handleSaveNewConfig();
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-8 w-full max-w-6xl mx-auto">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
      
      <div className="w-full bg-white text-slate-800 rounded-xl shadow-2xl p-6 border border-slate-200 font-sans overflow-hidden">
        
        {/* Premium Header Banner */}
        <div className="bg-[#2A174E] text-white p-6 rounded-xl -mx-6 -mt-6 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 text-left">
            <div className="h-12 w-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20 shrink-0">
              <MedicalServicesIcon className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-wide">HMO Premium Calculator</h2>
              <span className="text-xs text-slate-300">Set cycles, employer/employee share distribution, and preview cutoff deductions.</span>
            </div>
          </div>
          {/* <div className="bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 rounded-lg text-right shrink-0 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <div>
              <span className="text-[10px] font-bold text-emerald-300 uppercase block tracking-wider">Estimated Cut-off</span>
              <span className="font-extrabold text-emerald-400 text-lg">{formatMoney(deduction)}</span>
            </div>
          </div> */}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Annual Premium</span>
            <span className="font-black text-slate-800 text-base">{formatMoney(premium)}</span>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex flex-col text-left">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Employer Cost ({employerShare}%)</span>
            <span className="font-black text-emerald-700 text-base">{formatMoney(employerCost)}</span>
          </div>
          <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 flex flex-col text-left">
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1">Employee Share ({employeeSharePct}%)</span>
            <span className="font-black text-orange-700 text-base">{formatMoney(employeeLiability)}</span>
          </div>
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col text-left">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Total Cut-offs</span>
            <span className="font-black text-blue-700 text-base">{cutoffs} Periods</span>
          </div>
        </div>

        {/* Top Section: Table and Schedule */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mb-6">
          
          {/* Left Section: Table of Cut-offs */}
          <div className="lg:col-span-8 bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-inner flex flex-col">
            <div className="w-full border border-slate-200 bg-white rounded-md shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="grid grid-cols-2 bg-slate-100 border-b border-slate-200 p-3 text-center shrink-0">
                <span className="text-xs font-bold text-slate-600 tracking-wider uppercase">Pay Period (Cut-off)</span>
                <span className="text-xs font-bold text-slate-600 tracking-wider uppercase">Deduction Amount</span>
              </div>
              
              <div className="max-h-[180px] overflow-y-auto custom-scrollbar bg-white flex-1">
                {Array.from({ length: Math.min(cutoffs, 48) }).map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`grid grid-cols-2 p-3 text-center hover:bg-slate-50 transition-colors ${idx !== cutoffs - 1 ? 'border-b border-slate-100' : ''}`}
                  >
                    <span className="text-sm font-semibold text-slate-505">
                      # {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {formatMoney(deduction)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Section: Policy Schedule */}
          <div className="lg:col-span-4 p-5 bg-[#2A174E]/5 rounded-xl border border-[#2A174E]/10 flex flex-col justify-between gap-4 text-left">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShieldIcon className="text-[#2A174E] h-4 w-4" />
                <h3 className="text-xs font-bold text-[#2A174E] uppercase tracking-widest">Policy Schedule</h3>
              </div>
              
              <div className="space-y-1 bg-white p-3 rounded-lg border border-[#2A174E]/10 shadow-sm mb-3">
                 <div className="flex justify-between items-center mb-1">
                   <span className="text-[10px] font-bold text-[#2A174E] uppercase block">Calculated Period</span>
                   <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">PREVIEW</span>
                 </div>
                 <span className="text-xs font-black text-slate-800 tracking-tighter">
                   {getRenewalPeriod()}
                 </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <EventIcon sx={{ fontSize: 14 }} className="text-slate-400" /> Cycle Start Date
                </label>
                <Input 
                  type="date"
                  value={cycleStartDate}
                  onChange={(e) => setCycleStartDate(e.target.value)}
                  className="bg-white border-slate-300 font-medium h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Renewal Term</label>
                <Select 
                  value={(cutoffs / 2).toString()} 
                  onValueChange={(val) => setCutoffs(parseInt(val) * 2)}
                >
                  <SelectTrigger className="bg-white border-slate-300 font-medium h-9">
                    <SelectValue placeholder="Select term duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 Months (12 Cut-offs)</SelectItem>
                    <SelectItem value="12">12 Months (24 Cut-offs)</SelectItem>
                    <SelectItem value="24">24 Months (48 Cut-offs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

        </div>

        {/* Middle Row: Inputs & Controls horizontal card row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 pt-6 border-t border-slate-100">
          
          {/* Col 1: Annual Premium */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-left h-28 flex flex-col justify-between">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Annual Premium (₱)</label>
            <Input 
              type="text" 
              value={premium?.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              onChange={(e) => {
                const val = e.target.value.replace(/,/g, '');
                if (!isNaN(val) || val === '') {
                  setPremium(val === '' ? 0 : parseFloat(val));
                }
              }}
              className="bg-white border-slate-300 text-slate-900 focus-visible:ring-[#2A174E] font-bold text-lg h-10 mt-1"
              placeholder="0.00"
            />
          </div>

          {/* Col 2: Employer Share */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-left h-28 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Employer Share</label>
              <span className="text-base font-black text-[#2A174E]">{employerShare}%</span>
            </div>
            <Slider 
              value={[employerShare]} 
              onValueChange={(val) => setEmployerShare(val[0])} 
              max={100} 
              step={5}
              className="py-1"
            />
            <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase">
              <span>Employee 100%</span>
              <span>Full Subsidy</span>
            </div>
          </div>

          {/* Col 3: Reset Defaults Button */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-left h-28 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reset Parameters</div>
            <Button 
              onClick={handleReset}
              variant="outline" 
              className="w-full bg-white hover:bg-slate-100 text-slate-600 border-slate-300 hover:text-[#2A174E] transition-all font-bold h-10 mt-1 flex items-center justify-center gap-1"
            >
              <RestartAltIcon sx={{ fontSize: 18 }} /> Reset to Defaults
            </Button>
          </div>

        </div>

        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar { width: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `}} />
        {/* Action Buttons below the white background box */}
        <br/>
      <div className="flex justify-center items-center gap-4 mt-2">
        <Button 
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={saving}
          className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 h-12 min-w-[200px] px-6 rounded-lg font-bold transition-all shadow-sm hover:scale-102 transform active:scale-98"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSaveClick}
          disabled={saving}
          className="bg-[#2A174E] text-white hover:bg-[#1a0e30] border border-white/20 h-12 min-w-[200px] px-6 rounded-lg font-bold transition-all shadow-xl hover:scale-102 transform active:scale-98"
        >
          {saving ? "Saving Configuration..." : (onSave ? "Save Configuration" : "Save New Configuration")}
        </Button>
      </div>
      </div>
    </div>
  );
};

export default HmoCalculatorModal;