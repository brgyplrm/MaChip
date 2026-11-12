import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fetchWithAuth } from "../utils/api";
import { getStoredUser } from "../utils/authStorage";
import CloseIcon from "@mui/icons-material/Close";
import StaticTimePickerLandscape from "./StaticTimePickerLandscape";

const calculateAmortizationStart = (dateStr, agency, loanType) => {
  if (!dateStr) return "";
  const approvalDate = new Date(dateStr);
  if (isNaN(approvalDate.getTime())) return "";

  let monthsToAdd = 1;
  if (agency === "SSS") {
    monthsToAdd = loanType === "Emergency Loan" ? 6 : 2;
  } else if (agency === "Pag-IBIG") {
    monthsToAdd = loanType === "Calamity Loan" ? 4 : 1;
  }

  const startMonth = new Date(approvalDate.getFullYear(), approvalDate.getMonth() + monthsToAdd, 1);
  const yyyy = startMonth.getFullYear();
  const mm = String(startMonth.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
};

const EditRequestModal = ({ isOpen, onClose, request, onUpdate, onDirtyChange }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [modificationReason, setModificationReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [replacementFile, setReplacementFile] = useState(null);
  const initialSnapshotRef = useRef(null);

  const currentUser = getStoredUser();
  const isOwner = currentUser?.user_Id === request?.user_Id;
  const isEmployee = isOwner || request?.emp_reqStatusId === 5;
  const existingAttachment = request?.proof_File || request?.ST_proof_File || request?.SL_proof_File || request?.OW_proof_File || request?.LC_proof_File || request?.LR_proof_File;

  useEffect(() => {
    if (request && isOpen) {
      setReplacementFile(null);
      setModificationReason("");
      setErrorMessage("");
      // Find the existing payment status from any of the potential fields
      const initialWithPayID = request.VL_WithPayID || request.SL_WithPayID || request.EL_WithPayID || request.HD_WithPayID || request.ST_WithPayID || 1;
      const approvalDate = request.LR_approvalDate || "";
      const agency = request.LR_agency || "";
      const loanType = request.LR_loanType || "";
      let startMonth = request.LR_amortizationStart || "";
      if (!startMonth && approvalDate) {
        startMonth = calculateAmortizationStart(approvalDate, agency, loanType);
      }
      
      const initialValues = {
        emp_reqTypeId: request.emp_reqTypeId,
        remarks: request.remarks || "",
        // OT fields
        OT_DateOf: request.OT_DateOf || "",
        HrFrom: request.HrFrom || "",
        HrTo: request.HrTo || "",
        Total_Hrs: request.Total_Hrs || 0,
        // Leave fields
        StartDate: request.VL_StartDate || request.SL_StartDate || request.ST_StartDate || request.EL_DateOfLeave || request.HD_DateOfLeave || request.DateonField || "",
        EndDate: request.VL_EndDate || request.SL_EndDate || request.ST_EndDate || "",
        NoDays: request.VL_NoDays || request.SL_NoDays || request.ST_NoDays || request.EL_NoDays || 0,
        WithPayID: String(initialWithPayID),
        // Onfield fields
        DateonField: request.DateonField || "",
        NoHrs: request.OW_NoHrs || 0,
        destination: request.destination || "",
        // Log Correction fields
        logDate: request.LC_logDate || "",
        claimedIn: request.LC_claimedIn || "",
        claimedOut: request.LC_claimedOut || "",
        correctionCategory: request.LC_correctionCategory || "",
        period: request.HD_period || "",
        // Loan fields
        agency: agency,
        loanType: loanType,
        amountRequested: request.LR_amount || "",
        monthsToPay: request.LR_months || "",
        loanReferenceNo: request.LR_reference || "",
        monthlyAmortization: request.LR_amortization || "",
        totalOutstandingBalance: request.LR_balance || "",
        pagibigTAV: request.LR_pagibigTAV || "",
        loanApprovalDate: approvalDate,
        amortizationStartMonth: startMonth,
        calamityArea: request.LR_calamityArea || "",
        deductionFrequency: request.LR_deductionFrequency || "semi-monthly",
      };
      setFormData(initialValues);
      initialSnapshotRef.current = initialValues;
    }
  }, [request, isOpen]);

  const isDirty = useMemo(() => {
    if (!isOpen || !request) return false;
    if (modificationReason.trim() !== "" || replacementFile !== null) return true;
    if (!initialSnapshotRef.current) return false;
    return Object.keys(initialSnapshotRef.current).some(
      (key) => String(formData[key] ?? "") !== String(initialSnapshotRef.current[key] ?? "")
    );
  }, [isOpen, request, modificationReason, replacementFile, formData]);

  useEffect(() => {
    if (typeof onDirtyChange === "function") {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => {
      if (typeof onDirtyChange === "function") {
        onDirtyChange(false);
      }
    };
  }, [onDirtyChange]);

  if (!isOpen || !request) return null;

  const typeId = Number(request.emp_reqTypeId);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    // Auto-calculate amortization for SSS & Pag-IBIG loans instantaneously (0ms delay)
    if (["amountRequested", "monthsToPay", "loanType", "agency"].includes(name)) {
      const principal = name === "amountRequested" ? parseFloat(value) : parseFloat(newFormData.amountRequested || 0);
      const term = name === "monthsToPay" ? parseInt(value) : parseInt(newFormData.monthsToPay || 0);
      const agency = name === "agency" ? value : newFormData.agency;
      const loanType = name === "loanType" ? value : newFormData.loanType;

      if (principal > 0 && term > 0) {
        let annualRate = 0;
        if (agency === 'SSS') {
          annualRate = (loanType === 'Calamity Loan') ? 0.06 : 0.10;
        } else if (agency === 'Pag-IBIG') {
          annualRate = (loanType === "Calamity Loan") ? 0.0595 : 0.105;
        }

        if (annualRate > 0) {
          const monthlyRate = annualRate / 12;
          const factor = Math.pow(1 + monthlyRate, term);
          newFormData.monthlyAmortization = Math.round((principal * monthlyRate * factor) / (factor - 1));
        } else if (agency === 'Company') {
          newFormData.monthlyAmortization = Math.round(principal / term);
        }
      }
    }

    if (name === "loanApprovalDate") {
      const derivedStart = calculateAmortizationStart(value, newFormData.agency, newFormData.loanType);
      if (derivedStart) {
        newFormData.amortizationStartMonth = derivedStart;
      }
    }

    if (name === "HrFrom" || name === "HrTo") {
      const fromTime = name === "HrFrom" ? value : newFormData.HrFrom;
      const toTime = name === "HrTo" ? value : newFormData.HrTo;
      if (fromTime && toTime) {
        const [h1, m1] = fromTime.split(':').map(Number);
        const [h2, m2] = toTime.split(':').map(Number);
        if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
          const diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diffMinutes > 0) {
            newFormData.Total_Hrs = (diffMinutes / 60).toFixed(2);
          }
        }
      }
    }

    setFormData(newFormData);
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'agency') {
        updated.loanType = "";
      }
      if (name === 'agency' || name === 'loanType') {
        if (updated.loanApprovalDate) {
          const derived = calculateAmortizationStart(updated.loanApprovalDate, updated.agency, updated.loanType);
          if (derived) updated.amortizationStartMonth = derived;
        }
      }
      if (name === 'monthsToPay' && updated.agency === 'Pag-IBIG' && updated.amountRequested) {
        const principal = parseFloat(updated.amountRequested || 0);
        const term = parseInt(value || 0);
        if (principal > 0 && term > 0) {
          const annualRate = updated.loanType === "Calamity Loan" ? 0.0595 : 0.105;
          const monthlyRate = annualRate / 12;
          const factor = Math.pow(1 + monthlyRate, term);
          updated.monthlyAmortization = Math.round((principal * monthlyRate * factor) / (factor - 1));
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== undefined && formData[key] !== null) {
          payload.append(key, formData[key]);
        }
      });
      payload.append("reason", formData.remarks || "");
      payload.append("remarks", formData.remarks || "");
      payload.append("WithPayID", parseInt(formData.WithPayID) || 1);
      payload.append("modificationReason", modificationReason);
      if (request.emp_reqStatusId === 5) {
        payload.append("resend", "true");
      }
      if (replacementFile) {
        payload.append("proofFile", replacementFile);
      }
      
      const response = await fetchWithAuth(`/api/request/update/${request.emp_reqId}`, {
        method: "PUT",
        body: payload,
      });
      if (response.ok) {
        if (typeof onDirtyChange === "function") {
          onDirtyChange(false);
        }
        onUpdate();
        onClose();
        setModificationReason(""); 
        setReplacementFile(null);
        setErrorMessage("");
      } else {
        const error = await response.json().catch(() => ({}));
        setErrorMessage(error.error || "Failed to update request");
      }
    } catch (err) {
      console.error("Error updating request:", err);
      setErrorMessage("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAttempt = () => {
    if (isDirty) {
      if (!window.confirm("You have unsaved changes in this modal. Are you sure you want to discard them and exit?")) {
        return;
      }
    }
    if (typeof onDirtyChange === "function") {
      onDirtyChange(false);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-brand-primary">Edit Request #REQ-{request.emp_reqId}</h2>
            <p className="text-sm text-slate-500">{request.reqTypeName} for {request.userName}</p>
          </div>
          <button onClick={handleCloseAttempt} className="p-2 hover:bg-slate-200 rounded-full transition-colors cursor-pointer">
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg font-medium">
              {errorMessage}
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Conditional fields based on type */}
            {typeId === 1 && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">OT Date</label>
                  <Input type="date" name="OT_DateOf" value={formData.OT_DateOf} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Total Hours</label>
                  <Input type="number" name="Total_Hrs" value={formData.Total_Hrs} onChange={handleInputChange} step="0.01" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-bold text-slate-700">Overtime Hours Range</label>
                  <StaticTimePickerLandscape
                    items={[
                      {
                        label: "Time From",
                        name: "HrFrom",
                        value: formData.HrFrom,
                        helperText: "Select overtime start time",
                      },
                      {
                        label: "Time To",
                        name: "HrTo",
                        value: formData.HrTo,
                        helperText: "Select overtime end time (max 10:00 PM)",
                      },
                    ]}
                    onChange={handleInputChange}
                  />
                </div>
              </>
            )}

            {typeId === 2 && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Date on Field</label>
                  <Input type="date" name="DateonField" value={formData.DateonField || ""} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Total Hours</label>
                  <Input type="number" name="NoHrs" value={formData.NoHrs || ""} onChange={handleInputChange} step="0.5" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-bold text-slate-700">Destination / Location</label>
                  <Input type="text" name="destination" value={formData.destination || ""} onChange={handleInputChange} placeholder="Client name or site location" required />
                </div>
              </>
            )}

            {[3, 4, 6, 8, 9, 10, 11, 12].includes(typeId) && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Start Date</label>
                  <Input type="date" name="StartDate" value={formData.StartDate} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">End Date</label>
                  <Input type="date" name="EndDate" value={formData.EndDate} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Number of Days</label>
                  <Input type="number" name="NoDays" value={formData.NoDays} onChange={handleInputChange} step="0.5" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Payment Status</label>
                  <Select value={formData.WithPayID} onValueChange={(val) => handleSelectChange('WithPayID', val)}>
                    <SelectTrigger className="w-full h-10 border-slate-200">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="1">Leave with Pay</SelectItem>
                      <SelectItem value="2">Leave without Pay</SelectItem>
                      <SelectItem value="3">Considered AWOL</SelectItem>
                      <SelectItem value="4">For Suspension</SelectItem>
                      <SelectItem value="5">For Dismissal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {typeId === 5 && (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-bold text-slate-700">Log Date</label>
                  <Input type="date" name="logDate" value={formData.logDate} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-bold text-slate-700">Corrected Attendance Times</label>
                  <StaticTimePickerLandscape
                    items={[
                      {
                        label: "Corrected In",
                        name: "claimedIn",
                        value: formData.claimedIn,
                        helperText: "Select corrected check-in time",
                      },
                      {
                        label: "Corrected Out",
                        name: "claimedOut",
                        value: formData.claimedOut,
                        helperText: "Select corrected check-out time",
                      },
                    ]}
                    onChange={handleInputChange}
                  />
                </div>
              </>
            )}

            {typeId === 7 && (
               <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Date</label>
                  <Input type="date" name="StartDate" value={formData.StartDate} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Period</label>
                  <Select value={formData.period} onValueChange={(val) => handleSelectChange('period', val)}>
                    <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="Morning">Morning</SelectItem>
                      <SelectItem value="Afternoon">Afternoon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Payment Status</label>
                  <Select value={formData.WithPayID} onValueChange={(val) => handleSelectChange('WithPayID', val)}>
                    <SelectTrigger className="w-full h-10 border-slate-200">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="1">Leave with Pay</SelectItem>
                      <SelectItem value="2">Leave without Pay</SelectItem>
                      <SelectItem value="3">Considered AWOL</SelectItem>
                      <SelectItem value="4">For Suspension</SelectItem>
                      <SelectItem value="5">For Dismissal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
               </>
            )}

            {[13, 14].includes(typeId) && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Agency</label>
                  <Select value={formData.agency} onValueChange={(val) => handleSelectChange('agency', val)}>
                    <SelectTrigger className="w-full h-10 border-slate-200">
                      <SelectValue placeholder="Select Agency" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="SSS">SSS</SelectItem>
                      <SelectItem value="Pag-IBIG">Pag-IBIG</SelectItem>
                      <SelectItem value="Company">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Loan Type</label>
                  <Select 
                    value={formData.loanType} 
                    onValueChange={(val) => handleSelectChange('loanType', val)}
                    disabled={!formData.agency}
                  >
                    <SelectTrigger className="w-full h-10 border-slate-200">
                      <SelectValue placeholder={!formData.agency ? "Select agency first" : "Select Type"} />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      {formData.agency === "SSS" && (
                        <>
                          <SelectItem value="Salary Loan">Salary Loan</SelectItem>
                          <SelectItem value="Calamity Loan">Calamity Loan</SelectItem>
                          <SelectItem value="Emergency Loan">Emergency Loan</SelectItem>
                          <SelectItem value="SSS Conso Loan">SSS Conso Loan</SelectItem>
                        </>
                      )}
                      {formData.agency === "Pag-IBIG" && (
                        <>
                          <SelectItem value="Multi-Purpose Loan (MPL)">Multi-Purpose Loan (MPL)</SelectItem>
                          <SelectItem value="Calamity Loan">Calamity Loan</SelectItem>
                        </>
                      )}
                      {formData.agency === "Company" && (
                        <SelectItem value="Cash Advance">Cash Advance</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {typeId === 14 && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Amount / Principal</label>
                      <Input type="number" name="amountRequested" value={formData.amountRequested} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Repayment Term</label>
                      {formData.agency === "Pag-IBIG" ? (
                        <Select 
                          value={formData.monthsToPay ? String(formData.monthsToPay) : ""} 
                          onValueChange={(val) => handleSelectChange('monthsToPay', val)}
                        >
                          <SelectTrigger className="w-full h-10 border-slate-200">
                            <SelectValue placeholder="Select Term" />
                          </SelectTrigger>
                          <SelectContent className="z-[110]">
                            {formData.loanType === "Calamity Loan" ? (
                              <>
                                <SelectItem value="24">24 Months</SelectItem>
                                <SelectItem value="36">36 Months</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="12">12 Months</SelectItem>
                                <SelectItem value="24">24 Months</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input type="number" name="monthsToPay" value={formData.monthsToPay} onChange={handleInputChange} required />
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Deduction Frequency</label>
                      <Select 
                        value={formData.deductionFrequency || "semi-monthly"} 
                        onValueChange={(val) => handleSelectChange('deductionFrequency', val)}
                      >
                        <SelectTrigger className="w-full h-10 border-slate-200">
                          <SelectValue placeholder="Select Frequency" />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                          <SelectItem value="semi-monthly">Semi-Monthly (Split 15th & 30th)</SelectItem>
                          <SelectItem value="monthly">Monthly (15th Only)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.agency === "SSS" && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Monthly Amortization</label>
                          <Input type="number" name="monthlyAmortization" value={formData.monthlyAmortization} onChange={handleInputChange} step="0.01" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Outstanding Balance</label>
                          <Input type="number" name="totalOutstandingBalance" value={formData.totalOutstandingBalance} onChange={handleInputChange} step="0.01" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Reference No.</label>
                          <Input type="text" name="loanReferenceNo" value={formData.loanReferenceNo} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Approval Date</label>
                          <Input type="date" name="loanApprovalDate" value={formData.loanApprovalDate || ""} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-slate-700">Start Month</label>
                            <span className="text-[10px] text-slate-500 font-medium">(Auto / Editable)</span>
                          </div>
                          <Input type="month" name="amortizationStartMonth" value={formData.amortizationStartMonth || ""} onChange={handleInputChange} className="bg-slate-50/50" />
                        </div>
                      </>
                    )}
                    {formData.agency === "Pag-IBIG" && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Monthly Amortization</label>
                          <Input type="number" name="monthlyAmortization" value={formData.monthlyAmortization} readOnly className="bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">TAV</label>
                          <Input type="number" name="pagibigTAV" value={formData.pagibigTAV} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Approval Date</label>
                          <Input type="date" name="loanApprovalDate" value={formData.loanApprovalDate || ""} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-slate-700">Start Month</label>
                            <span className="text-[10px] text-slate-500 font-medium">(Auto / Editable)</span>
                          </div>
                          <Input type="month" name="amortizationStartMonth" value={formData.amortizationStartMonth || ""} onChange={handleInputChange} className="bg-slate-50/50" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Reference No.</label>
                          <Input type="text" name="loanReferenceNo" value={formData.loanReferenceNo} onChange={handleInputChange} />
                        </div>
                        {formData.loanType === "Calamity Loan" && (
                           <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Calamity Area</label>
                            <Input type="text" name="calamityArea" value={formData.calamityArea} onChange={handleInputChange} />
                          </div>
                        )}
                      </>
                    )}

                    {/* Standardized Disclosure Summary */}
                    {parseFloat(formData.amountRequested || formData.totalOutstandingBalance || 0) > 0 && (() => {
                      const isCompany = formData.agency === "Company" || formData.loanType === "Cash Advance";
                      const principal = parseFloat(formData.amountRequested || formData.totalOutstandingBalance || 0);
                      const monthlyAmort = parseFloat(formData.monthlyAmortization || principal || 0);

                      return (
                        <div className="sm:col-span-2 bg-brand-primary text-white p-4 rounded-xl border border-indigo-900/50 space-y-3 mt-2 shadow-sm animate-in fade-in duration-200">
                          <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">
                              {isCompany ? "Company Cash Advance Disclosure" : "Matrix Financial Disclosure"}
                            </h4>
                            {isCompany ? (
                              <Badge className="bg-emerald-500 text-white font-bold border-0 text-[10px]">COMPANY INTERNAL</Badge>
                            ) : (
                              <Badge className="bg-yellow-400 text-blue-900 font-black border-0 text-[10px]">SSS/HDMF STANDARDS</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] text-indigo-300 font-bold uppercase">{isCompany ? "Requested Advance" : "Requested Principal"}</p>
                              <p className="text-xl font-black">₱{principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-indigo-300 font-bold uppercase">{isCompany ? "Payroll Deduction" : "Monthly Amortization"}</p>
                              <p className="text-xl font-black text-yellow-400">₱{monthlyAmort.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                              <p className="text-[9px] text-indigo-200 italic">
                                {formData.deductionFrequency === "monthly"
                                  ? "Deducted in full on 15th cutoff"
                                  : `Split across 2 cutoffs (₱${(monthlyAmort / 2).toLocaleString('en-PH', { minimumFractionDigits: 2 })}/ea)`}
                              </p>
                            </div>
                          </div>
                          <p className="text-[9px] text-indigo-300/70 text-center font-medium italic">
                            {isCompany
                              ? "Internal company cash advance with 0% interest. Repayment is deducted directly from payroll cutoffs as scheduled."
                              : "Calculated using the Diminishing Principal Balance Method. Final amounts may vary based on exact SSS/HDMF release dates."}
                          </p>
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Request Reason / Remarks</label>
            <Textarea 
              name="remarks" 
              value={formData.remarks || ""} 
              onChange={handleInputChange} 
              placeholder="Reason or details for this request..."
              className="h-20 bg-white text-slate-800 border-slate-200 resize-none focus-visible:ring-indigo-500" 
            />
          </div>

          {([2, 4, 5, 8, 9, 10, 11, 12, 13, 14].includes(typeId) || existingAttachment) && (
            <div className="space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                <span>Supporting Attachment / Document</span>
                {replacementFile && (
                  <span className="text-xs text-emerald-600 font-semibold">New file selected</span>
                )}
              </label>
              {existingAttachment && !replacementFile && (
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-500">Current File:</span>
                  <span className="font-mono truncate max-w-xs">{existingAttachment.split("/").pop()}</span>
                  <span className="text-[11px] text-slate-400 italic">(Upload below to replace)</span>
                </div>
              )}
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setReplacementFile(e.target.files[0] || null)}
                className="bg-white file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-brand-primary-hover cursor-pointer"
              />
              {replacementFile && (
                <p className="text-xs text-slate-500 flex items-center justify-between">
                  <span>Replacement: <b>{replacementFile.name}</b> ({(replacementFile.size / 1024).toFixed(1)} KB)</span>
                  <button 
                    type="button" 
                    onClick={() => setReplacementFile(null)} 
                    className="text-rose-600 hover:underline font-bold text-xs"
                  >
                    Clear Replacement
                  </button>
                </p>
              )}
            </div>
          )}

          <div className={`space-y-2 p-4 rounded-xl border shadow-inner ${isEmployee ? "bg-indigo-50/70 border-indigo-100" : "bg-amber-50 border-amber-100"}`}>
            <label className={`text-sm font-bold flex items-center gap-2 ${isEmployee ? "text-indigo-900" : "text-amber-800"}`}>
               {isEmployee ? "Reason for Resubmission (Sent to Approver / Supervisor)" : "Modification Reason (Sent to Employee)"}
            </label>
            <Textarea 
              value={modificationReason} 
              onChange={(e) => setModificationReason(e.target.value)} 
              placeholder={isEmployee ? "Explain what changes or corrections you made for resubmission..." : "Explain why you are modifying this request..."} 
              required
              className={`bg-white h-20 shadow-sm ${isEmployee ? "border-indigo-200 focus-visible:ring-indigo-500" : "border-amber-200 focus-visible:ring-amber-500"}`}
            />
          </div>

          <div className="pt-4 border-t flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleCloseAttempt} disabled={loading} className="px-6 border-slate-300">Cancel</Button>
            <Button type="submit" className="bg-brand-primary text-white hover:bg-brand-primary-hover px-8 shadow-md" disabled={loading}>
              {loading ? "Updating..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRequestModal;
