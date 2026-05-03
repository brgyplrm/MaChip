import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const HmoCalculatorModal = ({ 
  premium, 
  setPremium, 
  cutoffs, 
  setCutoffs, 
  employerShare, 
  setEmployerShare 
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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val || 0);
  };

  const handleReset = () => {
    setPremium(defaultPremium);
    setCutoffs(defaultCutoffs);
    setEmployerShare(defaultEmployerShare);
  };

  return (
    <div className="w-full max-w-6xl mx-auto bg-white text-slate-800 rounded-xl shadow-xl p-6 border border-slate-200 font-sans">
      
      {/* Top Header Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-2">
        <h2 className="text-xl font-bold text-slate-900 tracking-wide">
          HMO Payroll <br />Calculator
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
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1">Deduction</span>
            <span className="font-bold text-slate-900 text-base">{formatMoney(deduction)}</span>
          </div>
        </div>
      </div>

      {/* Inner Table Container */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 mb-8 min-h-[300px] flex justify-center shadow-inner">
        <div className="w-full max-w-2xl border border-slate-200 bg-white rounded-md shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-2 bg-slate-100 border-b border-slate-200 p-4 text-center">
            <span className="text-xs font-bold text-slate-600 tracking-wider uppercase">Pay Period (Cut-off)</span>
            <span className="text-xs font-bold text-slate-600 tracking-wider uppercase">Deduction Amount</span>
          </div>
          
          {/* Table Body (Scrollable if lots of cutoffs) */}
          <div className="max-h-[260px] overflow-y-auto custom-scrollbar bg-white">
            {Array.from({ length: Math.min(cutoffs, 24) }).map((_, idx) => (
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

      {/* Bottom Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        
        {/* Left Controls: Inputs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">Total Annual Premium ($)</label>
            <Input 
              type="number" 
              value={premium}
              onChange={(e) => setPremium(Number(e.target.value))}
              className="w-[180px] bg-white border-slate-300 text-slate-900 focus-visible:ring-blue-500 font-medium"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">Total Annual Cut-offs</label>
            <Input 
              type="number" 
              value={cutoffs}
              onChange={(e) => setCutoffs(Number(e.target.value))}
              className="w-[180px] bg-white border-slate-300 text-slate-900 focus-visible:ring-blue-500 font-medium"
            />
          </div>
        </div>

        {/* Right Controls: Slider & Reset */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Employer Share (%)</label>
            <div className="flex-1 flex items-center gap-4">
              <Slider 
                value={[employerShare]} 
                onValueChange={(val) => setEmployerShare(val[0])} 
                max={100} 
                step={1}
                className="flex-1"
              />
              <div className="w-[60px] text-center border border-slate-300 bg-white shadow-sm rounded-md py-1.5 text-sm font-bold text-slate-900">
                {employerShare}
              </div>
            </div>
          </div>
          
          <Button 
            onClick={handleReset}
            variant="outline" 
            className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300 transition-colors font-semibold"
          >
            Default Settings
          </Button>
        </div>

      </div>

      {/* Global style for custom scrollbar within this component scope */}
      <style dangerouslySetContent={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc; /* slate-50 */
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1; /* slate-300 */
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8; /* slate-400 */
        }
      `}} />
    </div>
  );
};

export default HmoCalculatorModal;