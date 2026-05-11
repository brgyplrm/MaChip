import Sidebar from "../../components/Sidebar";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import RfidScanModal from "../../components/rfidScanModal/RfidScanModal";
import CheckIcon from "@mui/icons-material/Check";
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import WorkIcon from '@mui/icons-material/Work';
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleMap = { "Employee": 3, "Supervisor": 2, "Admin Manager": 1, "Admin Accountant": 4 };

const PHILIPPINE_BANKS = [
  "BDO Unibank (BDO)",
  "Bank of the Philippine Islands (BPI)",
  "Metropolitan Bank and Trust (Metrobank)",
  "Land Bank of the Philippines (LANDBANK)",
  "Security Bank",
  "UnionBank of the Philippines",
  "Philippine National Bank (PNB)",
  "China Banking Corporation (Chinabank)",
  "Rizal Commercial Banking Corporation (RCBC)",
  "EastWest Bank",
  "GCash",
  "Maya Bank"
];

const New = ({ inputs = [], title }) => {
  const navigate = useNavigate();
  const [file, setFile] = useState("");
  const [displayId, setDisplayId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showRfidModal, setShowRfidModal] = useState(false);
  const [rfidError, setRfidError] = useState("");
  const [localScannedId, setLocalScannedId] = useState("");
  
  const currentUser = JSON.parse(localStorage.getItem("userData") || "null");
  const isAdminManager = currentUser?.user_RoleId === 1;
  const isAccountant = currentUser?.user_RoleId === 4;

  const [showAdminConfirm, setShowAdminConfirm] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  // Stepper State
  const [activeStep, setActiveStep] = useState(1);
  const totalSteps = 3;
  const steps = [
    { id: 1, title: "Personal Info" },
    { id: 2, title: "Employment & Payroll" },
    { id: 3, title: "Security" }
  ];

  // Group fields logically (Removed account_number as it's explicitly rendered now)
  const step1Fields = ["user_Email"];
  const step2Fields = ["user_Role", "user_EmploymentStatus", "user_Id"];
  const step3Fields = ["user_Password", "user_MachipId", "user_FingerprintId"];

  // Single Registration State
  const [formData, setFormData] = useState({
    user_Id: "",
    user_FirstName: "",
    user_LastName: "",
    user_MiddleName: "",
    user_EmploymentStatus: "Regular",
    user_Role: "Employee",
    user_Email: "",
    user_Password: "",
    user_MachipId: "",
    user_FingerprintId: "",
    user_FingerprintTemplate: "",
    account_Number: "",
    bank_Company: "",
    bank_AccountName: "",
    user_RoleId: 3,
  });

  // Batch Upload State
  const [csvFile, setCsvFile] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const dismissToast = useCallback(() => setToast({ message: "", type: "success" }), []);

  const [showFingerprintModal, setShowFingerprintModal] = useState(false);
  const [fingerprintError, setFingerprintError] = useState("");
  const [localFingerprintId, setLocalFingerprintId] = useState("");

  useEffect(() => {
    if (showRfidModal) {
      setLocalScannedId("");
      setRfidError("");
      handleScanRFID();
      fetchWithAuth("/api/system/reg-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: formData.user_Id || "temp", type: 'RFID' })
      }).catch(err => console.error("Failed to start RFID session:", err));
    } else {
      fetchWithAuth("/api/system/reg-session", { method: "DELETE" })
        .catch(err => console.error("Failed to clear RFID session:", err));
    }
  }, [showRfidModal, formData.user_Id]);

  useEffect(() => {
    if (showFingerprintModal) {
      setLocalFingerprintId("");
      setFingerprintError("");
      handleScanFingerprint();
      fetchWithAuth("/api/system/reg-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: formData.user_Id || "temp", type: 'FP' })
      }).catch(err => console.error("Failed to start FP session:", err));
    } else {
      fetchWithAuth("/api/system/reg-session", { method: "DELETE" })
        .catch(err => console.error("Failed to clear FP session:", err));
      fetchWithAuth("/api/users/clear-fingerprint-session", { method: "DELETE" })
        .catch(err => console.error("Failed to clear in-memory FP session:", err));
    }
  }, [showFingerprintModal, formData.user_Id]);

  const handleScanFingerprint = async () => {
    setShowFingerprintModal(true);
    setLocalFingerprintId("");
    setFingerprintError("");

    try {
      const response = await fetchWithAuth(`/api/users/generateFingerprint?userId=${formData.user_Id}`);
      const data = await response.json();

      if (response.ok) {
        setLocalFingerprintId(data.fingerprintId);
        if (data.template) {
           setFormData(prev => ({ ...prev, user_FingerprintTemplate: data.template }));
        }
      } else {
        setFingerprintError(data.error || "Failed to scan fingerprint.");
      }
    } catch (err) {
      setFingerprintError("An error occurred during scanning.");
    }
  };

  useEffect(() => {
    const fetchNextId = async () => {
      try {
        const response = await fetchWithAuth("/api/users/nextId");
        if (response.ok) {
          const data = await response.json();
          setFormData((prev) => ({ ...prev, user_Id: data.nextId }));
          setDisplayId(data.displayId);
        }
      } catch (err) { console.error(err); }
    };
    fetchNextId();
  }, []);

  const handleInput = (e) => {
    const { id, value } = e.target;
    
    setFormData((prev) => {
      const updated = { ...prev, [id]: value };
      
      if (id === "user_Id") {
        const numericMatch = value.match(/\d+/);
        const numericId = numericMatch ? parseInt(numericMatch[0], 10) : "";
        updated.user_Id = numericId;
        setDisplayId(value);
      }
      
      if (id === "user_Role") {
        updated.user_RoleId = roleMap[value] || 3;
      }
      if (id === "user_EmploymentStatus") {
        updated.user_EmploymentStatusId = value === "Regular" ? 1 : value === "Part-time" ? 2 : 3;
      }
      
      return updated;
    });

    setErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const handleIdBlur = () => {
    if (formData.user_Id) {
      setDisplayId(`MACJ-${String(formData.user_Id).padStart(3, "0")}`);
    }
  };

  const handleScanRFID = async () => {
    setShowRfidModal(true);
    setLocalScannedId("");
    setRfidError("");

    try {
      const response = await fetchWithAuth("/api/users/generateRfid");
      const data = await response.json();

      if (response.ok) {
        // Check for duplicates
        const checkResponse = await fetchWithAuth(`/api/users/check-machip/${data.rfid}`);
        const checkData = await checkResponse.json();

        if (checkResponse.ok && checkData.exists) {
          setRfidError("This MaChip ID is already assigned to another user.");
          setLocalScannedId(data.rfid);
        } else {
          setLocalScannedId(data.rfid);
        }
      } else {
        setRfidError(data.error || "Failed to scan RFID. Please try again.");
        if (data.rfid) setLocalScannedId(data.rfid);
      }
    } catch (err) {
      setRfidError("An error occurred while scanning.");
    }
  };

  // Stepper Validation Logic
  const validateStep = (step) => {
    const newErrors = {};
    if (step === 1) {
      if (!formData.user_FirstName.trim()) newErrors.user_FirstName = "Required";
      if (!formData.user_LastName.trim()) newErrors.user_LastName = "Required";
      if (!formData.user_Email?.trim()) newErrors.user_Email = "Required";
      else if (!EMAIL_REGEX.test(formData.user_Email.trim())) newErrors.user_Email = "Invalid email format";
    } else if (step === 2) {
      if (!formData.user_Role) newErrors.user_Role = "Required";
      if (!formData.user_EmploymentStatus) newErrors.user_EmploymentStatus = "Required";
      if (!formData.bank_Company) newErrors.bank_Company = "Required";
      if (!formData.bank_AccountName?.trim()) newErrors.bank_AccountName = "Required";
      if (!formData.account_Number?.trim()) newErrors.account_Number = "Required";
    } else if (step === 3) {
      if (!formData.user_Password || formData.user_Password.length < 6) {
        newErrors.user_Password = "Min 6 characters required.";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => prev + 1);
    } else {
      setToast({ message: "Please check the required fields.", type: "error" });
    }
  };

  const handlePrevStep = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateStep(3)) return; // Final validation pass
    if (loading) return;

    if (isAdminManager && formData.user_RoleId !== 3 && !showAdminConfirm) {
      setShowAdminConfirm(true);
      return;
    }

    setLoading(true);
    const data = new FormData();
    
    Object.keys(formData).forEach((key) => {
      if (formData[key] !== undefined && formData[key] !== null) {
        data.append(key, formData[key]);
      }
    });
    
    if (!formData.user_EmploymentStatusId) data.append("user_EmploymentStatusId", 1);
    if (!formData.user_RoleId) data.append("user_RoleId", 3);
    if (file) data.append("user_ProfilePic", file);

    if (showAdminConfirm && adminPassword) {
      data.append("adminConfirmPassword", adminPassword);
    }

    try {
      const response = await fetchWithAuth("/api/users/registerUser", {
        method: "POST",
        body: data,
      });

      if (response.ok) {
        setToast({ message: "User added successfully!", type: "success" });
        setShowAdminConfirm(false);
        setAdminPassword("");
        setTimeout(() => navigate("/users"), 1100);
      } else {
        const errorData = await response.json();
        setToast({ message: errorData.error || "Failed to add user.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Something went wrong.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // --- BATCH PROCESSING LOGIC ---
  const downloadCsvTemplate = () => {
    const headers = "user_FirstName,user_LastName,user_MiddleName,user_Email,user_Password,user_Role,user_EmploymentStatus,bank_Company,bank_AccountName,account_Number\n";
    const sample = "Juan,Cruz,Dela,juan.cruz@example.com,password123,Employee,Regular,BDO Unibank (BDO),Juan Dela Cruz,1234567890\n";
    const blob = new Blob([headers + sample], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "user_batch_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && (selectedFile.type === "text/csv" || selectedFile.name.endsWith('.csv'))) {
      setCsvFile(selectedFile);
    } else {
      setToast({ message: "Please upload a valid CSV file.", type: "error" });
      e.target.value = null;
      setCsvFile(null);
    }
  };

  const handleBatchSubmit = async () => {
    if (!csvFile) {
      setToast({ message: "Please select a CSV file first.", type: "error" });
      return;
    }
    setBatchLoading(true);
    const uploadData = new FormData();
    uploadData.append("csvFile", csvFile);

    try {
      const response = await fetchWithAuth("/api/users/batch-register", {
        method: "POST",
        body: uploadData,
      });
      if (response.ok) {
        setToast({ message: "Batch upload successful!", type: "success" });
        setCsvFile(null);
        setTimeout(() => navigate("/users"), 1500);
      } else {
        const err = await response.json();
        setToast({ message: err.error || "Batch upload failed.", type: "error" });
      }
    } catch (error) {
       setToast({ message: "Connection error.", type: "error" });
    } finally {
       setBatchLoading(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    const formattedStatus = status?.toLowerCase().replace(" ", "") || "regular";
    if (formattedStatus === "regular") return "bg-green-100 text-green-800 hover:bg-green-100";
    if (formattedStatus === "part-time") return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    return "bg-amber-100 text-amber-800 hover:bg-amber-100"; 
  };

  // Helper to render dynamic inputs from your original structure
  const renderDynamicInput = (input) => (
    <div key={input.id} className="space-y-2">
      <Label className="text-slate-600 font-semibold">{input.label} <span className="text-red-500">*</span></Label>
      <div className="h-1"></div>
      {input.type === "select" ? (
        <Select 
          value={formData[input.id] || ""} 
          onValueChange={(val) => handleInput({ target: { id: input.id, value: val } })}
        >
          <SelectTrigger className={`bg-white w-full ${errors[input.id] ? "border-red-500" : ""}`}>
            <SelectValue placeholder={`Select ${input.label}`} />
          </SelectTrigger>
          <SelectContent>
            {input.id === "user_EmploymentStatus" && (
              <>
                <SelectItem value="Regular">Regular</SelectItem>
                <SelectItem value="Part-time">Part-time</SelectItem>
                <SelectItem value="Intern / OJT">Intern / OJT</SelectItem>
              </>
            )}
            {input.id === "user_Role" && (
              <>
                <SelectItem value="Employee">Employee</SelectItem>
                {!isAccountant && (
                  <>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                    <SelectItem value="Admin Manager">Admin Manager</SelectItem>
                    <SelectItem value="Admin Accountant">Admin Accountant</SelectItem>
                  </>
                )}
              </>
            )}
          </SelectContent>
        </Select>
      ) : (
        <div className="flex gap-2 relative">
          <div className="relative flex-1">
            <Input
              id={input.id}
              type={
                (input.id === "user_Password" && showPassword)
                  ? "text" 
                  : input.type
              }
              placeholder={input.placeholder}
              value={input.id === "user_Id" ? displayId : formData[input.id]}
              onChange={handleInput}
              onBlur={input.id === "user_Id" ? handleIdBlur : undefined}
              readOnly={input.label === "MaChip ID" || input.label === "Fingerprint ID"}
              className={`bg-white ${input.id === "user_Password" ? "pr-10" : ""} ${errors[input.id] ? "border-red-500" : ""} ${input.label === "MaChip ID" || input.label === "Fingerprint ID" ? "bg-slate-100 text-slate-500" : ""}`}
            />
            {/* Visibility Toggles */}
            {input.id === "user_Password" && (
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </button>
            )}
          </div>
          {/* Scan Buttons */}
          {input.label === "MaChip ID" && (
            <Button type="button" variant="secondary" className="shrink-0 bg-[#2A174E] text-white hover:bg-[#1a0e30]" onClick={handleScanRFID}>SCAN</Button>
          )}
          {input.label === "Fingerprint ID" && (
            <Button type="button" variant="secondary" className="shrink-0 bg-[#2A174E] text-white hover:bg-[#1a0e30]" onClick={handleScanFingerprint}>SCAN</Button>
          )}
        </div>
      )}
      {errors[input.id] && <span className="text-xs text-red-500 block">{errors[input.id]}</span>}
    </div>
  );

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />  
      <div className="flex-1 p-4 md:p-4 w-full overflow-x-hidden min-w-0 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">Register a new employee into the system.</p>
        </div>

        <Tabs defaultValue="single" className="w-full ">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-15! bg-[white] p-2">
            <TabsTrigger value="single" className="data-[state=active]:bg-[#2A174E] data-[state=active]:text-white font-semibold text-grey-500 transition-all text-md shadow-sm">
              Single Registration
            </TabsTrigger>
            <TabsTrigger value="batch" className="data-[state=active]:bg-[#2A174E] data-[state=active]:text-white font-semibold text-grey-500 transition-all text-md shadow-sm">
              Batch Upload (CSV)
            </TabsTrigger>
          </TabsList>

          {/* SINGLE REGISTRATION TAB */}
          <TabsContent value="single" className="space-y-6 mt-0 ">
            <Card className="shadow-sm border-0 bg-white overflow-hidden border-t-4 border-[#2A174E] py-0">
              <div className="flex flex-col lg:flex-row min-h-[600px]">
                
                {/* Left Column: Identity Preview */}
                <div className="w-full lg:w-[350px] bg-slate-50/50 border-b lg:border-b-0 lg:border-r border-slate-200 p-8 flex flex-col items-center justify-center">
                  <div className="relative mb-6">
                    <img
                      src={
                        file
                          ? URL.createObjectURL(file)
                          : formData.user_ProfilePic
                            ? `/api/uploads/${formData.user_ProfilePic}`
                            : "/avatar.webp"
                      }
                      alt="Profile Preview"
                      className="w-40 h-40 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                    <div className="absolute -bottom-2 w-full flex justify-center">
                      <label htmlFor="file" className="cursor-pointer bg-white px-4 py-1.5 rounded-full shadow-md border border-slate-200 flex items-center gap-1.5 text-xs font-bold text-[#2A174E] hover:text-white hover:bg-[#2A174E] transition-colors">
                        <DriveFolderUploadOutlinedIcon fontSize="small" /> Upload
                      </label>
                      <input
                        type="file"
                        id="file"
                        onChange={(e) => {
                          const selectedFile = e.target.files[0];
                          if (selectedFile) {
                            const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
                            if (!allowedTypes.includes(selectedFile.type)) {
                              setToast({ message: "Invalid format. Only PNG, JPG, and JPEG allowed!", type: "error" });
                              e.target.value = null;
                              return;
                            }
                            setFile(selectedFile);
                          }
                        }}
                        className="hidden"
                      />
                    </div>
                  </div>
                  
                  <div className="text-center mt-6">
                    <h2 className="text-xl font-bold text-[#2A174E] capitalize break-words">
                      {formData.user_FirstName || "First"} {formData.user_LastName || "Last"}
                    </h2>
                    <p className="text-sm font-medium text-slate-500 my-2">
                      {formData.user_Role || "Select Role"}
                    </p>
                    <Badge variant="secondary" className={`font-bold uppercase tracking-wider ${getStatusBadgeStyle(formData.user_EmploymentStatus)}`}>
                      {formData.user_EmploymentStatus || "Regular"}
                    </Badge>
                  </div>
                </div>

                {/* Right Column: Multi-Step Form */}
                <div className="w-full lg:flex-1 p-6 md:p-10 flex flex-col">
                  
                  {/* Stepper Header Indicator */}
                  <div className="relative mb-10 mx-auto w-full max-w-lg">
                     <div className="absolute left-0 top-[15px] w-full h-[2px] bg-slate-100 z-0"></div>
                     <div className="absolute left-0 top-[15px] h-[2px] bg-[#2A174E] z-0 transition-all duration-500 ease-in-out" style={{ width: `${((activeStep - 1) / (totalSteps - 1)) * 100}%` }}></div>

                     <div className="flex justify-between relative z-10">
                       {steps.map(step => (
                         <div key={step.id} className="flex flex-col items-center gap-2 bg-white px-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 shadow-sm ${activeStep >= step.id ? 'bg-[#2A174E] border-[#2A174E] text-white scale-110' : 'bg-white border-slate-200 text-slate-400'}`}>
                              {activeStep > step.id ? <CheckIcon fontSize="small" /> : step.id}
                            </div>
                            <span className={`text-[11px] font-bold uppercase tracking-wider ${activeStep >= step.id ? 'text-[#2A174E]' : 'text-slate-400'}`}>
                              {step.title}
                            </span>
                         </div>
                       ))}
                     </div>
                  </div>

                  {/* Form Content Area */}
                  <div className="flex-1 min-h-[350px]">
                    {/* STEP 1: Personal Info */}
                    {activeStep === 1 && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="space-y-4">
                          <Label className="text-slate-800 font-bold text-lg border-b border-slate-100 pb-2 block">Personal Details</Label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-500">First Name <span className="text-red-500">*</span></Label>
                              <Input id="user_FirstName" placeholder="Juan" value={formData.user_FirstName} onChange={handleInput} className={errors.user_FirstName ? "border-red-500" : ""} />
                              {errors.user_FirstName && <span className="text-xs text-red-500">{errors.user_FirstName}</span>}
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-500">Middle Name</Label>
                              <Input id="user_MiddleName" placeholder="Perez" value={formData.user_MiddleName} onChange={handleInput} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-500">Last Name <span className="text-red-500">*</span></Label>
                              <Input id="user_LastName" placeholder="Dela Cruz" value={formData.user_LastName} onChange={handleInput} className={errors.user_LastName ? "border-red-500" : ""} />
                              {errors.user_LastName && <span className="text-xs text-red-500">{errors.user_LastName}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {inputs.filter(i => step1Fields.includes(i.id)).map(renderDynamicInput)}
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Employment & Bank Details */}
                    {activeStep === 2 && (
                      <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
                        
                        {/* Segment 1: Employment Configuration */}
                        <div className="space-y-4">
                          <Label className="text-slate-800 font-bold text-lg border-b border-slate-100 pb-2 flex items-center gap-2">
                            <WorkIcon className="text-[#2A174E] h-5 w-5" /> Employment Configuration
                          </Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {inputs.filter(i => step2Fields.includes(i.id)).map(renderDynamicInput)}
                          </div>
                        </div>

                        {/* Segment 2: Bank Details */}
                        <div className="space-y-4">
                          <Label className="text-slate-800 font-bold text-lg border-b border-slate-100 pb-2 flex items-center gap-2">
                            <AccountBalanceIcon className="text-[#2A174E] h-5 w-5" /> Bank & Payroll Details
                          </Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            <div className="space-y-2">
                              <Label className="text-slate-600 font-semibold">Bank Company <span className="text-red-500">*</span></Label>
                              <Select value={formData.bank_Company} onValueChange={(val) => handleInput({ target: { id: "bank_Company", value: val } })}>
                                <SelectTrigger className={`bg-white w-full ${errors.bank_Company ? "border-red-500" : ""}`}>
                                  <SelectValue placeholder="Select Bank" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PHILIPPINE_BANKS.map((bank, idx) => (
                                    <SelectItem key={idx} value={bank}>{bank}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {errors.bank_Company && <span className="text-xs text-red-500 block">{errors.bank_Company}</span>}
                            </div>

                            <div className="space-y-2">
                              <Label className="text-slate-600 font-semibold">Account Name <span className="text-red-500">*</span></Label>
                              <Input 
                                id="bank_AccountName" 
                                placeholder="Juan Dela Cruz" 
                                value={formData.bank_AccountName} 
                                onChange={handleInput} 
                                className={errors.bank_AccountName ? "border-red-500" : ""} 
                              />
                              {errors.bank_AccountName && <span className="text-xs text-red-500 block">{errors.bank_AccountName}</span>}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                              <Label className="text-slate-600 font-semibold">Account Number <span className="text-red-500">*</span></Label>
                              <div className="relative">
                                <Input 
                                  id="account_Number" 
                                  type={showAccountNumber ? "text" : "password"}
                                  placeholder="e.g. 00123456789" 
                                  value={formData.account_Number} 
                                  onChange={handleInput} 
                                  className={`bg-white pr-10 ${errors.account_Number ? "border-red-500" : ""}`} 
                                />
                                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowAccountNumber(!showAccountNumber)}>
                                  {showAccountNumber ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                </button>
                              </div>
                              {errors.account_Number && <span className="text-xs text-red-500 block">{errors.account_Number}</span>}
                            </div>

                          </div>
                        </div>

                      </div>
                    )}

                    {/* STEP 3: Security */}
                    {activeStep === 3 && (
                      <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
                         <Label className="text-slate-800 font-bold text-lg border-b border-slate-100 pb-2 block">Security & Biometrics</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {inputs.filter(i => step3Fields.includes(i.id)).map(renderDynamicInput)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Navigation Footer */}
                  <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-100">
                    <Button 
                      variant="outline" 
                      onClick={handlePrevStep} 
                      disabled={activeStep === 1}
                      className="w-24 border-slate-200"
                    >
                      Back
                    </Button>
                    
                    {activeStep < totalSteps ? (
                      <Button onClick={handleNextStep} className="w-32 bg-[#2A174E] hover:bg-[#1a0e30] text-white">
                        Continue
                      </Button>
                    ) : (
                      <Button onClick={handleSubmit} disabled={loading} className="w-32 bg-green-600 hover:bg-green-700 text-white font-bold shadow-md">
                        {loading ? "Saving..." : "Finish & Save"}
                      </Button>
                    )}
                  </div>
                </div>

              </div>
            </Card>
          </TabsContent>

          {/* BATCH UPLOAD TAB */}
          <TabsContent value="batch" className="mt-0">
            <Card className="shadow-sm border-0 bg-white border-t-4 border-[#2A174E]">
              <CardContent className="flex flex-col items-center justify-center p-8 md:p-16 min-h-[400px]">
                
                <div className="bg-slate-50 p-6 rounded-full mb-6">
                  <UploadFileIcon className="text-[#2A174E] h-16 w-16 opacity-80" />
                </div>
                
                <div className="text-center mb-10 max-w-lg">
                  <h3 className="text-2xl font-bold text-[#2A174E] mb-2">Upload CSV File</h3>
                  <p className="text-slate-500 leading-relaxed">
                    Register multiple users quickly by uploading a properly formatted CSV file. 
                    If you don't have the template yet, download it below to get started.
                  </p>
                </div>
                
                <div className="flex flex-col items-center gap-5 w-full max-w-md">
                  
                  <Button 
                    variant="outline" 
                    onClick={downloadCsvTemplate} 
                    className="w-full h-12 text-[#2A174E] border-[#2A174E] hover:bg-[#f0ebfa] font-semibold"
                  >
                    <FileDownloadOutlinedIcon className="mr-2 h-5 w-5" /> Download CSV Template
                  </Button>
                  
                  <div className="w-full relative border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
                    <Input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleCsvChange} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    />
                    <div className="pointer-events-none">
                      {csvFile ? (
                        <p className="text-green-600 font-semibold flex items-center justify-center gap-2">
                          <span className="truncate max-w-[200px]">{csvFile.name}</span> selected
                        </p>
                      ) : (
                        <p className="text-slate-500 font-medium">Click to browse or drag and drop a .csv file here</p>
                      )}
                    </div>
                  </div>

                  <Button 
                    onClick={handleBatchSubmit} 
                    disabled={batchLoading || !csvFile} 
                    className="w-full h-12 bg-[#2A174E] hover:bg-[#1a0e30] text-white font-semibold shadow-sm mt-2"
                  >
                    {batchLoading ? "Processing..." : "Upload and Register Users"}
                  </Button>

                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Modals */}
        <RfidScanModal 
          isOpen={showRfidModal} 
          onClose={() => setShowRfidModal(false)}
          onRescan={handleScanRFID}
          onConfirm={() => {
            setFormData(prev => ({ ...prev, user_MachipId: localScannedId }));
            setShowRfidModal(false);
            setToast({ message: `MaChip linked: ${localScannedId}`, type: "success" });
          }}
          scannedId={localScannedId} 
          error={rfidError}
        />
        <RfidScanModal 
          isOpen={showFingerprintModal} 
          onClose={() => setShowFingerprintModal(false)}
          onRescan={handleScanFingerprint}
          onConfirm={() => {
            setFormData(prev => ({ ...prev, user_FingerprintId: localFingerprintId }));
            setShowFingerprintModal(false);
            setToast({ message: `Fingerprint slot ${localFingerprintId} assigned`, type: "success" });
          }}
          scannedId={localFingerprintId} 
          error={fingerprintError}
          title="Fingerprint Scanner" 
        />

        {/* Admin Confirmation Modal */}
        {showAdminConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-md shadow-2xl border-0 animate-in zoom-in-95 duration-200">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <VisibilityIcon className="h-8 w-8" />
                  </div>
                  <h2 className="text-xl font-bold text-[#2A174E]">Admin Promotion Required</h2>
                  <p className="text-sm text-slate-500 mt-2">
                    You are about to promote this user to <b className="text-slate-800">{formData.user_Role}</b>. 
                    This grants elevated system access.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase">Verify Admin Identity</Label>
                    <Input
                      type="password"
                      placeholder="Enter your admin password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="h-12 border-slate-200 focus-visible:ring-[#2A174E]"
                      autoFocus
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 h-11 border-slate-200" 
                      onClick={() => { setShowAdminConfirm(false); setAdminPassword(""); }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      className="flex-1 h-11 bg-[#2A174E] hover:bg-[#1a0e30] text-white" 
                      onClick={() => handleSubmit()}
                    >
                      Confirm Promotion
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      </Sidebar>
    </div>
  );
};

export default New;