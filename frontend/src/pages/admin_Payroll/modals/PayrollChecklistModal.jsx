import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SendIcon from "@mui/icons-material/Send";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { fetchWithAuth } from "@/utils/api";

const PayrollChecklistModal = ({ isOpen, onClose, period, onSubmitSuccess, currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [isRescanning, setIsRescanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedCard, setExpandedCard] = useState(null); // 'punches' | 'requests' | 'negative' | null

  // Determine role-appropriate management request hub (never employee personal view /requests)
  const userRoleId = Number(
    currentUser?.user_RoleId ||
    currentUser?.roleId ||
    (() => {
      try {
        return JSON.parse(localStorage.getItem("userData") || "{}")?.user_RoleId;
      } catch {
        return null;
      }
    })()
  );
  const isAccountant = userRoleId === 4;
  const requestsHubUrl = isAccountant ? "/adminoversight" : "/adminRequests?tab=pending";
  const requestsHubLabel = isAccountant ? "Requests Oversight Hub" : "Requests Management Hub";

  const [checklist, setChecklist] = useState({
    dtrIntegrity: false,
    requestsResolved: false,
    loansReconciled: false,
    financialSafeguards: false,
    bankReconciliation: false,
  });

  const [accountantNotes, setAccountantNotes] = useState("");

  const fetchDiagnostics = useCallback(async (isSilent = false) => {
    if (!period?.periodId) return;
    if (isSilent) {
      setIsRescanning(true);
    } else {
      setLoading(true);
    }
    setErrorMsg("");

    try {
      const res = await fetchWithAuth(`/api/payroll/period/${period.periodId}/preflight-check`);
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data.diagnostics);
        setChecklist((prev) => ({
          ...prev,
          dtrIntegrity: data.diagnostics.unclosedPunchesCount === 0 ? true : prev.dtrIntegrity,
          requestsResolved: data.diagnostics.pendingRequestsCount === 0 ? true : prev.requestsResolved,
          financialSafeguards: data.diagnostics.negativeNetPayCount === 0 ? true : prev.financialSafeguards,
        }));
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Failed to load pre-flight diagnostics.");
      }
    } catch (err) {
      setErrorMsg("Network error loading diagnostics: " + err.message);
    } finally {
      setLoading(false);
      setIsRescanning(false);
    }
  }, [period?.periodId]);

  useEffect(() => {
    if (!isOpen || !period?.periodId) return;
    fetchDiagnostics(false);
  }, [isOpen, period?.periodId, fetchDiagnostics]);

  if (!isOpen || !period) return null;

  const handleToggle = (key) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecked = Object.values(checklist).every(Boolean);
  const isSubmissionWindowOpen = diagnostics?.isSubmissionWindowOpen !== false;
  const canSubmit = allChecked && isSubmissionWindowOpen;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetchWithAuth(`/api/payroll/period/${period.periodId}/submit-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistData: checklist,
          accountantNotes: accountantNotes.trim(),
        }),
      });

      if (res.ok) {
        if (onSubmitSuccess) onSubmitSuccess();
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Failed to submit payroll for approval.");
      }
    } catch (err) {
      setErrorMsg("Network error submitting payroll: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val) =>
    parseFloat(val || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border-0 overflow-hidden bg-white">
        {/* Header */}
        <div className="flex justify-between items-center p-5 bg-brand-primary text-white shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">
                Segregation of Duties
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider bg-amber-400 text-slate-900 px-2 py-0.5 rounded">
                The Maker
              </span>
            </div>
            <h3 className="font-bold text-lg mt-1">
              Payroll Pre-Flight Verification Checklist
            </h3>
            <p className="text-xs text-indigo-100">
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

        {/* Content Body */}
        <CardContent className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
              <ErrorOutlineIcon className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Automated System Diagnostics Strip */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Automated Pre-Flight Scan Results
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fetchDiagnostics(true)}
                disabled={isRescanning || loading}
                className="h-7 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 flex items-center gap-1.5 px-2"
                title="Re-run diagnostic anomaly scan against current database records"
              >
                <RefreshIcon className={`h-3.5 w-3.5 ${isRescanning ? "animate-spin text-brand-primary" : ""}`} />
                <span>{isRescanning ? "Scanning..." : "Re-Scan"}</span>
              </Button>
            </div>

            {loading ? (
              <div className="py-4 text-center text-sm text-slate-500 animate-pulse">
                Auditing cutoff records and running anomaly detection...
              </div>
            ) : diagnostics ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  {/* Card 1: Unclosed Punches */}
                  <div
                    onClick={() => diagnostics.unclosedPunchesCount > 0 && setExpandedCard(expandedCard === "punches" ? null : "punches")}
                    className={`p-2.5 rounded-lg border transition-all ${diagnostics.unclosedPunchesCount === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800 cursor-pointer hover:border-amber-400 hover:shadow-xs"}`}
                  >
                    <p className="text-xl font-bold">{diagnostics.unclosedPunchesCount}</p>
                    <p className="text-[11px] font-medium mt-0.5">Unclosed Punches</p>
                    {diagnostics.unclosedPunchesCount > 0 && (
                      <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-bold text-amber-800">
                        <span>{expandedCard === "punches" ? "Hide" : "Details"}</span>
                        {expandedCard === "punches" ? <ExpandLessIcon className="h-3 w-3" /> : <ExpandMoreIcon className="h-3 w-3" />}
                      </div>
                    )}
                  </div>

                  {/* Card 2: Pending Requests */}
                  <div
                    onClick={() => diagnostics.pendingRequestsCount > 0 && setExpandedCard(expandedCard === "requests" ? null : "requests")}
                    className={`p-2.5 rounded-lg border transition-all ${diagnostics.pendingRequestsCount === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800 cursor-pointer hover:border-amber-400 hover:shadow-xs"}`}
                  >
                    <p className="text-xl font-bold">{diagnostics.pendingRequestsCount}</p>
                    <p className="text-[11px] font-medium mt-0.5">Pending Requests</p>
                    {diagnostics.pendingRequestsCount > 0 && (
                      <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-bold text-amber-800">
                        <span>{expandedCard === "requests" ? "Hide" : "Details"}</span>
                        {expandedCard === "requests" ? <ExpandLessIcon className="h-3 w-3" /> : <ExpandMoreIcon className="h-3 w-3" />}
                      </div>
                    )}
                  </div>

                  {/* Card 3: Negative Net Pay */}
                  <div
                    onClick={() => diagnostics.negativeNetPayCount > 0 && setExpandedCard(expandedCard === "negative" ? null : "negative")}
                    className={`p-2.5 rounded-lg border transition-all ${diagnostics.negativeNetPayCount === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800 cursor-pointer hover:border-rose-400 hover:shadow-xs"}`}
                  >
                    <p className="text-xl font-bold">{diagnostics.negativeNetPayCount}</p>
                    <p className="text-[11px] font-medium mt-0.5">Negative Net Pay</p>
                    {diagnostics.negativeNetPayCount > 0 && (
                      <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-bold text-rose-800">
                        <span>{expandedCard === "negative" ? "Hide" : "Details"}</span>
                        {expandedCard === "negative" ? <ExpandLessIcon className="h-3 w-3" /> : <ExpandMoreIcon className="h-3 w-3" />}
                      </div>
                    )}
                  </div>

                  {/* Card 4: Net Payout */}
                  <div className="p-2.5 rounded-lg border bg-blue-50 border-blue-200 text-blue-800">
                    <p className="text-xl font-bold">₱{formatCurrency(diagnostics.totalNet)}</p>
                    <p className="text-[11px] font-medium mt-0.5">Net ({diagnostics.totalEmployees} Emps)</p>
                  </div>
                </div>

                {/* Inline Quick Peek Drawer: Pending Requests */}
                {expandedCard === "requests" && (
                  <div className="mt-3 p-3 bg-white border border-amber-200 rounded-lg text-left text-xs space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-1.5 border-b border-amber-100">
                      <span className="font-bold text-amber-950">
                        Pending Requests ({diagnostics.pendingRequestsList?.length || 0})
                      </span>
                      <a
                        href={requestsHubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-brand-primary hover:underline flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                        title={
                          isAccountant
                            ? "Opens Admin Requests Oversight in a separate tab to monitor and ping approvers"
                            : "Opens Requests Management in a separate tab to review, approve, or reject pending items"
                        }
                      >
                        <span>{requestsHubLabel}</span>
                        <OpenInNewIcon className="h-3 w-3" />
                      </a>
                    </div>
                    {diagnostics.pendingRequestsList && diagnostics.pendingRequestsList.length > 0 ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                        {diagnostics.pendingRequestsList.map((req) => {
                          const itemUrl = isAccountant
                            ? `/adminoversight?requestId=${req.reqId}`
                            : `/adminRequests?requestId=${req.reqId}`;
                          return (
                            <div
                              key={req.reqId}
                              className="flex items-center justify-between p-2 rounded bg-amber-50/60 border border-amber-200/60 text-xs hover:bg-amber-100/60 transition-colors"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <a
                                  href={itemUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-bold text-slate-800 hover:text-brand-primary hover:underline truncate"
                                  title={`Open ${req.firstName} ${req.lastName}'s request in ${isAccountant ? "Requests Oversight" : "Requests Management"}`}
                                >
                                  {req.firstName} {req.lastName}
                                </a>
                                <span className="text-slate-500 font-medium shrink-0">
                                  • {req.typeName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] font-mono text-amber-900 bg-white px-1.5 py-0.5 rounded border border-amber-200">
                                  {req.effectiveDate || (req.dateFiled ? req.dateFiled.substring(0, 10) : "Pending")}
                                </span>
                                <a
                                  href={itemUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-400 hover:text-brand-primary"
                                  title="Inspect in new tab"
                                >
                                  <OpenInNewIcon className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">No pending requests detected.</p>
                    )}
                  </div>
                )}

                {/* Inline Quick Peek Drawer: Unclosed Punches */}
                {expandedCard === "punches" && (
                  <div className="mt-3 p-3 bg-white border border-amber-200 rounded-lg text-left text-xs space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-1.5 border-b border-amber-100">
                      <span className="font-bold text-amber-950">
                        Irregular / Unclosed Shift Records ({diagnostics.unclosedPunchesList?.length || 0})
                      </span>
                      <a
                        href="/logs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-brand-primary hover:underline flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                      >
                        <span>View Attendance Logs</span>
                        <OpenInNewIcon className="h-3 w-3" />
                      </a>
                    </div>
                    {diagnostics.unclosedPunchesList && diagnostics.unclosedPunchesList.length > 0 ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                        {diagnostics.unclosedPunchesList.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded bg-amber-50/60 border border-amber-200/60 text-xs">
                            <span className="font-bold text-slate-800">{p.firstName} {p.lastName}</span>
                            <span className="font-mono text-amber-900">{p.logDate}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">No unclosed punches detected.</p>
                    )}
                  </div>
                )}

                {/* Inline Quick Peek Drawer: Negative Net Pay */}
                {expandedCard === "negative" && (
                  <div className="mt-3 p-3 bg-white border border-rose-200 rounded-lg text-left text-xs space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-1.5 border-b border-rose-100">
                      <span className="font-bold text-rose-950">
                        Zero / Negative Take-Home Pay Outliers ({diagnostics.negativeNetPayList?.length || 0})
                      </span>
                    </div>
                    {diagnostics.negativeNetPayList && diagnostics.negativeNetPayList.length > 0 ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                        {diagnostics.negativeNetPayList.map((n, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded bg-rose-50/60 border border-rose-200/60 text-xs">
                            <span className="font-bold text-slate-800">{n.firstName} {n.lastName}</span>
                            <span className="font-mono font-bold text-rose-700">₱{formatCurrency(n.netPay)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">No negative pay outliers detected.</p>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* 5-Domain Checklist Affirmation */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Mandatory Operational Affirmations
            </h4>

            {/* Item 1 */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${checklist.dtrIntegrity ? "bg-emerald-50/50 border-emerald-300" : "bg-white border-slate-200 hover:border-slate-300"}`}>
              <input
                type="checkbox"
                checked={checklist.dtrIntegrity}
                onChange={() => handleToggle("dtrIntegrity")}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block text-sm">
                  1. Attendance & DTR Integrity
                </span>
                <span className="text-slate-600">
                  Confirmed that all raw punches, night differentials, restday schedules, and holiday multipliers align with physical shift records and DOLE statutory rates.
                </span>
              </div>
            </label>

            {/* Item 2 */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${checklist.requestsResolved ? "bg-emerald-50/50 border-emerald-300" : "bg-white border-slate-200 hover:border-slate-300"}`}>
              <input
                type="checkbox"
                checked={checklist.requestsResolved}
                onChange={() => handleToggle("requestsResolved")}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block text-sm">
                  2. Employee Requests & Leave Balances
                </span>
                <span className="text-slate-600">
                  Confirmed that all overtime, leave, and official business requests for this cutoff window have been officially approved or rejected, and leave credits reconciled.
                </span>
              </div>
            </label>

            {/* Item 3 */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${checklist.loansReconciled ? "bg-emerald-50/50 border-emerald-300" : "bg-white border-slate-200 hover:border-slate-300"}`}>
              <input
                type="checkbox"
                checked={checklist.loansReconciled}
                onChange={() => handleToggle("loansReconciled")}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block text-sm">
                  3. Loans, Cash Advances & Voluntary Deductions
                </span>
                <span className="text-slate-600">
                  Verified SSS/Pag-IBIG loan amortizations against monthly billing statements, and confirmed company cash advance balances are properly decremented.
                </span>
              </div>
            </label>

            {/* Item 4 */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${checklist.financialSafeguards ? "bg-emerald-50/50 border-emerald-300" : "bg-white border-slate-200 hover:border-slate-300"}`}>
              <input
                type="checkbox"
                checked={checklist.financialSafeguards}
                onChange={() => handleToggle("financialSafeguards")}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block text-sm">
                  4. Outlier & Financial Safeguard Verification
                </span>
                <span className="text-slate-600">
                  Affirmed zero employees have negative or zero net take-home pay, and all daily rate changes since the previous cutoff have been explicitly audited.
                </span>
              </div>
            </label>

            {/* Item 5 */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${checklist.bankReconciliation ? "bg-emerald-50/50 border-emerald-300" : "bg-white border-slate-200 hover:border-slate-300"}`}>
              <input
                type="checkbox"
                checked={checklist.bankReconciliation}
                onChange={() => handleToggle("bankReconciliation")}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block text-sm">
                  5. Bank Remittance Reconciliation
                </span>
                <span className="text-slate-600">
                  Cross-referenced the total net disbursement figure with MAC-J company payroll account balance and confirmed funds availability.
                </span>
              </div>
            </label>
          </div>

          {/* Accountant Remarks / Memo to Manager */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Preparer Remarks / Notes for Management
            </label>
            <textarea
              value={accountantNotes}
              onChange={(e) => setAccountantNotes(e.target.value)}
              placeholder="e.g., Special holiday rate verified with DOLE circular. Overtime approved by Operations Lead."
              rows={3}
              className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/40 text-slate-800"
            />
          </div>

          {/* Preparer Digital Signature Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-800">Preparer:</span>{" "}
              {currentUser?.fullName || `${currentUser?.user_FirstName || ''} ${currentUser?.user_LastName || ''}`.trim() || "Accounting Staff"}
            </div>
            <div className="text-slate-500">
              Session-bound electronic submission
            </div>
          </div>
        </CardContent>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {!isSubmissionWindowOpen && diagnostics?.submissionOpenDate && (
              <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 font-medium text-center">
                Submission opens 2 days prior to cutoff conclusion ({diagnostics.submissionOpenDate}).
              </span>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={`flex items-center gap-2 ${canSubmit ? "bg-brand-primary hover:bg-[#7A52B5] text-white" : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}
            >
              <SendIcon className="h-4 w-4" />
              <span>
                {submitting ? "Submitting for Approval..." : "Submit for Management Approval"}
              </span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PayrollChecklistModal;
