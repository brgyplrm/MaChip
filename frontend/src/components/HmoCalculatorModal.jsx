import React from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const HmoCalculatorModal = ({ 
  premium, 
  setPremium, 
  cutoffs, 
  setCutoffs, 
  employerShare, 
  setEmployerShare,
  cycleStartDate,
  setCycleStartDate
}) => {
  // Initial default states
  const defaultPremium = 23410.67;
  const defaultCutoffs = 24;
  const defaultEmployerShare = 50;

  // Derived calculations
  const employeeSharePct = 100 - employerShare;
  const employerCost = premium * (employerShare / 100);
  const employeeLiability = premium * (employeeSharePct / 100);
  const deduction = cutoffs > 0 ? employeeLiability / cutoffs : 0;

  // Formatting helper
  const formatMoney = (val) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
  };

  const handleReset = () => {
    setPremium(defaultPremium);
    setCutoffs(defaultCutoffs);
    setEmployerShare(defaultEmployerShare);
    // Note: Start date reset can be added if a default is desired
  };

  return (
    <div className="w-full max-w-6xl mx-auto bg-white text-slate-800 rounded-xl shadow-xl p-6 border border-slate-200 font-sans">
      
      {/* Top Header Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-2">
        <h2 className="text-xl font-bold text-[#2A174E] tracking-wide">
          HMO Payroll <br />Configuration
        </h2>
        
        <div className="flex gap-7 text-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1">Employer Cost</span>
            <span className="font-bold text-slate-900 text-base">{formatMoney(employerCost)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1">Emp. Share</span>
            <span className="font-bold text-slate-900 text-base">{employeeSharePct}%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1">Emp. Liability</span>
            <span className="font-bold text-slate-900 text-base">{formatMoney(employeeLiability)}</span>
          </div>
          <div className="flex flex-col text-blue-600">
            <span className="text-[10px] font-bold text-blue-500 tracking-wider uppercase mb-1">Per Cut-off</span>
            <span className="font-bold text-lg">{formatMoney(deduction)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Table and Calculations */}
        <div className="lg:col-span-8 bg-slate-50 rounded-xl border border-slate-200 p-6 shadow-inner">
          <div className="w-full border border-slate-200 bg-white rounded-md shadow-sm overflow-hidden">
            <div className="grid grid-cols-2 bg-slate-100 border-b border-slate-200 p-4 text-center">
              <span className="text-xs font-bold text-slate-600 tracking-wider uppercase">Pay Period (Cut-off)</span>
              <span className="text-xs font-bold text-slate-600 tracking-wider uppercase">Deduction Amount</span>
            </div>
            
            <div className="max-h-[350px] overflow-y-auto custom-scrollbar bg-white">
              {Array.from({ length: Math.min(cutoffs, 48) }).map((_, idx) => (
                <div 
                  key={idx} 
                  className={`grid grid-cols-2 p-4 text-center hover:bg-slate-50 transition-colors ${idx !== cutoffs - 1 ? 'border-b border-slate-100' : ''}`}
                >
                  <span className="text-sm font-semibold text-slate-600">
                    # {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {formatMoney(deduction)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Policy Period Section */}
          <div className="space-y-4 p-5 bg-[#2A174E]/5 rounded-xl border border-[#2A174E]/10">
            <h3 className="text-xs font-bold text-[#2A174E] uppercase tracking-widest">Policy Schedule</h3>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Cycle Start Date</label>
              <Input 
                type="date"
                value={cycleStartDate}
                onChange={(e) => setCycleStartDate(e.target.value)}
                className="bg-white border-slate-300 font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Renewal Term</label>
              <Select 
                value={(cutoffs / 2).toString()} 
                onValueChange={(val) => setCutoffs(parseInt(val) * 2)}
              >
                <SelectTrigger className="bg-white border-slate-300 font-medium">
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

          {/* Premium Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Annual Premium (₱)</label>
            <Input 
              type="number" 
              value={premium}
              onChange={(e) => setPremium(Number(e.target.value))}
              className="bg-white border-slate-300 text-slate-900 focus-visible:ring-[#2A174E] font-bold text-lg"
            />
          </div>

          {/* Employer Share Slider */}
          <div className="space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employer Share</label>
              <span className="text-lg font-black text-[#2A174E]">{employerShare}%</span>
            </div>
            <Slider 
              value={[employerShare]} 
              onValueChange={(val) => setEmployerShare(val[0])} 
              max={100} 
              step={5}
              className="py-4"
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
              <span>Employee Pays 100%</span>
              <span>Full Subsidy</span>
            </div>
          </div>
          
          <Button 
            onClick={handleReset}
            variant="outline" 
            className="w-full bg-white hover:bg-slate-50 text-slate-600 border-slate-200 transition-colors font-bold"
          >
            Reset to Standard Defaults
          </Button>
        </div>

      </div>

      <style dangerouslySetContent={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
};

export default HmoCalculatorModal;