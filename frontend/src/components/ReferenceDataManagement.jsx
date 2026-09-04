import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "../utils/api";
import { 
  Upload, 
  Calendar, 
  Table, 
  History, 
  CheckCircle, 
  XCircle, 
  FileSpreadsheet, 
  Layers, 
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Settings,
  Info,
  Download,
  Shield,
  ShieldAlert,
  X,
  Eye,
  EyeOff,
  Check,
  RotateCcw,
  Save,
  Edit3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ReferenceDataManagement = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("sss");
  const [csvFile, setCsvFile] = useState(null);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [records, setRecords] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeAuditIds, setActiveAuditIds] = useState([]);
  const [selectedAuditId, setSelectedAuditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [taxPeriodType, setTaxPeriodType] = useState("semi-monthly");
  
  // Upload modal security flow
  const [step, setStep] = useState(0); // 0 = closed, 1 = confirm, 2 = password verification
  const [adminPassword, setAdminPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [showRefPassword, setShowRefPassword] = useState(false);

  // Toggle status security flow (Activate / Deactivate)
  const [toggleModal, setToggleModal] = useState({ isOpen: false, step: 1, log: null, targetStatus: false });
  const [toggleAdminPassword, setToggleAdminPassword] = useState("");
  const [togglePwdError, setTogglePwdError] = useState("");
  const [toggleVerifying, setToggleVerifying] = useState(false);
  const [showTogglePassword, setShowTogglePassword] = useState(false);
  const [toggling, setToggling] = useState(null);

  const agencyLabels = {
    sss: "SSS Contribution Table",
    philhealth: "PhilHealth Contribution Schedule",
    pagibig: "Pag-IBIG Contribution Rates",
    tax: "BIR Withholding Tax Brackets"
  };

  const handleUploadClick = (e) => {
    e.preventDefault();
    if (!csvFile) return showStatus("Please select a CSV file to upload.", "error");
    if (!effectiveDate) return showStatus("Please select an effective date.", "error");
    setPwdError("");
    setAdminPassword("");
    setStep(1);
  };

  const handleProceedToPassword = () => {
    setStep(2);
  };

  const handleVerifyAndPasswordUpload = async (e) => {
    e.preventDefault();
    if (!adminPassword) {
      setPwdError("Admin password is required.");
      return;
    }

    try {
      setVerifying(true);
      setPwdError("");
      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: adminPassword })
      });
      const resData = await res.json();

      if (res.ok && resData.success) {
        setStep(0);
        setAdminPassword("");
        await executeUpload();
      } else {
        setPwdError(resData.error || "Incorrect password. Verification failed.");
      }
    } catch (err) {
      setPwdError("Error verifying password.");
    } finally {
      setVerifying(false);
    }
  };

  // Open confirmation modal for Activate / Deactivate toggle
  const openToggleModal = (log, isCurrentlyActive) => {
    setToggleAdminPassword("");
    setTogglePwdError("");
    setToggleModal({
      isOpen: true,
      step: 1,
      log: log,
      targetStatus: !isCurrentlyActive
    });
  };

  const handleVerifyAndExecuteToggle = async (e) => {
    e.preventDefault();
    if (!toggleAdminPassword) {
      setTogglePwdError("Admin password is required.");
      return;
    }

    try {
      setToggleVerifying(true);
      setTogglePwdError("");
      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: toggleAdminPassword })
      });
      const resData = await res.json();

      if (res.ok && resData.success) {
        const { log, targetStatus } = toggleModal;
        setToggleModal({ isOpen: false, step: 1, log: null, targetStatus: false });
        setToggleAdminPassword("");
        await executeToggle(log.auditId, targetStatus);
      } else {
        setTogglePwdError(resData.error || "Incorrect password. Verification failed.");
      }
    } catch (err) {
      setTogglePwdError("Error verifying password.");
    } finally {
      setToggleVerifying(false);
    }
  };

  const executeToggle = async (auditId, targetStatus) => {
    setToggling(auditId);
    try {
      const res = await fetchWithAuth(`/api/system/reference-data/toggle/${activeSubTab}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId: auditId,
          isActive: targetStatus
        })
      });

      const data = await res.json();
      if (res.ok) {
        showStatus(data.message || "Table status updated successfully.", "success");
        fetchReferenceData();
      } else {
        showStatus(data.error || "Failed to update table status.", "error");
      }
    } catch (err) {
      console.error(err);
      showStatus("Network connection error updating status.", "error");
    } finally {
      setToggling(null);
    }
  };

  const downloadCSVTemplate = () => {
    let headers = "";
    let dataRows = "";
    let filename = "";

    // Find the active records or displayed brackets for the current agency
    const activeRows = (displayedBrackets && displayedBrackets.length > 0)
      ? displayedBrackets
      : filteredRecords;

    if (activeSubTab === "sss") {
      filename = `SSS_Contribution_Template_${taxPeriodType || "active"}.csv`;
      headers = "Range Min,Range Max,MSC,ER_SS,EE_SS,ER_EC,ER_Provident,EE_Provident\n";
      
      if (activeRows.length > 0) {
        dataRows = activeRows.map(r => 
          `${r.range_Min},${r.range_Max >= 9999999 ? "Over" : r.range_Max},${r.monthlySalaryCredit},${r.er_SS},${r.ee_SS},${r.er_EC || 0},${r.er_Provident || 0},${r.ee_Provident || 0}`
        ).join("\n") + "\n";
      } else {
        dataRows = 
          "0.00,5249.99,5000,500,250,10,0,0\n" +
          "5250.00,5749.99,5500,550,275,10,0,0\n" +
          "21250.00,21749.99,20000,1900,1000,30,150,75\n" +
          "34750.00,Over,20000,2000,1000,30,1500,750\n";
      }
    } else if (activeSubTab === "philhealth") {
      filename = "Philhealth_Contribution_Template.csv";
      headers = "Range Min,Range Max,Rate,EmployeeShareRatio\n";
      
      if (activeRows.length > 0) {
        dataRows = activeRows.map(r => 
          `${r.range_Min},${r.range_Max >= 9999999 ? "9999999.00" : r.range_Max},${r.rate},${r.employeeShareRatio}`
        ).join("\n") + "\n";
      } else {
        dataRows = 
          "0.00,10000.00,0.05,0.50\n" +
          "10000.01,99999.99,0.05,0.50\n" +
          "100000.00,9999999.00,0.05,0.50\n";
      }
    } else if (activeSubTab === "pagibig") {
      filename = "PagIBIG_Contribution_Template.csv";
      headers = "Range Min,Range Max,EE_Rate,ER_Rate,ContributionCeiling\n";
      
      if (activeRows.length > 0) {
        dataRows = activeRows.map(r => 
          `${r.range_Min},${r.range_Max >= 9999999 ? "9999999.00" : r.range_Max},${r.ee_Rate},${r.er_Rate},${r.contributionCeiling}`
        ).join("\n") + "\n";
      } else {
        dataRows = 
          "0.00,1500.00,0.01,0.02,1500.00\n" +
          "1500.01,10000.00,0.02,0.02,10000.00\n" +
          "10000.01,9999999.00,0.02,0.02,10000.00\n";
      }
    } else if (activeSubTab === "tax") {
      filename = `BIR_WithholdingTax_${taxPeriodType === "monthly" ? "Monthly" : "SemiMonthly"}_Template.csv`;
      headers = "Range Min,Range Max,BaseTax,ExcessRate,ExcessOver\n";
      
      if (activeRows.length > 0) {
        dataRows = activeRows.map(r => 
          `${r.range_Min},${r.range_Max >= 9999999 ? "9999999.00" : r.range_Max},${r.baseTax},${r.excessRate},${r.excessOver}`
        ).join("\n") + "\n";
      } else {
        dataRows = 
          "0.00,10417.00,0.00,0.00,0.00\n" +
          "10417.01,16666.00,0.00,0.15,10417.00\n" +
          "16667.00,33333.00,937.50,0.20,16667.00\n" +
          "33334.00,83333.00,4270.90,0.25,33334.00\n" +
          "83334.00,333333.00,16770.90,0.30,83334.00\n" +
          "333334.00,9999999.00,91770.90,0.35,333334.00\n";
      }
    }

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + dataRows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchReferenceData();
    // Reset file and date on tab change
    setCsvFile(null);
    setEffectiveDate("");
    setStatusMessage(null);
    setSelectedAuditId(null);
  }, [activeSubTab, taxPeriodType]);

  const fetchReferenceData = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/system/reference-data/${activeSubTab}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        const logs = data.auditLogs || [];
        setAuditLogs(logs);
        const activeIds = data.activeAuditIds || [];
        setActiveAuditIds(activeIds);

        // Auto-select the active version or first available version
        const relevantLogs = activeSubTab === "tax"
          ? logs.filter(l => l.periodType === taxPeriodType)
          : logs;
        
        const activeLog = relevantLogs.find(l => activeIds.includes(l.auditId));
        if (activeLog) {
          setSelectedAuditId(activeLog.auditId);
        } else if (relevantLogs.length > 0) {
          setSelectedAuditId(relevantLogs[0].auditId);
        } else {
          setSelectedAuditId(null);
        }
      } else {
        showStatus("Failed to fetch reference data.", "error");
      }
    } catch (err) {
      console.error(err);
      showStatus("Connection error fetching reference data.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (message, type = "success") => {
    setStatusMessage({ message, type });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };

  const executeUpload = async () => {
    setUploading(true);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append("csvFile", csvFile);
    formData.append("effectiveDate", effectiveDate);
    if (activeSubTab === "tax") {
      formData.append("periodType", taxPeriodType);
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/system/reference-data/upload/${activeSubTab}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (response.ok) {
        showStatus(data.message || "Table uploaded and mapped successfully!", "success");
        setCsvFile(null);
        setEffectiveDate("");
        const fileInput = document.getElementById("csv-file-input");
        if (fileInput) fileInput.value = "";
        setIsEditing(false);
        fetchReferenceData();
      } else {
        showStatus(data.error || "Failed to process and map table data.", "error");
      }
    } catch (err) {
      console.error(err);
      showStatus("Network failure during upload.", "error");
    } finally {
      setUploading(false);
    }
  };

  // Helper to format currency
  const formatCurrency = (num) => {
    return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(num);
  };

  const filteredRecords = activeSubTab === "tax"
    ? records.filter(r => r.periodType === taxPeriodType)
    : records;

  const filteredAuditLogs = activeSubTab === "tax"
    ? auditLogs.filter(log => log.periodType === taxPeriodType)
    : auditLogs;

  // Selected Log for preview
  const selectedLog = filteredAuditLogs.find(l => l.auditId === selectedAuditId) || filteredAuditLogs[0];
  const isSelectedActive = selectedLog ? activeAuditIds.includes(selectedLog.auditId) : false;

  // Filter rows matching selected version
  const displayedBrackets = selectedLog
    ? filteredRecords.filter(r => r.auditId === selectedLog.auditId)
    : filteredRecords.filter(r => r.isActive);

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-[#2A1B4E] text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-white/10 rounded-lg border border-white/10">
            <Layers className="w-6 h-6 text-purple-200" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Statutory Reference Tables</h1>
            <p className="text-sm text-purple-200/80 mt-0.5">Manage contribution schedules and tax brackets for SSS, PhilHealth, Pag-IBIG, and BIR</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setCsvFile(null);
                  setEffectiveDate("");
                  const fileInput = document.getElementById("csv-file-input");
                  if (fileInput) fileInput.value = "";
                }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-sm font-medium shadow-sm transition"
              >
                <X className="w-4 h-4" /> <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  showStatus("Configuration mode saved.", "success");
                }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
              >
                <Save className="w-4 h-4" /> <span>Save Changes</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-lg text-sm font-medium shadow-sm transition"
            >
              <Edit3 className="w-4 h-4" /> <span>Edit Configuration</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full">
        {/* Left Column: Selector, Upload & History */}
        <div className="xl:col-span-1 space-y-6">
          {/* Selector Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-[#2A174E] flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" /> Agency Selector
              </CardTitle>
              <CardDescription>Select the statutory agency table to manage.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-col gap-2">
                {Object.keys(agencyLabels).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveSubTab(tab)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left text-sm font-semibold transition-all border ${
                      activeSubTab === tab
                        ? "bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm"
                        : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    <span>{agencyLabels[tab]}</span>
                    {activeSubTab === tab && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                  </button>
                ))}
              </div>

              {/* Tax Period Sub-toggle for BIR */}
              {activeSubTab === "tax" && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Tax Period Frequency</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTaxPeriodType("semi-monthly")}
                      className={`py-2 text-xs font-bold rounded-lg border transition ${
                        taxPeriodType === "semi-monthly"
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Semi-Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxPeriodType("monthly")}
                      className={`py-2 text-xs font-bold rounded-lg border transition ${
                        taxPeriodType === "monthly"
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-[#2A174E] flex items-center gap-2">
                <Upload className="h-5 w-5 text-indigo-600" /> Upload CSV Table
              </CardTitle>
              <CardDescription>Upload a fresh CSV spreadsheet of official brackets.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {!isEditing && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Table modification is currently locked. Click <strong>Edit Configuration</strong> above to upload or switch active schedules.</span>
                </div>
              )}

              {statusMessage && (
                <div className={`p-3 rounded-lg mb-4 text-xs font-semibold flex items-center gap-2 border ${
                  statusMessage.type === "success" 
                    ? "bg-green-50 text-green-800 border-green-200" 
                    : "bg-red-50 text-red-800 border-red-200"
                }`}>
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{statusMessage.message}</span>
                </div>
              )}

              <form onSubmit={handleUploadClick} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Effective Date</label>
                  <div className="relative">
                    <Input
                      type="date"
                      required
                      disabled={!isEditing}
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="pl-9 text-slate-700 font-medium border-slate-200 focus:border-indigo-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  </div>
                  <span className="text-[10px] text-slate-400 block">The date from which calculations will apply these rates.</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">CSV File</label>
                  <div className="relative">
                    <Input
                      id="csv-file-input"
                      type="file"
                      accept=".csv"
                      required
                      disabled={!isEditing}
                      onChange={handleFileChange}
                      className="pl-9 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border-slate-200 focus:border-indigo-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                    <FileSpreadsheet className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={!isEditing || uploading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing & Mapping...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" /> Upload & Parse CSV
                    </>
                  )}
                </Button>
              </form>

            {/* CSV Template Instructions */}
            <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-500 space-y-2">
              <div className="font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-indigo-600" /> CSV Guidelines & Export
                </span>
                <button
                  type="button"
                  onClick={downloadCSVTemplate}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline cursor-pointer bg-indigo-50/80 px-2 py-1 rounded border border-indigo-100"
                  title="Download CSV pre-filled with current active brackets for easy editing"
                >
                  <Download className="h-3.5 w-3.5" /> Download Active CSV
                </button>
              </div>
              <p>Download the current active table pre-filled, modify any numbers in Excel or a text editor, and upload with a new effective date:</p>
              {activeSubTab === "sss" && (
                <code className="block p-1 bg-slate-100 rounded text-slate-700 text-[10px] font-mono break-all">
                  Range Min, Range Max, MSC, ER_SS, EE_SS, ER_EC, ER_Provident, EE_Provident
                </code>
              )}
              {activeSubTab === "philhealth" && (
                <code className="block p-1 bg-slate-100 rounded text-slate-700 text-[10px] font-mono break-all">
                  Range Min, Range Max, Rate, EmployeeShareRatio
                </code>
              )}
              {activeSubTab === "pagibig" && (
                <code className="block p-1 bg-slate-100 rounded text-slate-700 text-[10px] font-mono break-all">
                  Range Min, Range Max, EE_Rate, ER_Rate, ContributionCeiling
                </code>
              )}
              {activeSubTab === "tax" && (
                <code className="block p-1 bg-slate-100 rounded text-slate-700 text-[10px] font-mono break-all">
                  Range Min, Range Max, BaseTax, ExcessRate, ExcessOver
                </code>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Brackets Preview & Auditing */}
      <div className="xl:col-span-2 space-y-6">
        
        {/* Active / Selected Rates Preview */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-[#2A174E] flex items-center gap-2">
                  <Table className="h-5 w-5 text-indigo-600" /> Brackets Preview
                </CardTitle>
                <CardDescription>
                  {selectedLog ? (
                    <span>Viewing: <strong className="text-slate-800">{selectedLog.fileName}</strong> (Effective: {selectedLog.effectiveDate})</span>
                  ) : (
                    <span>Parsed active brackets for {agencyLabels[activeSubTab]}.</span>
                  )}
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedLog && (
                isSelectedActive ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Official Active Table ({selectedLog.effectiveDate})
                  </Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> Historical Archive Preview
                    </Badge>
                    <Button
                      size="sm"
                      disabled={!isEditing}
                      onClick={() => openToggleModal(selectedLog, false)}
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Activate This Version
                    </Button>
                  </div>
                )
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <span className="text-sm text-slate-500 font-medium">Loading brackets...</span>
              </div>
            ) : displayedBrackets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold">No Brackets Found For This Version</p>
                <p className="text-xs mt-1">Select an active or historical version from the table below.</p>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Scrollable table grid */}
                <div className="max-h-[450px] overflow-y-auto overflow-x-auto border border-slate-200 rounded-lg shadow-inner">
                  <table className={`${activeSubTab === "sss" ? "min-w-[1000px]" : ""} w-full text-left border-collapse text-xs`}>
                    <thead>
                      {activeSubTab === "sss" ? (
                        <>
                          <tr className="bg-slate-100 text-slate-600 uppercase font-bold border-b border-slate-200 select-none text-center">
                            <th colSpan={2} rowSpan={2} className="p-3 border-r border-slate-200 align-middle">Range of Compensation</th>
                            <th colSpan={3} className="p-3 border-r border-slate-200 text-center">Monthly Salary Credit</th>
                            <th colSpan={8} className="p-3 text-center border-b border-slate-200">Amount of Contributions</th>
                          </tr>
                          <tr className="bg-slate-100 text-slate-600 uppercase font-bold border-b border-slate-200 select-none text-center">
                            <th className="p-2 border-r border-slate-200">Regular SS</th>
                            <th className="p-2 border-r border-slate-200">MPF</th>
                            <th className="p-2 border-r border-slate-200 font-bold">Total</th>
                            <th colSpan={4} className="p-2 border-r border-slate-200 text-center">Employer</th>
                            <th colSpan={3} className="p-2 border-r border-slate-200 text-center">Employee</th>
                            <th rowSpan={2} className="p-3 align-middle bg-[#f5f3ff] text-[#4f46e5] border-l border-slate-200">Total</th>
                          </tr>
                          <tr className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 select-none text-center text-[10px]">
                            <th className="p-2 border-r border-slate-200 bg-slate-50 text-[10px] lowercase font-normal italic text-left">Min</th>
                            <th className="p-2 border-r border-slate-200 bg-slate-50 text-[10px] lowercase font-normal italic text-left">Max</th>
                            <th className="p-1 border-r border-slate-100 font-normal">Regular SS</th>
                            <th className="p-1 border-r border-slate-100 font-normal">MPF</th>
                            <th className="p-1 border-r border-slate-200 font-bold text-slate-700">Total</th>
                            <th className="p-1 border-r border-slate-100 font-normal text-rose-600">Regular</th>
                            <th className="p-1 border-r border-slate-100 font-normal text-rose-600">MPF</th>
                            <th className="p-1 border-r border-slate-100 font-normal text-rose-600">EC</th>
                            <th className="p-1 border-r border-slate-200 bg-[#fff5f5] text-rose-700 font-bold">Total</th>
                            <th className="p-1 border-r border-slate-100 font-normal text-indigo-600">Regular</th>
                            <th className="p-1 border-r border-slate-100 font-normal text-indigo-600">MPF</th>
                            <th className="p-1 border-r border-slate-200 bg-[#f5f3ff] text-indigo-700 font-bold">Total</th>
                          </tr>
                        </>
                      ) : (
                        <tr className="bg-slate-100 text-slate-600 uppercase font-bold sticky top-0 border-b border-slate-200 select-none">
                          <th className="p-3">Salary Min</th>
                          <th className="p-3">Salary Max</th>
                          {activeSubTab === "philhealth" && (
                            <>
                              <th className="p-3">Base Rate</th>
                              <th className="p-3">EE Ratio</th>
                            </>
                          )}
                          {activeSubTab === "pagibig" && (
                            <>
                              <th className="p-3">EE Rate</th>
                              <th className="p-3">ER Rate</th>
                              <th className="p-3">Ceiling</th>
                            </>
                          )}
                          {activeSubTab === "tax" && (
                            <>
                              <th className="p-3">Base Tax</th>
                              <th className="p-3">Excess Rate</th>
                              <th className="p-3">Excess Over</th>
                            </>
                          )}
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {displayedBrackets.map((row, index) => {
                        const mscMPF = row.ee_Provident > 0 ? row.ee_Provident * 20 : 0;
                        const mscTotal = row.monthlySalaryCredit + mscMPF;
                        const erTotal = row.er_SS + row.er_Provident + row.er_EC;
                        const eeTotal = row.ee_SS + row.ee_Provident;
                        const combinedTotal = erTotal + eeTotal;

                        return (
                          <tr key={row.id || index} className="hover:bg-slate-50/80 border-b border-slate-100 text-slate-700 transition-colors text-center">
                            {activeSubTab === "sss" ? (
                              <>
                                <td className="p-2 font-semibold border-r border-slate-100 text-left">{formatCurrency(row.range_Min)}</td>
                                <td className="p-2 font-semibold border-r border-slate-200 text-left">
                                  {row.range_Max >= 9999999 ? "Over" : formatCurrency(row.range_Max)}
                                </td>
                                <td className="p-2 border-r border-slate-100">{formatCurrency(row.monthlySalaryCredit)}</td>
                                <td className="p-2 border-r border-slate-100 text-slate-500">{mscMPF > 0 ? formatCurrency(mscMPF) : "-"}</td>
                                <td className="p-2 border-r border-slate-200 font-medium text-slate-700">{formatCurrency(mscTotal)}</td>
                                <td className="p-2 border-r border-slate-100 text-rose-600">{formatCurrency(row.er_SS)}</td>
                                <td className="p-2 border-r border-slate-100 text-rose-500">{row.er_Provident > 0 ? formatCurrency(row.er_Provident) : "-"}</td>
                                <td className="p-2 border-r border-slate-100 text-rose-500">{row.er_EC > 0 ? formatCurrency(row.er_EC) : "-"}</td>
                                <td className="p-2 border-r border-slate-200 font-bold text-rose-700 bg-[#fff5f5]">{formatCurrency(erTotal)}</td>
                                <td className="p-2 border-r border-slate-100 text-indigo-600">{formatCurrency(row.ee_SS)}</td>
                                <td className="p-2 border-r border-slate-100 text-indigo-500">{row.ee_Provident > 0 ? formatCurrency(row.ee_Provident) : "-"}</td>
                                <td className="p-2 border-r border-slate-200 font-bold text-indigo-700 bg-[#f5f3ff]">{formatCurrency(eeTotal)}</td>
                                <td className="p-2 font-bold text-indigo-950 bg-[#eef2ff] border-l border-slate-200">{formatCurrency(combinedTotal)}</td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 font-semibold text-left">{formatCurrency(row.range_Min)}</td>
                                <td className="p-3 font-semibold text-left">
                                  {row.range_Max >= 9999999 ? "Exceeding" : formatCurrency(row.range_Max)}
                                </td>
                                {activeSubTab === "philhealth" && (
                                  <>
                                    <td className="p-3 font-medium text-indigo-600">{(row.rate * 100).toFixed(2)}%</td>
                                    <td className="p-3 text-slate-500">{(row.employeeShareRatio * 100).toFixed(0)}%</td>
                                  </>
                                )}
                                {activeSubTab === "pagibig" && (
                                  <>
                                    <td className="p-3 text-indigo-600 font-medium">{(row.ee_Rate * 100).toFixed(1)}%</td>
                                    <td className="p-3 text-rose-600 font-medium">{(row.er_Rate * 100).toFixed(1)}%</td>
                                    <td className="p-3">{formatCurrency(row.contributionCeiling)}</td>
                                  </>
                                )}
                                {activeSubTab === "tax" && (
                                  <>
                                    <td className="p-3 text-rose-600">{formatCurrency(row.baseTax)}</td>
                                    <td className="p-3 text-indigo-600 font-medium">{(row.excessRate * 100).toFixed(1)}%</td>
                                    <td className="p-3 text-slate-500">{formatCurrency(row.excessOver)}</td>
                                  </>
                                )}
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Audit Trail & Version History Management */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-[#2A174E] flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600" /> Version History
            </CardTitle>
            <CardDescription>Click any row to inspect brackets in preview without changing its active status.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : filteredAuditLogs.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-6">No historical records available for this selection.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                      <th className="p-3">Preview</th>
                      <th className="p-3">File Name</th>
                      <th className="p-3">Rows</th>
                      <th className="p-3">Effective Date</th>
                      <th className="p-3">Uploaded Date</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.map((log) => {
                      const isVersionActive = activeAuditIds.includes(log.auditId);
                      const isCurrentlyPreviewed = selectedAuditId === log.auditId;

                      return (
                        <tr 
                          key={log.auditId} 
                          onClick={() => setSelectedAuditId(log.auditId)}
                          className={`border-b border-slate-100 text-slate-700 cursor-pointer transition-all ${
                            isCurrentlyPreviewed
                              ? "bg-indigo-50/80 font-medium"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAuditId(log.auditId);
                              }}
                              className={`p-1.5 rounded-md transition ${
                                isCurrentlyPreviewed
                                  ? "bg-indigo-600 text-white shadow-xs"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}
                              title="Checkout / View Brackets"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </td>
                          <td className="p-3 font-medium flex items-center gap-1.5 max-w-[150px] truncate" title={log.fileName}>
                            <FileSpreadsheet className="h-4 w-4 text-indigo-500 shrink-0" />
                            <span className={isCurrentlyPreviewed ? "text-indigo-950 font-bold" : ""}>{log.fileName}</span>
                          </td>
                          <td className="p-3">{log.rowCount} rows</td>
                          <td className="p-3 font-semibold text-slate-800">{log.effectiveDate}</td>
                          <td className="p-3 text-slate-500">{new Date(log.uploadDate).toLocaleString()}</td>
                          <td className="p-3">
                            {isVersionActive ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-500 border-slate-200">Inactive</Badge>
                            )}
                          </td>
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              onClick={() => openToggleModal(log, isVersionActive)}
                              disabled={!isEditing || toggling === log.auditId}
                              className={`h-7 px-3 text-[10px] font-bold shadow-sm rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                isVersionActive
                                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
                              }`}
                            >
                              {toggling === log.auditId ? (
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : isVersionActive ? (
                                "Deactivate"
                              ) : (
                                "Activate"
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      </div>

      {/* STEP 1: UPLOAD CONFIRMATION MODAL */}
      {step === 1 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 border border-slate-100 text-left">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="p-3 bg-amber-100 rounded-full">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Upload Statutory Reference Table?</h3>
                <p className="text-xs text-slate-500">Step 1 of 2: Security Confirmation</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                Are you sure you want to upload and apply this reference table?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Selected Agency:</span>
                  <span className="font-bold text-indigo-900">{agencyLabels[activeSubTab]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Effective Date:</span>
                  <span className="font-bold text-emerald-700">{effectiveDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">File Name:</span>
                  <span className="font-bold text-slate-700 truncate max-w-[180px]">{csvFile?.name}</span>
                </div>
              </div>
              <p className="text-slate-500 text-[11px]">
                Uploading this file updates statutory contribution/tax brackets for upcoming payroll calculations across all active employees.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToPassword}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-sm"
              >
                Proceed to Security Verification →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: UPLOAD ADMIN PASSWORD VERIFICATION MODAL */}
      {step === 2 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleVerifyAndPasswordUpload} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 border border-slate-100 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-[#2A1B4E]">
                <Shield className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Admin Security Authorization</h3>
              </div>
              <button type="button" onClick={() => setStep(0)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Please enter your <strong>Admin Password</strong> to authorize uploading and updating statutory tax reference data:
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Admin Password</label>
              <div className="relative">
                <input
                  type={showRefPassword ? "text" : "password"}
                  required
                  autoFocus
                  placeholder="Enter password..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowRefPassword(!showRefPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  title={showRefPassword ? "Hide password" : "Show password"}
                >
                  {showRefPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwdError && (
                <p className="text-xs text-rose-600 font-medium pt-1">{pwdError}</p>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verifying}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-sm flex items-center space-x-1.5"
              >
                {verifying ? (
                  <span>Verifying Password...</span>
                ) : (
                  <span>Verify & Apply Table</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TOGGLE STATUS CONFIRMATION & PASSWORD MODALS (ACTIVATE / DEACTIVATE) */}
      {toggleModal.isOpen && toggleModal.step === 1 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 border border-slate-100 text-left">
            <div className="flex items-center space-x-3 text-indigo-600">
              <div className={`p-3 rounded-full ${toggleModal.targetStatus ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {toggleModal.targetStatus ? "Activate Table Version?" : "Deactivate Table Version?"}
                </h3>
                <p className="text-xs text-slate-500">Step 1 of 2: Security Confirmation</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                Are you sure you want to <strong>{toggleModal.targetStatus ? "activate" : "deactivate"}</strong> this statutory configuration?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Agency:</span>
                  <span className="font-bold text-indigo-900">{agencyLabels[activeSubTab]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">File Name:</span>
                  <span className="font-bold text-slate-700 truncate max-w-[180px]">{toggleModal.log?.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Effective Date:</span>
                  <span className="font-bold text-emerald-700">{toggleModal.log?.effectiveDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Action:</span>
                  <span className={`font-bold ${toggleModal.targetStatus ? "text-emerald-600" : "text-amber-600"}`}>
                    {toggleModal.targetStatus ? "Set as Active Official Schedule" : "Set as Inactive Archive"}
                  </span>
                </div>
              </div>
              <p className="text-slate-500 text-[11px]">
                {toggleModal.targetStatus 
                  ? "Activating this table will immediately apply its contribution and tax calculation formulas to all upcoming payroll runs."
                  : "Deactivating this table will archive its brackets. The system will fall back to statutory standards until another version is activated."}
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setToggleModal({ isOpen: false, step: 1, log: null, targetStatus: false })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setToggleModal(prev => ({ ...prev, step: 2 }))}
                className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition shadow-sm ${
                  toggleModal.targetStatus 
                    ? "bg-emerald-600 hover:bg-emerald-700" 
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                Proceed to Security Verification →
              </button>
            </div>
          </div>
        </div>
      )}

      {toggleModal.isOpen && toggleModal.step === 2 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleVerifyAndExecuteToggle} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 border border-slate-100 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-[#2A1B4E]">
                <Shield className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Admin Security Authorization</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setToggleModal({ isOpen: false, step: 1, log: null, targetStatus: false })} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Please enter your <strong>Admin Password</strong> to authorize {toggleModal.targetStatus ? "activating" : "deactivating"} this statutory table version:
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Admin Password</label>
              <div className="relative">
                <input
                  type={showTogglePassword ? "text" : "password"}
                  required
                  autoFocus
                  placeholder="Enter password..."
                  value={toggleAdminPassword}
                  onChange={(e) => setToggleAdminPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowTogglePassword(!showTogglePassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  title={showTogglePassword ? "Hide password" : "Show password"}
                >
                  {showTogglePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {togglePwdError && (
                <p className="text-xs text-rose-600 font-medium pt-1">{togglePwdError}</p>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setToggleModal({ isOpen: false, step: 1, log: null, targetStatus: false })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={toggleVerifying}
                className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition shadow-sm flex items-center space-x-1.5 ${
                  toggleModal.targetStatus
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {toggleVerifying ? (
                  <span>Verifying Password...</span>
                ) : (
                  <span>Confirm {toggleModal.targetStatus ? "Activation" : "Deactivation"}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ReferenceDataManagement;
