import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CloseIcon from "@mui/icons-material/Close";
import { formatUserId } from "../utils/formatUserId";

const ViewPayslipModal = ({ isOpen, onClose, payroll }) => {
  if (!payroll) return null;

  const formatCurrency = (val) =>
    parseFloat(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formatDateShort = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
    }).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        showCloseButton={false}
        className="!max-w-none sm:!max-w-none md:!max-w-none lg:!max-w-none !w-screen !h-screen !m-0 !rounded-none !p-0 !gap-0 !border-none flex flex-col bg-slate-100 !top-0 !left-0 !translate-x-0 !translate-y-0"
      >
        {/* Header Block */}
        <DialogHeader className="px-6 py-4 bg-[#2A174E] text-white sticky top-0 z-50 !rounded-none flex flex-row items-center justify-between shadow-md">
          <DialogTitle className="text-xl font-bold tracking-wide">Employee Payslip Generation Engine</DialogTitle>
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-white hover:bg-white/10 rounded-full h-10 w-10 p-0"
          >
            <CloseIcon />
          </Button>
        </DialogHeader>

        {/* Modal Dual View Presentation Body */}
        <div className="flex-1 overflow-y-auto flex flex-col xl:flex-row gap-8 p-8 justify-center items-start custom-scrollbar">
          
          {/* Left Side: Standard Payslip Layout */}
          <div className="flex-shrink-0">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">Standard Compliance Payslip</h3>
            <div className="bg-white border-2 border-red-700 p-8 w-[500px] shadow-md font-sans text-[#1e293b]">
              <div className="text-center mb-6">
                <h2 className="text-[#1e3a8a] text-lg font-bold">MAC-J INT'L., FORWARDING LTD., CO.</h2>
                <p className="text-[10px] text-slate-500">Unit 201, 2nd Floor, Ma. Natividad Bldg., 1007 M.H. Del Pilar St., Ermita, Manila</p>
                <div className="border-b border-slate-200 mt-2"></div>
              </div>

              <div className="space-y-1 mb-6 text-xs">
                <div className="grid grid-cols-[100px_10px_1fr]">
                  <span className="font-bold">Employee name</span><span>:</span><span className="uppercase">{payroll.user_FirstName} {payroll.user_LastName}</span>
                </div>
                <div className="grid grid-cols-[100px_10px_1fr]">
                  <span className="font-bold">Payroll period</span><span>:</span><span className="uppercase">{formatDateShort(payroll.period_Start)} - {formatDate(payroll.period_End).toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-[100px_10px_1fr]">
                  <span className="font-bold">Account Number</span><span>:</span><span>{payroll.accountNo || "—"}</span>
                </div>
                <div className="grid grid-cols-[100px_10px_1fr]">
                  <span className="font-bold">Number of Days</span><span>:</span><span>{payroll.NoDays_Worked}</span>
                </div>
              </div>

              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 p-2 text-left">EARNINGS</th>
                    <th className="border border-slate-200 p-2 text-left w-12">Hrs</th>
                    <th className="border border-slate-200 p-2 text-left w-20">Amount</th>
                    <th className="border border-slate-200 p-2 text-left">DEDUCTIONS</th>
                    <th className="border border-slate-200 p-2 text-left w-16">Hrs/Mins</th>
                    <th className="border border-slate-200 p-2 text-left w-20">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-200 p-2">Pay this period</td><td className="border border-slate-200 p-2">{payroll.NoHrs_Worked}</td><td className="border border-slate-200 p-2">{formatCurrency(payroll.basicPay)}</td>
                    <td className="border border-slate-200 p-2">Absences</td><td className="border border-slate-200 p-2">{payroll.absence_Hrs || "0"}</td><td className="border border-slate-200 p-2">{formatCurrency(payroll.absence_Amnt)}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 p-2">Overtime pay</td><td className="border border-slate-200 p-2">{payroll.OT_Hrs || "0"}</td><td className="border border-slate-200 p-2">{formatCurrency(payroll.OT_Amnt)}</td>
                    <td className="border border-slate-200 p-2">Tardiness</td><td className="border border-slate-200 p-2">{payroll.tardiness_Mins || "0"}m</td><td className="border border-slate-200 p-2">{formatCurrency(payroll.tardiness_Amnt)}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 p-2">Restday OT</td><td className="border border-slate-200 p-2">{payroll.restDay_OT_Hrs || "0"}</td><td className="border border-slate-200 p-2">{formatCurrency(payroll.restDay_OT_Amnt)}</td>
                    <td className="border border-slate-200 p-2">SSS</td><td className="border border-slate-200 p-2"></td><td className="border border-slate-200 p-2">{formatCurrency(payroll.SSS_Ded)}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 p-2">Night Diff</td><td className="border border-slate-200 p-2">{payroll.nightDiff_Hrs || "0"}</td><td className="border border-slate-200 p-2">{formatCurrency(payroll.nightDiff_Amnt)}</td>
                    <td className="border border-slate-200 p-2">Philhealth</td><td className="border border-slate-200 p-2"></td><td className="border border-slate-200 p-2">{formatCurrency(payroll.Philhealth_Ded)}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 p-2">Holidays</td><td className="border border-slate-200 p-2">{payroll.holidaysTotal || "0"}</td><td className="border border-slate-200 p-2">{formatCurrency(parseFloat(payroll.legalHol_Amnt || 0) + parseFloat(payroll.specialHol_Amnt || 0))}</td>
                    <td className="border border-slate-200 p-2">HDMF</td><td className="border border-slate-200 p-2"></td><td className="border border-slate-200 p-2">{formatCurrency(payroll.HDMF_Ded)}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 p-2">Allowance</td><td className="border border-slate-200 p-2"></td><td className="border border-slate-200 p-2">{formatCurrency(payroll.allowance)}</td>
                    <td className="border border-slate-200 p-2">Tax</td><td className="border border-slate-200 p-2"></td><td className="border border-slate-200 p-2">{formatCurrency(payroll.Tax_Ded)}</td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td className="border border-slate-200 p-2">Total Pay</td><td className="border border-slate-200 p-2"></td><td className="border border-slate-200 p-2 text-blue-800">{formatCurrency(payroll.totalEarnings)}</td>
                    <td className="border border-slate-200 p-2">Total Ded.</td><td className="border border-slate-200 p-2"></td><td className="border border-slate-200 p-2 text-red-800">{formatCurrency(payroll.totalDeductions)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-end mt-4">
                <div className="text-right">
                  <span className="text-xs font-bold mr-4">NET PAY:</span>
                  <span className="text-sm font-bold border-b-4 border-double border-slate-800">₱{formatCurrency(payroll.netPay)}</span>
                </div>
              </div>

              <div className="mt-8">
                <p className="text-[10px] mb-6">RECEIVED BY:</p>
                <div className="w-40 border-b border-slate-800"></div>
                <p className="text-[10px] font-bold mt-1 uppercase">{payroll.user_FirstName} {payroll.user_LastName}</p>
              </div>
            </div>
          </div>

          {/* Right Side: MATCHING THE DETAILED VISUAL FROM DESIGN IMAGES */}
          <div className="flex-shrink-0">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">MaChip Detailed Analytics</h3>
            <div className="bg-white border border-slate-200 p-8 w-[680px] shadow-md font-sans text-slate-800 rounded-xl">
              
              {/* New Centered Branding Header */}
              <div className="text-center border-b border-slate-100 pb-6 mb-6">
                <h2 className="text-[#2A174E] text-xl font-bold uppercase tracking-tight mb-1">MAC-J INT'L., FORWARDING LTD., CO.</h2>
                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-medium">Pay Period: {formatDate(payroll.period_Start)} - {formatDate(payroll.period_End)}</p>
                  <p className="font-medium text-slate-400">Payroll Date: {formatDate(payroll.updatedAt || payroll.createdAt)}</p>
                </div>
              </div>

              {/* Dynamic Employee Bio Summary Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
                <table className="w-full text-xs border-collapse">
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2 bg-slate-50/50 font-bold text-slate-400 uppercase text-[10px]">Employee Name</td>
                      <td className="p-3 font-bold text-slate-800 text-sm uppercase">{payroll.user_FirstName} {payroll.user_LastName}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2 bg-slate-50/50 font-bold text-slate-400 uppercase text-[10px]">Position</td>
                      <td className="p-3 font-bold text-slate-800 text-sm">{payroll.user_Position || "Floorhand"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Rate Information Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
                <table className="w-full text-xs border-collapse">
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2 bg-slate-50/50 font-bold text-slate-400 uppercase text-[10px]">Monthly Rate</td>
                      <td className="p-3 font-mono font-bold text-slate-800 text-sm text-right pr-8">₱{formatCurrency(parseFloat(payroll.dailyRate || 0) * 22)}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2 bg-slate-50/50 font-bold text-slate-400 uppercase text-[10px]">Daily Rate</td>
                      <td className="p-3 font-mono font-bold text-slate-800 text-sm text-right pr-8">₱{formatCurrency(payroll.dailyRate)}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2 bg-slate-50/50 font-bold text-slate-400 uppercase text-[10px]">Hourly Rate</td>
                      <td className="p-3 font-mono font-bold text-slate-800 text-sm text-right pr-8">₱{formatCurrency(payroll.ratePerHr)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Wide-Form Structured Table Body (Aligning with design images) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#2A174E]/5 text-[#2A174E] font-bold border-b border-slate-200">
                      <th className="p-3 text-left w-1/2 border-r border-slate-200">COMPUTATION METRIC CATEGORIES</th>
                      <th className="p-3 text-center w-1/6 border-r border-slate-200">RENDERED DATA</th>
                      <th className="p-3 text-right w-1/3">FINANCIAL IMPACT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    
                    {/* Basic Group Block */}
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200">Regular Base Pay Hours Calculated</td>
                      <td className="p-3 text-center border-r border-slate-200 font-mono">{payroll.NoHrs_Worked} hrs</td>
                      <td className="p-3 text-right font-semibold text-slate-900">₱{formatCurrency(payroll.basicPay)}</td>
                    </tr>
                    
                    {/* Premium Pay Blocks */}
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200">Overtime Rendered Work Pay</td>
                      <td className="p-3 text-center border-r border-slate-200 font-mono">{payroll.OT_Hrs || "0"} hrs</td>
                      <td className="p-3 text-right font-semibold text-emerald-600">₱{formatCurrency(payroll.OT_Amnt)}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200">Rest Day Shift Coverage Overtime</td>
                      <td className="p-3 text-center border-r border-slate-200 font-mono">{payroll.restDay_OT_Hrs || "0"} hrs</td>
                      <td className="p-3 text-right font-semibold text-emerald-600">₱{formatCurrency(payroll.restDay_OT_Amnt)}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200">Night Differential Shift Premium</td>
                      <td className="p-3 text-center border-r border-slate-200 font-mono">{payroll.nightDiff_Hrs || "0"} hrs</td>
                      <td className="p-3 text-right font-semibold text-emerald-600">₱{formatCurrency(payroll.nightDiff_Amnt)}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200">Statutory Holiday Compensation Matrix</td>
                      <td className="p-3 text-center border-r border-slate-200 font-mono">{payroll.holidaysTotal || "0"} days</td>
                      <td className="p-3 text-right font-semibold text-emerald-600">₱{formatCurrency(parseFloat(payroll.legalHol_Amnt || 0) + parseFloat(payroll.specialHol_Amnt || 0))}</td>
                    </tr>
                    <tr className="bg-emerald-50/50 font-bold border-t border-slate-200">
                      <td className="p-3 pl-5 border-r border-slate-200 text-[#065f46]">Gross Earnings (Total Compensation)</td>
                      <td className="p-3 text-center border-r border-slate-200 font-mono">—</td>
                      <td className="p-3 text-right text-emerald-700">₱{formatCurrency(payroll.totalEarnings)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* New Separate Table for Non-Taxable Earnings */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 font-bold border-b border-slate-200">
                      <th className="p-3 text-left text-[#2A174E] uppercase tracking-wider" colSpan="2">Gross Earnings Analysis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2">Non-Taxable Earnings (Allowances/De Minimis)</td>
                      <td className="p-3 text-right font-semibold text-emerald-600">₱{formatCurrency(payroll.allowance)}</td>
                    </tr>
                    <tr className="bg-slate-50/50 font-bold border-t border-slate-200">
                      <td className="p-3 pl-5 border-r border-slate-200 text-slate-600 uppercase text-[10px]">Total Non-Taxable Earnings</td>
                      <td className="p-3 text-right text-emerald-700 font-mono">₱{formatCurrency(payroll.allowance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Mandatory Deductions Analysis Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 font-bold border-b border-slate-200">
                      <th className="p-3 text-left text-rose-800 uppercase tracking-wider" colSpan="2">Less: Mandatory and other deductions:</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2">Pag-ibig Loan</td>
                      <td className="p-3 text-right font-semibold text-rose-600">({formatCurrency(payroll.HDMF_Loan)})</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2">Negative Adjustment (Absences/Tardiness)</td>
                      <td className="p-3 text-right font-semibold text-rose-600">({formatCurrency(parseFloat(payroll.absence_Amnt || 0) + parseFloat(payroll.tardiness_Amnt || 0))})</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2">Philhealth</td>
                      <td className="p-3 text-right font-semibold text-rose-600">({formatCurrency(payroll.Philhealth_Ded)})</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2">SSS</td>
                      <td className="p-3 text-right font-semibold text-rose-600">({formatCurrency(payroll.SSS_Ded)})</td>
                    </tr>
                    <tr className="bg-slate-50/50 font-bold border-t border-slate-200">
                      <td className="p-3 pl-5 border-r border-slate-200 text-slate-600 uppercase text-[10px]">Total Deductions</td>
                      <td className="p-3 text-right text-rose-700 font-mono">({formatCurrency(parseFloat(payroll.totalDeductions || 0) - parseFloat(payroll.Tax_Ded || 0))})</td>
                    </tr>
                    <tr className="font-bold border-t border-slate-200">
                      <td className="p-3 pl-5 border-r border-slate-200 text-slate-600 uppercase text-[10px]">BIR (Withholding Tax)</td>
                      <td className="p-3 text-right text-rose-700 font-mono">({formatCurrency(payroll.Tax_Ded)})</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payroll Summary Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-5 shadow-sm">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#2A174E] text-white font-bold border-b border-slate-200">
                      <th className="p-3 text-left uppercase tracking-wider" colSpan="2">Payroll Summary Statement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2">Gross Earnings</td>
                      <td className="p-3 text-right font-bold text-slate-900">₱{formatCurrency(payroll.totalEarnings)}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2">Total Non-Taxable Earnings</td>
                      <td className="p-3 text-right font-bold text-emerald-600">₱{formatCurrency(payroll.allowance)}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2">Total Deductions</td>
                      <td className="p-3 text-right font-bold text-rose-600">({formatCurrency(parseFloat(payroll.totalDeductions || 0) - parseFloat(payroll.Tax_Ded || 0))})</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-5 border-r border-slate-200 w-1/2">BIR (Withholding Tax)</td>
                      <td className="p-3 text-right font-bold text-rose-600">({formatCurrency(payroll.Tax_Ded)})</td>
                    </tr>
                    <tr className="bg-amber-50 font-black border-t-2 border-slate-200">
                      <td className="p-3 pl-5 border-r border-slate-200 text-[#2A174E] uppercase text-[11px] tracking-tighter">Net Pay Record</td>
                      <td className="p-3 text-right text-[#2A174E] text-lg font-mono">₱{formatCurrency(payroll.netPay)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Year-To-Date (YTD) Summary Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 font-bold border-b border-slate-200">
                      <th className="p-2.5 text-left text-slate-500 uppercase tracking-widest" colSpan="2">Year-To-Date (YTD) Accumulated Totals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    <tr>
                      <td className="p-2.5 pl-5 border-r border-slate-200 w-1/2">YTD Gross Earnings</td>
                      <td className="p-2.5 text-right font-semibold">₱{formatCurrency(payroll.ytdGross)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-5 border-r border-slate-200 w-1/2">YTD Total Non-Taxable Earnings</td>
                      <td className="p-2.5 text-right font-semibold">₱{formatCurrency(payroll.ytdNonTaxable)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-5 border-r border-slate-200 w-1/2">YTD Total Deductions</td>
                      <td className="p-2.5 text-right font-semibold">({formatCurrency(payroll.ytdDeductions)})</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-5 border-r border-slate-200 w-1/2">YTD BIR (Withholding Tax)</td>
                      <td className="p-2.5 text-right font-semibold">({formatCurrency(payroll.ytdBIR)})</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Formal Signature Section */}
              <div className="mt-12 flex flex-col items-end text-right pr-8">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500">Received by:</p>
                  <div className="pt-8">
                    <p className="text-sm font-bold border-b border-slate-800 pb-1 w-64 text-center uppercase">{payroll.user_FirstName} {payroll.user_LastName}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1 text-center">Signed Over Printed Name</p>
                  </div>
                  <div className="pt-4">
                    <p className="text-xs font-medium">Date: <span className="border-b border-slate-300 inline-block w-32 ml-1"></span></p>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </DialogContent>

      {/* Embedded Minimal Scrollbar Control */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1; 
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8; 
        }
      `}} />
    </Dialog>
  );
};

export default ViewPayslipModal;
