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
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ReferenceDataManagement = () => {
  const [activeSubTab, setActiveSubTab] = useState("sss");
  const [csvFile, setCsvFile] = useState(null);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [records, setRecords] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeAuditIds, setActiveAuditIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toggling, setToggling] = useState(null); // stores auditId being toggled
  const [statusMessage, setStatusMessage] = useState(null);
  const [taxPeriodType, setTaxPeriodType] = useState("semi-monthly");

  const agencyLabels = {
    sss: "SSS Contribution Table",
    philhealth: "PhilHealth Contribution Schedule",
    pagibig: "Pag-IBIG Contribution Rates",
    tax: "BIR Withholding Tax Brackets"
  };

  const downloadCSVTemplate = () => {
    let headers = "";
    let sampleData = "";
    let filename = "";

    if (activeSubTab === "sss") {
      filename = "SSS_Contribution_Template.csv";
      headers = ",Range of Compensation,,MONTHLY SALARY CREDIT ,,,Employer,,,,Employee,,,,Total\n" +
                ",Range1,Range2,Regular SS/ EC,MPF,Total,Regular SS,MPF,EC,Total,Regular SS,MPF,EC,Total,\n";
      sampleData = 
        "1,0.00,5249.99,5000,,5000,500,,10,510,250,,,250,760\n" +
        "2,5250,5749.99,5500,,5500,550,,10,560,275,,,275,835\n" +
        "34,21250,21749.99,20000,1500,21500,1900,150,30,2080,1000,75,,1075,3155\n" +
        "53,34750,Over,20000,15000,35000,2000,1500,30,3530,1000,750,,1750,5280\n";
    } else if (activeSubTab === "philhealth") {
      filename = "Philhealth_Contribution_Template.csv";
      headers = "Range Min,Range Max,Rate,EmployeeShareRatio\n";
      sampleData = 
        "0.00,10000.00,0.05,0.50\n" +
        "10000.01,99999.99,0.05,0.50\n" +
        "100000.00,9999999.00,0.05,0.50\n";
    } else if (activeSubTab === "pagibig") {
      filename = "PagIBIG_Contribution_Template.csv";
      headers = "Range Min,Range Max,EE_Rate,ER_Rate,ContributionCeiling\n";
      sampleData = 
        "0.00,1500.00,0.01,0.02,10000.00\n" +
        "1500.01,9999999.00,0.02,0.02,10000.00\n";
    } else if (activeSubTab === "tax") {
      filename = taxPeriodType === "semi-monthly" ? "BIR_WithholdingTax_SemiMonthly_Template.csv" : "BIR_WithholdingTax_Monthly_Template.csv";
      headers = "Range Min,Range Max,BaseTax,ExcessRate,ExcessOver\n";
      if (taxPeriodType === "semi-monthly") {
        sampleData = 
          "0.00,10417.00,0.00,0.00,0.00\n" +
          "10417.01,16667.00,0.00,0.20,10417.00\n" +
          "16667.01,33333.00,1250.00,0.25,16667.00\n" +
          "33333.01,83333.00,5416.67,0.30,33333.00\n" +
          "83333.01,333333.00,20416.67,0.32,83333.00\n" +
          "333333.01,9999999.00,100416.67,0.35,333333.00\n";
      } else {
        sampleData = 
          "0.00,20833.00,0.00,0.00,0.00\n" +
          "20833.01,33333.00,0.00,0.20,20833.00\n" +
          "33333.01,66667.00,2500.00,0.25,33333.00\n" +
          "66667.01,166667.00,10833.33,0.30,66667.00\n" +
          "166667.01,666667.00,40833.33,0.32,166667.00\n" +
          "666667.01,9999999.00,200833.33,0.35,666667.00\n";
      }
    }

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + sampleData);
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
  }, [activeSubTab]);

  const fetchReferenceData = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/system/reference-data/${activeSubTab}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setAuditLogs(data.auditLogs || []);
        setActiveAuditIds(data.activeAuditIds || []);
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

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) return showStatus("Please select a CSV file to upload.", "error");
    if (!effectiveDate) return showStatus("Please select an effective date.", "error");

    setUploading(true);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append("csvFile", csvFile);
    formData.append("effectiveDate", effectiveDate);
    if (activeSubTab === "tax") {
      formData.append("periodType", taxPeriodType);
    }

    try {
      // Direct raw fetch because fetchWithAuth handles standard JSON content-types automatically
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
        // Reset file input element
        const fileInput = document.getElementById("csv-file-input");
        if (fileInput) fileInput.value = "";
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

  const handleToggle = async (auditId, currentStatus) => {
    setToggling(auditId);
    try {
      const res = await fetchWithAuth(`/api/system/reference-data/toggle/${activeSubTab}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId: auditId,
          isActive: !currentStatus
        })
      });

      const data = await res.json();
      if (res.ok) {
        showStatus(data.message, "success");
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

  // Group records by effective date for previewing
  const recordsByDate = filteredRecords.reduce((acc, curr) => {
    if (!acc[curr.effectiveDate]) {
      acc[curr.effectiveDate] = [];
    }
    acc[curr.effectiveDate].push(curr);
    return acc;
  }, {});

  const datesList = Object.keys(recordsByDate).sort().reverse();
  const activeDate = datesList.find(d => recordsByDate[d][0]?.isActive);
  const selectedPreviewDate = datesList[0] || ""; // Preview latest by default

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full animate-in fade-in duration-200">
      
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

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Effective Date</label>
                <div className="relative">
                  <Input
                    type="date"
                    required
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="pl-9 text-slate-700 font-medium border-slate-200 focus:border-indigo-400"
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
                    onChange={handleFileChange}
                    className="pl-9 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border-slate-200 focus:border-indigo-400"
                  />
                  <FileSpreadsheet className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <Button
                type="submit"
                disabled={uploading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 shadow-sm flex items-center justify-center gap-2 transition-all"
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
                  <Info className="h-3.5 w-3.5 text-indigo-600" /> CSV Column Guidelines
                </span>
                <button
                  type="button"
                  onClick={downloadCSVTemplate}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Download Template
                </button>
              </div>
              <p>Ensure your CSV headers match the exact mappings:</p>
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
        
        {/* Active Rates Summary / Preview */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-[#2A174E] flex items-center gap-2">
                  <Table className="h-5 w-5 text-indigo-600" /> Brackets Preview
                </CardTitle>
                <CardDescription>Currently parsed active brackets for {agencyLabels[activeSubTab]}.</CardDescription>
              </div>
              {activeSubTab === "tax" && (
                <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200/50">
                  <button
                    type="button"
                    onClick={() => setTaxPeriodType("semi-monthly")}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                      taxPeriodType === "semi-monthly"
                        ? "bg-white text-indigo-950 shadow-sm border border-slate-200/30"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Semi-Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxPeriodType("monthly")}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                      taxPeriodType === "monthly"
                        ? "bg-white text-indigo-950 shadow-sm border border-slate-200/30"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              )}
            </div>
            {activeDate && (
              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold">
                Active Table: {activeDate}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <span className="text-sm text-slate-500 font-medium">Loading brackets...</span>
              </div>
            ) : datesList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold">No Table Uploaded Yet</p>
                <p className="text-xs mt-1">Upload a CSV file to view structural brackets.</p>
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
                      {recordsByDate[selectedPreviewDate]?.map((row, index) => {
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
                <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                  <span>Displaying {recordsByDate[selectedPreviewDate]?.length || 0} brackets.</span>
                  <span>Effective Date: {selectedPreviewDate}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Audit Trail & Status Management */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-[#2A174E] flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600" /> Version History
            </CardTitle>
            <CardDescription>Enable, disable, or audit uploaded table configurations.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-6">No historical records available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
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

                      return (
                         <tr key={log.auditId} className="hover:bg-slate-50 border-b border-slate-100 text-slate-700">
                          <td className="p-3 font-medium flex items-center gap-1.5 max-w-[150px] truncate" title={log.fileName}>
                            <FileSpreadsheet className="h-4 w-4 text-indigo-500 shrink-0" />
                            {log.fileName}
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
                          <td className="p-3 text-center">
                            <Button
                              onClick={() => handleToggle(log.auditId, isVersionActive)}
                              disabled={toggling === log.auditId}
                              className={`h-7 px-3 text-[10px] font-bold shadow-sm rounded-md transition-all ${
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
  );
};

export default ReferenceDataManagement;
