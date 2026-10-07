import React from "react";
import { 
  CheckCircle2, 
  Users, 
  Banknote, 
  TrendingUp, 
  Receipt, 
  ShieldCheck, 
  Archive, 
  Mail, 
  Eye, 
  Download, 
  X 
} from "lucide-react";
import { Button } from "@/components/ui/button";

const formatMoney = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function ReleaseSummaryModal({
  isOpen,
  onClose,
  data,
  onPreviewSummary,
  onDownloadSummary,
}) {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0 duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-modal-title"
      >
        {/* Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 id="release-modal-title" className="text-xl font-bold tracking-tight text-white">
                Batch Payroll Released & Locked
              </h2>
              <p className="text-emerald-100 text-sm mt-0.5 font-medium">
                {data.periodLabel || "Designated Payroll Period"} &bull; Status: Released
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Key Metrics Grid */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Release Financial Metrics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Metric 1 */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">Employees</span>
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <span className="text-xl font-extrabold text-slate-800">
                  {data.employeeCount || data.processed || 0}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Active records</span>
              </div>

              {/* Metric 2 */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-emerald-700 mb-1">
                  <span className="text-xs font-semibold">Net Payout</span>
                  <Banknote className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-xl font-extrabold text-emerald-900">
                  &#8369;{formatMoney(data.totalNetPay)}
                </span>
                <span className="text-[11px] text-emerald-700 font-medium">Total disbursement</span>
              </div>

              {/* Metric 3 */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">Gross Pay</span>
                  <TrendingUp className="w-4 h-4 text-slate-400" />
                </div>
                <span className="text-base font-bold text-slate-800">
                  &#8369;{formatMoney(data.totalEarnings)}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Basic + OT + Hol</span>
              </div>

              {/* Metric 4 */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">Deductions</span>
                  <Receipt className="w-4 h-4 text-slate-400" />
                </div>
                <span className="text-base font-bold text-slate-800">
                  &#8369;{formatMoney(data.totalDeductions)}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Statutory + loans</span>
              </div>
            </div>
          </div>

          {/* Audit & Compliance Milestones */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              System Audit &amp; Archival Verification
            </h3>
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 divide-y divide-slate-200/70">
              {/* Item 1 */}
              <div className="flex items-start gap-3 py-2 first:pt-0">
                <div className="p-1 rounded-md bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Audit-Locked Payroll State</h4>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    Payroll entries locked with immutable rate snapshots. Period status promoted to <strong>Released</strong>.
                  </p>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex items-start gap-3 py-2">
                <div className="p-1 rounded-md bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                  <Archive className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Secure Document Archival</h4>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    Password-protected standard payslips, detailed breakdowns, and official DTR PDFs archived to local company storage.
                  </p>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex items-start gap-3 py-2 last:pb-0">
                <div className="p-1 rounded-md bg-purple-100 text-purple-700 shrink-0 mt-0.5">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Employee Payslip Notifications</h4>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    Encrypted PDF attachments and net pay summaries dispatched to employee registered email addresses.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onPreviewSummary && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPreviewSummary}
                className="w-full sm:w-auto text-slate-700 border-slate-300 hover:bg-slate-100"
              >
                <Eye className="w-4 h-4 mr-1.5 text-slate-500" />
                Preview Summary
              </Button>
            )}
            {onDownloadSummary && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadSummary}
                className="w-full sm:w-auto text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
              >
                <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
                Download PDF
              </Button>
            )}
          </div>
          <Button
            size="sm"
            onClick={onClose}
            className="w-full sm:w-auto bg-brand-primary hover:bg-[#7A52B5] text-white px-5 shadow-sm"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
