import React, { useState } from 'react';
import { Eye, X } from 'lucide-react';

export default function ConfigurationPreviewModal() {
  const [isOpen, setIsOpen] = useState(true);

  // Reconstructed JSON object from your screenshots
  const configData = {
    "system_version": "2026.1.0",
    "effective_date": "2026-01-01",
    "status": "LIVE",
    "multipliers": {
      "ordinary_day": 1,
      "rest_day": 1.3,
      "special_day": 1.3,
      "special_day_rest_day": 1.5,
      "regular_holiday": 2,
      "regular_holiday_rest_day": 2.6,
      "double_regular_holiday": 3,
      "double_regular_holiday_rest_day": 3.9
    },
    "premiums": {
      "night_shift_differential_rate": 0.1,
      "night_shift_start": "22:00",
      "night_shift_end": "06:00",
      "overtime_ordinary_rate": 0.25,
      "overtime_premium_days_rate": 0.3
    },
    "estimated_equivalent_monthly_rate_factors": {
      "paid_every_day": 365,
      "worked_every_day": 395,
      "six_day_workweek": 313,
      "five_day_workweek": 261,
      "auto_adjust_leap_year": true,
      "apply_no_work_no_pay": true
    },
    "statutory_benefits": {
      "service_incentive_leave_days": 5,
      "paternity_leave_max_deliveries": 4,
      "solo_parent_leave_days": 7,
      "vawc_leave_days": 10,
      "thirteenth_month_tax_exempt_ceiling": 90000,
      "retirement_pay_days_factor": 22.5
    },
    "contributions": {
      "philhealth": {
        "premium_rate": 0.05,
        "income_floor": 10000,
        "income_ceiling": 100000,
        "employee_share_ratio": 0.5
      },
      "sss": {
        "total_rate": 0.15,
        "employer_share_rate": 0.1,
        "employee_share_rate": 0.05,
        "income_floor": 5000,
        "income_ceiling": 35000,
        "mpf_threshold": 20000,
        "ec_contribution_below_15k": 10,
        "ec_contribution_above_equal_15k": 30
      },
      "pag_ibig": {
        "employee_rate_below_equal_1500": 0.01,
        "employee_rate_above_1500": 0.02,
        "employer_rate": 0.02,
        "maximum_fund_salary": 10000
      }
    }
  };

  if (!isOpen) {
    return (
      <div className="p-8 flex justify-center">
        <button 
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-[#2A1B4E] text-white rounded-lg text-sm font-medium shadow transition hover:bg-[#3b276c]"
        >
          <Eye className="w-4 h-4" />
          <span>Open Configuration Preview</span>
        </button>
      </div>
    );
  }

  return (
    // Backdrop overlay
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      
      {/* Modal Container */}
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Bar */}
        <div className="bg-[#2A1B4E] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Eye className="w-5 h-5 text-purple-200" />
            <h2 className="text-lg font-semibold tracking-wide">Configuration Preview</h2>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-white/70 hover:text-white transition rounded-lg p-1 hover:bg-white/10"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Code Content Editor Shell */}
        <div className="flex-1 p-5 bg-[#FDFBF7] overflow-y-auto">
          <div className="bg-[#111827] rounded-xl p-6 shadow-inner font-mono text-[13px] leading-relaxed text-[#10B981] overflow-x-auto border border-slate-800 selection:bg-emerald-500/20">
            <pre className="whitespace-pre-wrap md:whitespace-pre">
              {JSON.stringify(configData, null, 2)}
            </pre>
          </div>
        </div>

      </div>
    </div>
  );
}