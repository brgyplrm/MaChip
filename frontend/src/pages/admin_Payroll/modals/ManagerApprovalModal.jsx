import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import ReplayIcon from "@mui/icons-material/Replay";
import SearchIcon from "@mui/icons-material/Search";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import { fetchWithAuth } from "@/utils/api";

const ManagerApprovalModal = ({ isOpen, onClose, period, onDecisionSuccess, currentUser }) => {
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "breakdown" | "roster"
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [periodDetails, setPeriodDetails] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");

  useEffect(() => {
    if (!isOpen || !period?.periodId) return;

    let isMounted = true;
    const fetchDetails = async () => {
      setLoading(true);
      setErrorMsg("");
      setShowRejectBox(false);
      setRejectionReason("");
      try {
        const res = await fetchWithAuth(`/api/payroll/period/${period.periodId}/preflight-check`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setDiagnostics(data.diagnostics);
            setPeriodDetails(data.period);
          }
        } else {
          const err = await res.json().catch(() => ({}));
          if (isMounted) setErrorMsg(err.error || "Failed to load approval details.");
        }
      } catch (err) {
        if (isMounted) setErrorMsg("Network error loading details: " + err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();
    return () => { isMounted = false; };
  }, [isOpen, period?.periodId]);

  const formatCurrency = (val) =>
    parseFloat(val || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredRoster = useMemo(() => {
    if (!diagnostics?.employeeRoster) return [];
    if (!rosterSearch.trim()) return diagnostics.employeeRoster;
    const q = rosterSearch.toLowerCase();
    return diagnostics.employeeRoster.filter(
      (emp) =>
        (emp.firstName && emp.firstName.toLowerCase().includes(q)) ||
        (emp.lastName && emp.lastName.toLowerCase().includes(q)) ||
        (emp.department && emp.department.toLowerCase().includes(q)) ||
        (emp.position && emp.position.toLowerCase().includes(q)) ||
        String(emp.userId).includes(q)
    );
  }, [diagnostics?.employeeRoster, rosterSearch]);

  if (!isOpen || !period) return null;

  const handleApprove = async () => {
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetchWithAuth(`/api/payroll/period/${period.periodId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        if (onDecisionSuccess) onDecisionSuccess();
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Failed to approve payroll period.");
      }
    } catch (err) {
      setErrorMsg("Network error approving payroll: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setErrorMsg("Please provide feedback explaining what adjustments are needed.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetchWithAuth(`/api/payroll/period/${period.periodId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });

      if (res.ok) {
        if (onDecisionSuccess) onDecisionSuccess();
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Failed to return payroll to draft.");
      }
    } catch (err) {
      setErrorMsg("Network error rejecting payroll: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const rawChecklist = periodDetails?.checklistData || {};
  const accountantNotes = rawChecklist.accountantNotes || periodDetails?.rejectionReason;

  // Categorical subtotals for Tab 2
  const earn = diagnostics?.earningsBreakdown || {};
  const ded = diagnostics?.deductionsBreakdown || {};

  const statutorySubtotal =
    parseFloat(ded.totalSSS || 0) +
    parseFloat(ded.totalPhilHealth || 0) +
    parseFloat(ded.totalPagIbig || 0) +
    parseFloat(ded.totalWithholdingTax || 0);

  const loansSubtotal =
    parseFloat(ded.totalSSSLoan || 0) +
    parseFloat(ded.totalPagIbigLoan || 0) +
    parseFloat(ded.totalHMO || 0) +
    parseFloat(ded.totalCashAdvances || 0);

  const infractionsSubtotal =
    parseFloat(ded.totalTardiness || 0) +
    parseFloat(ded.totalAbsences || 0) +
    parseFloat(ded.totalUnpaidLeave || 0);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <Card className="w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border-0 overflow-hidden bg-white">
        {/* Header */}
        <div className="p-5 bg-[#0f244a] text-white shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">
                  Segregation of Duties
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider bg-emerald-400 text-slate-900 px-2 py-0.5 rounded">
                  The Checker
                </span>
              </div>
              <h3 className="font-bold text-lg sm:text-xl mt-1">
                Executive Payroll Authorization Cockpit
              </h3>
              <p className="text-xs text-slate-300">
                Period: {period.label || `${period.startDate} to ${period.endDate}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/10"
            >
              <CloseIcon />
            </Button>
          </div>

          {/* Cockpit Navigation Tabs */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/15">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "overview"
                  ? "bg-white text-[#0f244a] shadow-xs"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <MonetizationOnOutlinedIcon className="h-4 w-4" />
              <span>Summary &amp; Sign-Off</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("breakdown")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "breakdown"
                  ? "bg-white text-[#0f244a] shadow-xs"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <ReceiptLongOutlinedIcon className="h-4 w-4" />
              <span>Financial Composition</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("roster")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "roster"
                  ? "bg-white text-[#0f244a] shadow-xs"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <PeopleAltOutlinedIcon className="h-4 w-4" />
              <span>Employee Roster ({diagnostics?.employeeRoster?.length || 0})</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <CardContent className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
              <ErrorOutlineIcon className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW & SIGN-OFF                                               */}
          {/* ========================================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* Macro Financial Summary Cards */}
              {loading ? (
                <div className="py-8 text-center text-sm text-slate-500 animate-pulse">
                  Aggregating company payroll totals...
                </div>
              ) : diagnostics ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Total Gross Earnings
                    </span>
                    <p className="text-2xl font-bold text-slate-800 mt-1">
                      ₱{formatCurrency(diagnostics.totalGross)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Across {diagnostics.totalEmployees} eligible employees
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Total Deductions
                    </span>
                    <p className="text-2xl font-bold text-rose-600 mt-1">
                      -₱{formatCurrency(diagnostics.totalDeductions)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Statutory, Taxes &amp; Loan Remittances
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Total Net Bank Disbursement
                    </span>
                    <p className="text-2xl font-black text-emerald-700 mt-1">
                      ₱{formatCurrency(diagnostics.totalNet)}
                    </p>
                    <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                      Authorized company payout amount
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Accountant Verification & Sign-Off Record */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Accountant Pre-Flight Sign-Off
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Prepared by:{" "}
                      <strong className="text-slate-800">
                        {periodDetails?.submitterFirstName} {periodDetails?.submitterLastName}
                      </strong>{" "}
                      &bull; Submitted on {formatDate(periodDetails?.submittedAt)}
                    </p>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-semibold text-xs">
                    5 of 5 Domains Verified
                  </Badge>
                </div>

                {accountantNotes && (
                  <div className="text-xs bg-white p-3 rounded-lg border border-slate-200 text-slate-700">
                    <span className="font-semibold text-slate-800 block mb-1">
                      Accountant Remarks:
                    </span>
                    <p className="italic">"{accountantNotes}"</p>
                  </div>
                )}

                {/* Checklist Domain Summary Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Attendance &amp; DTR Integrity Confirmed</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Leaves &amp; OT Requests Reconciled</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Loan Amortizations Reconciled</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Financial Safeguards (0 Negative Net Pay)</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700 col-span-full">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Bank Fund Allocation Checked</span>
                  </div>
                </div>
              </div>

              {/* Rejection Feedback Box (if toggled) */}
              {showRejectBox && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-rose-800 uppercase tracking-wider">
                    Specify Reason for Returning to Draft:
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Please recalculate User MACJ-004 overtime hours and verify the EastWest loan deduction."
                    rows={3}
                    className="w-full text-xs p-3 border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white text-slate-800"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRejectBox(false)}
                      className="text-xs"
                    >
                      Cancel Rejection
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleReject}
                      disabled={submitting || !rejectionReason.trim()}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                    >
                      {submitting ? "Returning..." : "Confirm Return to Draft"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Manager Responsibility Notice */}
              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <strong>Management Notice:</strong> Authorizing this payroll confirms compliance with MAC-J internal disbursement policies and DOLE statutory guidelines. Approved batches can be released immediately or during scheduled bank clearing hours.
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: FINANCIAL COMPOSITION & CATEGORICAL BREAKDOWN                     */}
          {/* ========================================================================= */}
          {activeTab === "breakdown" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left Column: Gross Earnings Breakdown */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Incomes &amp; Gross Earnings
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-900">
                      ₱{formatCurrency(diagnostics?.totalGross)}
                    </span>
                  </div>
                  <div className="p-4 space-y-3 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <div>
                        <span className="font-semibold text-slate-800 block">Regular Basic Pay</span>
                        <span className="text-[11px] text-slate-500">Contracted shift schedules</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        ₱{formatCurrency(earn.totalBasic)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <div>
                        <span className="font-semibold text-slate-800 block">Overtime (OT) Earnings</span>
                        <span className="text-[11px] text-slate-500">Regular &amp; rest day OT (1.25x/1.30x)</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        ₱{formatCurrency(earn.totalOT)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <div>
                        <span className="font-semibold text-slate-800 block">Special Holiday Pay</span>
                        <span className="text-[11px] text-slate-500">Worked special non-working days (1.30x)</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        ₱{formatCurrency(earn.totalSpecialHol)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <div>
                        <span className="font-semibold text-slate-800 block">Regular Holiday Pay</span>
                        <span className="text-[11px] text-slate-500">Worked statutory regular holidays (2.0x)</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        ₱{formatCurrency(earn.totalLegalHol)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <div>
                        <span className="font-semibold text-slate-800 block">Night Shift Differential</span>
                        <span className="text-[11px] text-slate-500">10:00 PM – 06:00 AM work (1.10x)</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        ₱{formatCurrency(earn.totalNightDiff)}
                      </span>
                    </div>

                    <div className="pt-2 flex justify-between items-center font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span>Total Compensation Pool</span>
                      <span className="font-mono text-sm text-brand-primary">₱{formatCurrency(diagnostics?.totalGross)}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Deductions Schedule */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Deductions &amp; Remittances Schedule
                    </span>
                    <span className="text-xs font-bold font-mono text-rose-700">
                      -₱{formatCurrency(diagnostics?.totalDeductions)}
                    </span>
                  </div>
                  <div className="p-4 space-y-3 text-xs">
                    {/* Category A: Statutory & Taxes */}
                    <div>
                      <div className="flex justify-between items-center font-bold text-slate-700 text-[11px] uppercase tracking-wider pb-1 border-b border-slate-200">
                        <span>A. Statutory &amp; BIR Tax Remittances</span>
                        <span className="font-mono text-slate-800">₱{formatCurrency(statutorySubtotal)}</span>
                      </div>
                      <div className="space-y-1.5 pt-2 pl-2 text-slate-600">
                        <div className="flex justify-between items-center">
                          <span>SSS Contribution (EE Share)</span>
                          <span className="font-mono font-medium text-slate-800">₱{formatCurrency(ded.totalSSS)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>PhilHealth Contribution (EE Share)</span>
                          <span className="font-mono font-medium text-slate-800">₱{formatCurrency(ded.totalPhilHealth)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Pag-IBIG / HDMF (EE Share)</span>
                          <span className="font-mono font-medium text-slate-800">₱{formatCurrency(ded.totalPagIbig)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Withholding Tax (TRAIN Law)</span>
                          <span className="font-mono font-medium text-slate-800">₱{formatCurrency(ded.totalWithholdingTax)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Category B: Loans, HMO & Advances */}
                    <div className="pt-1">
                      <div className="flex justify-between items-center font-bold text-slate-700 text-[11px] uppercase tracking-wider pb-1 border-b border-slate-200">
                        <span>B. Institutional Loans &amp; Health Insurance</span>
                        <span className="font-mono text-slate-800">₱{formatCurrency(loansSubtotal)}</span>
                      </div>
                      <div className="space-y-1.5 pt-2 pl-2 text-slate-600">
                        <div className="flex justify-between items-center">
                          <span>SSS Calamity / Salary Loans</span>
                          <span className="font-mono font-medium text-slate-800">₱{formatCurrency(ded.totalSSSLoan)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Pag-IBIG Multi-Purpose Loans</span>
                          <span className="font-mono font-medium text-slate-800">₱{formatCurrency(ded.totalPagIbigLoan)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Maxicare HMO Premium Co-Share</span>
                          <span className="font-mono font-medium text-slate-800">₱{formatCurrency(ded.totalHMO)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Cash Advances &amp; EastWest Notes</span>
                          <span className="font-mono font-medium text-slate-800">₱{formatCurrency(ded.totalCashAdvances)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Category C: Attendance Adjustments */}
                    <div className="pt-1">
                      <div className="flex justify-between items-center font-bold text-slate-700 text-[11px] uppercase tracking-wider pb-1 border-b border-slate-200">
                        <span>C. Biometric Attendance Infractions</span>
                        <span className="font-mono text-slate-800">₱{formatCurrency(infractionsSubtotal)}</span>
                      </div>
                      <div className="space-y-1.5 pt-2 pl-2 text-slate-600">
                        <div className="flex justify-between items-center">
                          <span>Tardiness Penalties</span>
                          <span className="font-mono font-medium text-slate-800">₱{formatCurrency(ded.totalTardiness)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Absences &amp; Unworked Days</span>
                          <span className="font-mono font-medium text-slate-800">₱{formatCurrency(ded.totalAbsences)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Unpaid Leaves</span>
                          <span className="font-mono font-medium text-slate-800">₱{formatCurrency(ded.totalUnpaidLeave)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-between items-center font-bold text-rose-800 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                      <span>Total Withholdings Pool</span>
                      <span className="font-mono text-sm">-₱{formatCurrency(diagnostics?.totalDeductions)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Payout Reconciliation Strip */}
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Net Disbursement Reconciliation
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Gross Compensation (₱{formatCurrency(diagnostics?.totalGross)}) &minus; Deductions (₱{formatCurrency(diagnostics?.totalDeductions)}) =
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-700 block uppercase tracking-wider">Authorized Company Payout</span>
                  <span className="text-2xl font-black text-emerald-800 font-mono">
                    ₱{formatCurrency(diagnostics?.totalNet)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: EMPLOYEE PAYOUT ROSTER                                            */}
          {/* ========================================================================= */}
          {activeTab === "roster" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <p className="text-xs text-slate-600">
                  Showing <strong>{filteredRoster.length}</strong> of <strong>{diagnostics?.employeeRoster?.length || 0}</strong> personnel line-items for this cutoff.
                </p>
                <div className="relative w-full sm:w-64">
                  <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search name, position, dept..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs max-h-96 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Personnel</th>
                      <th className="py-2.5 px-3 font-bold">Dept &amp; Role</th>
                      <th className="py-2.5 px-3 font-bold text-right">Basic Pay</th>
                      <th className="py-2.5 px-3 font-bold text-right">Gross Pay</th>
                      <th className="py-2.5 px-3 font-bold text-right">Deductions</th>
                      <th className="py-2.5 px-3 font-bold text-right">Net Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRoster.map((emp) => (
                      <tr key={emp.payrollId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-800 block">
                            {emp.lastName}, {emp.firstName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">ID: {emp.userId}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-slate-700 block">{emp.position || "Staff"}</span>
                          <span className="text-[10px] text-slate-500 uppercase">{emp.department || "Operations"}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          ₱{formatCurrency(emp.basicPay)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-semibold">
                          ₱{formatCurrency(emp.grossPay)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                          -₱{formatCurrency(emp.totalDeductions)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                          ₱{formatCurrency(emp.netPay)}
                        </td>
                      </tr>
                    ))}
                    {filteredRoster.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                          No personnel matched search query "{rosterSearch}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>

        {/* Footer Decision Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Close
          </Button>

          {!showRejectBox && (
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => {
                  setActiveTab("overview");
                  setShowRejectBox(true);
                }}
                disabled={submitting}
                className="border-rose-300 text-rose-700 hover:bg-rose-50 flex items-center gap-1.5"
              >
                <ReplayIcon className="h-4 w-4" />
                <span>Return with Feedback</span>
              </Button>

              <Button
                onClick={handleApprove}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
              >
                <ThumbUpAltIcon className="h-4 w-4" />
                <span>
                  {submitting ? "Authorizing..." : "Authorize & Approve Payroll"}
                </span>
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ManagerApprovalModal;
