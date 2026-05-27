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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { fetchWithAuth } from "../../utils/api";
import { Link } from "react-router-dom";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Switch } from "@/components/ui/switch";

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
  const step2Fields = ["user_Role", "user_EmploymentStatus", "user_Id", "department", "position", "taxStatus"];
  const step3Fields = ["user_Password", "user_MachipId", "user_FingerprintId"];

  // Single Registration State
  const [formData, setFormData] = useState({
    user_Id: "",
    user_FirstName: "",
    user_LastName: "",
    user_MiddleName: "",
    user_Phone: "",
    user_Address: "",
    user_DOB: "",
    user_Gender: "",
    civil_status: "Single",
    is_solo_parent: false,
    user_ShiftId: 1,
    user_EmploymentStatus: "Regular",
    user_EmploymentStatusId: 1,
    user_Role: "Employee",
    user_RoleId: 3,
    user_Email: "",
    department: "",
    position: "",
    position_id: "",
    taxStatus: "S",
    dailyRate: "",
    is_attendance_exempt: false,
    user_Password: "",
    user_MachipId: "",
    user_FingerprintId: "",
    user_FingerprintTemplate: "",
    account_Number: "",
    bank_Company: "UnionBank of the Philippines",
    bank_AccountName: "",
    user_RoleId: 3,
  });

  // Batch Upload State
  const [csvFile, setCsvFile] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState([]);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const dismissToast = useCallback(() => setToast({ message: "", type: "success" }), []);

  const [showFingerprintModal, setShowFingerprintModal] = useState(false);
  const [fingerprintError, setFingerprintError] = useState("");
  const [localFingerprintId, setLocalFingerprintId] = useState("");

  // Auto-fetch next ID and Positions on mount
  useEffect(() => {
    fetchWithAuth("/api/users/nextId")
      .then(res => res.json())
      .then(data => {
        if (data.nextId) {
          const formatted = data.displayId || `MACJ-${String(data.nextId).padStart(3, "0")}`;
          setDisplayId(formatted);
          setFormData(prev => ({ ...prev, user_Id: data.nextId }));
        }
      })
      .catch(err => console.error("Error fetching next ID:", err));

    fetchWithAuth("/api/positions")
      .then(res => res.json())
      .then(data => setPositions(data))
      .catch(err => console.error("Error fetching positions:", err));
  }, []);

  const handleInput = (e) => {
    const { id, value } = e.target;

    if (id === "user_Id") {
      setDisplayId(value);
      // Try to extract numeric part for formData
      const numericPart = value.replace(/[^0-9]/g, '');
      if (numericPart) {
        setFormData(prev => ({ ...prev, user_Id: parseInt(numericPart) }));
      }
      return;
    }

    setFormData((prev) => {
      const updated = { ...prev, [id]: value };

      // Map role name to ID
      if (id === "user_Role") {
        updated.user_RoleId = roleMap[value] || 3;
      }

      // Map employment status name to ID
      if (id === "user_EmploymentStatus") {
        const statusMap = { "Regular": 1, "Part-time": 2, "Intern / OJT": 3 };
        updated.user_EmploymentStatusId = statusMap[value] || 1;
      }

      return updated;
    });

    if (errors[id]) {
      setErrors((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const handleIdBlur = () => {
    if (displayId) {
      const numericPart = displayId.replace(/[^0-9]/g, '');
      if (numericPart) {
        const formatted = `MACJ-${numericPart.padStart(3, "0")}`;
        setDisplayId(formatted);
        setFormData(prev => ({ ...prev, user_Id: parseInt(numericPart) }));
      }
    }
  };

  const handleScanFingerprint = async () => {
    setShowFingerprintModal(true);
    setLocalFingerprintId("");
    setFingerprintError("");

    try {
      // Start session FIRST and await it to ensure backend is ready
      await fetchWithAuth("/api/system/reg-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: formData.user_Id || "temp", type: 'FP' })
      });

      const response = await fetchWithAuth(`/api/users/generateFingerprint?userId=${formData.user_Id}`);
      const data = await response.json();

      if (response.ok) {
        setLocalFingerprintId(data.fingerprintId);
        if (data.template) {
           setFormData(prev => ({ ...prev, user_FingerprintTemplate: data.template }));
        }
      } else {
        // Only set error if we are still in the modal
        setFingerprintError(data.error || "Failed to scan fingerprint.");
      }
    } catch (err) {
      console.error("FP Scan Error:", err);
      setFingerprintError("An error occurred during scanning.");
    }
  };

  const handleScanRFID = async () => {
    setShowRfidModal(true);
    setLocalScannedId("");
    setRfidError("");

    try {
      // Start session FIRST and await it
      await fetchWithAuth("/api/system/reg-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: formData.user_Id || "temp", type: 'RFID' })
      });

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
      console.error("RFID Scan Error:", err);
      setRfidError("An error occurred while scanning.");
    }
  };

  const closeRfidModal = () => {
    setShowRfidModal(false);
    fetchWithAuth("/api/system/reg-session", { method: "DELETE" })
      .catch(err => console.error("Failed to clear RFID session:", err));
  };

  const closeFingerprintModal = () => {
    setShowFingerprintModal(false);
    fetchWithAuth("/api/system/reg-session", { method: "DELETE" })
      .catch(err => console.error("Failed to clear FP session:", err));
    fetchWithAuth("/api/users/clear-fingerprint-session", { method: "DELETE" })
      .catch(err => console.error("Failed to clear in-memory FP session:", err));
  };

  // Stepper Validation Logic
  const validateStep = (step) => {
    const newErrors = {};
    if (step === 1) {
      if (!formData.user_FirstName.trim()) newErrors.user_FirstName = "Required";
      if (!formData.user_LastName.trim()) newErrors.user_LastName = "Required";
      if (!formData.user_Email?.trim()) newErrors.user_Email = "Required";
      else if (!EMAIL_REGEX.test(formData.user_Email.trim())) newErrors.user_Email = "Invalid email format";
      if (!formData.user_Phone?.trim()) newErrors.user_Phone = "Phone is required";
      if (!formData.user_Address?.trim()) newErrors.user_Address = "Address is required";
    } else if (step === 2) {
      if (!formData.user_Role) newErrors.user_Role = "Required";
      if (!formData.department?.trim()) newErrors.department = "Department is required";
      if (!formData.position?.trim()) newErrors.position = "Position is required";
      if (!formData.taxStatus) newErrors.taxStatus = "Tax Status is required";
      if (!formData.user_Role) newErrors.user_Role = "Required";
      if (!formData.user_EmploymentStatus) newErrors.user_EmploymentStatus = "Required";
      if (!formData.bank_Company) newErrors.bank_Company = "Required";
      if (!formData.bank_AccountName?.trim()) newErrors.bank_AccountName = "Required";
      if (!formData.dailyRate || parseFloat(formData.dailyRate) <= 0) newErrors.dailyRate = "Valid Daily Rate is required";
      if (!formData.account_Number?.trim()) {
        newErrors.account_Number = "Required";
      } else if (![12, 15].includes(formData.account_Number.length)) {
        newErrors.account_Number = "Account number must be 12 or 15 digits.";
      }
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
    const headers = "user_FirstName,user_LastName,user_MiddleName,user_Email,user_Password,user_Role,user_EmploymentStatus,bank_Company,bank_AccountName,account_Number,department,position,hireDate,taxStatus,user_Gender,civil_status,is_solo_parent\n";
    const sample = "Juan,Cruz,Dela,juan.cruz@example.com,password123,Employee,Regular,BDO Unibank (BDO),Juan Dela Cruz,1234567890,IT,Developer,2026-01-01,S,Male,Single,false\n";
    const csvContent = "\uFEFF" + headers + sample;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
  
      <Tabs defaultValue="single" className="w-full">
        {/* Header & Tabs Row */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 mb-4">
          
          {/* Title & Back Button Group */}
          <div className="group flex items-center gap-0 transition-all">
            {/* Back Button: Slides in on hover */}
            <div className="w-0 overflow-hidden group-hover:w-12 transition-all duration-300 ease-in-out">
              <Button 
                variant="ghost" 
                size="icon" 
                asChild 
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[#2A174E]"
              >
                <Link to="/users">
                  <ArrowBackIcon className="h-6 w-6" />
                </Link>
              </Button>
            </div>

            {/* Title Area: Adds padding when button appears */}
            <div className="transition-all duration-300 ease-in-out group-hover:pl-2">
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] leading-tight">{title}</h1>
              <p className="text-sm text-slate-500 mt-1">
                Register a new employee into the system or upload multiple records.
              </p>
            </div>
          </div>

          {/* Tabs List */}
          <TabsList className="grid w-full sm:w-[350px] grid-cols-2 h-11 bg-slate-200/60 rounded-lg shrink-0">
            <TabsTrigger 
              value="single" 
              className="data-[state=active]:bg-[#2A174E] data-[state=active]:text-white data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md"
            >
              Single Registration
            </TabsTrigger>
            <TabsTrigger 
              value="batch" 
              className="data-[state=active]:bg-[#2A174E] data-[state=active]:text-white data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md"
            >
              Batch Upload (CSV)
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Form Content */}
        <TabsContent value="single" className="space-y-6 mt-0">
          <Card className="shadow-sm border-0 bg-white overflow-hidden border-t-4 border-[#2A174E] py-0">
                <div className="flex flex-col lg:flex-row min-h-[600px]">
                  
                  {/* Left Column: Identity Preview */}
                  <div className="w-full lg:w-[350px] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col items-center justify-center p-6">
                    
                    <div className="w-72 h-[420px] bg-white rounded-2xl shadow-2xl relative overflow-hidden flex flex-col border border-gray-200">
                      
                      {/* Background Layers */}
                      <div className="absolute inset-0 z-0">
                        
                        {/* Background Layers: White Base with Thick Green, Ultra-thin White, and Blue Waves */}
                        <div className="absolute inset-0 z-0 bg-white">
                          {/* Layer 1: Green Wave (Thick Base) */}
                          <div className="absolute inset-0 bg-[#fea501] [mask-image:url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%20200%20150%22%20preserveAspectRatio=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M0,70%20C40,60%2060,80%20100,70%20C140,60%20160,50%20200,50%20L200,150%20L0,150%20Z%22%20fill=%22black%22/%3E%3C/svg%3E')] [mask-size:100%_100%] [mask-repeat:no-repeat]"></div>

                          {/* Layer 2: White Wave (Ultra-thin middle layer) */}
                          <div className="absolute inset-0 bg-white [mask-image:url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%20200%20150%22%20preserveAspectRatio=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M0,76%20C40,66%2060,86%20100,76%20C140,66%20160,56%20200,56%20L200,150%20L0,150%20Z%22%20fill=%22black%22/%3E%3C/svg%3E')] [mask-size:100%_100%] [mask-repeat:no-repeat]"></div>

                          {/* Layer 3: Blue Wave (The top-most wave) */}
                          <div className="absolute inset-0 bg-[#2A174E] [mask-image:url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%20200%20150%22%20preserveAspectRatio=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M0,80%20C40,70%2060,90%20100,80%20C140,70%20160,60%20200,60%20L200,150%20L0,150%20Z%22%20fill=%22black%22/%3E%3C/svg%3E')] [mask-size:100%_100%] [mask-repeat:no-repeat]"></div>
                        </div>
                        </div>

                      {/* Content Section */}
                      <div className="relative z-10 flex flex-col h-full pt-6">
                        <div className="px-6 text-center">
                          <div className="w-16 h-16 bg-white mx-auto mb-2  flex items-center justify-center font-bold text-[8px] text-gray-400 overflow-hidden">
                            <img src="/images.png" alt="Logo" />
                          </div>
                          <h1 className="text-[10px] font-bold text-[#2A174E] uppercase tracking-wider">MAC-J Int'l. Forwarding Ltd., Co.</h1>
                          <h2 className="text-[9px] font-bold text-[#2A174E] uppercase">JCG CUSTOMS BROKERAGE</h2>
                        </div>

                        {/* Profile Image */}
                        <div className="flex-grow flex justify-center items-center">
                          <div className="w-28 h-28 rounded-full border-[6px] border-[#fea501] shadow-xl bg-gray-200 overflow-hidden relative group">
                            <img
                              src={file ? URL.createObjectURL(file) : formData.user_ProfilePic ? `/api/uploads/${formData.user_ProfilePic}` : "/avatar.webp"}
                              className="w-full h-full object-cover"
                            />
                            {/* Hidden File Input Triggered by Label */}
                            <label htmlFor="file" className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-[10px] opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                              CHANGE
                            </label>
                          </div>
                        </div>

                        {/* Info Section */}
                        <div className="pb-6 px-6 text-white text-center">
                          <h2 className="text-lg font-black uppercase leading-tight tracking-tight">
                            {formData.user_FirstName || "FIRST"} {formData.user_LastName || "LAST"}
                          </h2>
                          <p className="text-[11px] font-semibold opacity-90">{formData.user_Role || "EMPLOYEE"}</p>
                          <p className="text-[10px] font-bold mt-1 tracking-widest">ID NO: {displayId || "MACJ-000"}</p>
                          <div className="h-6"/>
                        </div>
                      </div>
                    </div>
                    
                    {/* Actual File Input */}
                    <input type="file" id="file" onChange={(e) => setFile(e.target.files[0])} className="hidden" />
                  </div>

                  {/* Right Column: Multi-Step Form */}
                  <div className="w-full lg:flex-1 p-6 md:p-10 flex flex-col">
                    
                    {/* Stepper Header Indicator */}
                    <div className="relative mb-10 mx-auto w-full max-w-lg">
                      <div className="absolute left-0 top-3.75 w-full h-[2px] bg-slate-100 z-0"></div>
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
                    <div className="flex-1 min-h-87.5">
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">Phone Number <span className="text-red-500">*</span></Label>
                                <Input id="user_Phone" placeholder="09123456789" value={formData.user_Phone} onChange={handleInput} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">Gender</Label>
                                <Select value={formData.user_Gender} onValueChange={(val) => handleInput({ target: { id: "user_Gender", value: val } })}>
                                  <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Select Gender" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">Civil Status</Label>
                                <Select value={formData.civil_status} onValueChange={(val) => handleInput({ target: { id: "civil_status", value: val } })}>
                                  <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Select Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Single">Single</SelectItem>
                                    <SelectItem value="Married">Married</SelectItem>
                                    <SelectItem value="Widowed">Widowed</SelectItem>
                                    <SelectItem value="Separated">Separated</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1 flex items-center gap-3 pt-6">
                                <input 
                                  type="checkbox" 
                                  id="is_solo_parent" 
                                  checked={formData.is_solo_parent} 
                                  onChange={(e) => handleInput({ target: { id: "is_solo_parent", value: e.target.checked } })}
                                  className="h-4 w-4 text-[#2A174E] focus:ring-[#2A174E] border-gray-300 rounded"
                                />
                                <Label htmlFor="is_solo_parent" className="text-xs text-slate-500 cursor-pointer">Solo Parent?</Label>
                              </div>
                              <div className="space-y-1 sm:col-span-3">
                                <Label className="text-xs text-slate-500">Home Address <span className="text-red-500">*</span></Label>
                                <Input id="user_Address" placeholder="123 Main St, Manila" value={formData.user_Address} onChange={handleInput} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">Date of Birth</Label>
                                <Input id="user_DOB" type="date" value={formData.user_DOB} onChange={handleInput} />
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
                              {/* Existing Role & Status Selects */}
                              {inputs.filter(i => ["user_Role", "user_EmploymentStatus"].includes(i.id)).map(renderDynamicInput)}

                              {/* Updated Department Dropdown */}
                                <div className="space-y-2">
                                  <Label className="text-slate-600 font-semibold">Department <span className="text-red-500">*</span></Label>
                                  <Select 
                                    value={formData.department} 
                                    onValueChange={(val) => {
                                      handleInput({ target: { id: "department", value: val } });
                                      // Reset position when department changes
                                      setFormData(prev => ({ ...prev, position: "", position_id: "" }));
                                    }}
                                  >
                                    <SelectTrigger className={`bg-white w-full ${errors.department ? "border-red-500" : ""}`}>
                                      <SelectValue placeholder="Select Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {[...new Set(positions.map(p => p.department))].map((dept) => (
                                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                      ))}
                                      {positions.length === 0 && <SelectItem disabled value="none">No departments found</SelectItem>}
                                    </SelectContent>
                                  </Select>
                                  {errors.department && <span className="text-xs text-red-500 block">{errors.department}</span>}
                                </div>

                                {/* Updated Position Dropdown (Conditional) */}
                                <div className="space-y-2">
                                  <Label className="text-slate-600 font-semibold">Position <span className="text-red-500">*</span></Label>
                                  <Select 
                                    value={formData.position_id?.toString()} 
                                    onValueChange={(val) => {
                                      const selectedPos = positions.find(p => p.positionId.toString() === val);
                                      if (selectedPos) {
                                        setFormData(prev => ({ 
                                          ...prev, 
                                          position_id: selectedPos.positionId,
                                          position: selectedPos.title,
                                          dailyRate: selectedPos.baseDailyRate
                                        }));
                                      }
                                    }}
                                    disabled={!formData.department} 
                                  >
                                    <SelectTrigger className={`bg-white w-full ${errors.position ? "border-red-500" : ""}`}>
                                      <SelectValue placeholder={formData.department ? "Select Position" : "Select Department first"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {formData.department && positions
                                        .filter(p => p.department === formData.department)
                                        .map((pos) => (
                                          <SelectItem key={pos.positionId} value={pos.positionId.toString()}>{pos.title}</SelectItem>
                                        ))
                                      }
                                    </SelectContent>
                                  </Select>
                                  {errors.position && <span className="text-xs text-red-500 block">{errors.position}</span>}
                                </div>

                              {/* Tax Status Selection */}
                              <div className="space-y-2">
                                <Label className="text-slate-600 font-semibold">Tax Status (S/M) <span className="text-red-500">*</span></Label>
                                <Select 
                                  value={formData.taxStatus} 
                                  onValueChange={(val) => handleInput({ target: { id: "taxStatus", value: val } })}
                                >
                                  <SelectTrigger className={`bg-white w-full ${errors.taxStatus ? "border-red-500" : ""}`}>
                                    <SelectValue placeholder="Select Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="S">Single (S)</SelectItem>
                                    <SelectItem value="M">Married (M)</SelectItem>
                                  </SelectContent>
                                </Select>
                                {errors.taxStatus && <span className="text-xs text-red-500 block">{errors.taxStatus}</span>}
                              </div>

                              {/* Shift Schedule Selection */}
                              <div className="space-y-2">
                                <Label className="text-slate-600 font-semibold">Shift Schedule <span className="text-red-500">*</span></Label>
                                <Select 
                                  value={formData.user_ShiftId?.toString()} 
                                  onValueChange={(val) => handleInput({ target: { id: "user_ShiftId", value: parseInt(val) } })}
                                >
                                  <SelectTrigger className="bg-white w-full">
                                    <SelectValue placeholder="Select Shift" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">Morning Shift (8:30 AM - 5:30 PM)</SelectItem>
                                    <SelectItem value="2">Evening Shift (8:30 PM - 5:30 AM)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Daily Rate Input */}
                              <div className="space-y-2">
                                <Label className="text-slate-600 font-semibold">Base Daily Rate (₱) <span className="text-red-500">*</span></Label>
                                <Input 
                                  id="dailyRate" 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="0.00" 
                                  value={formData.dailyRate} 
                                  onChange={handleInput} 
                                  className={`bg-white ${errors.dailyRate ? "border-red-500" : ""}`}
                                />
                                {errors.dailyRate && <span className="text-xs text-red-500 block">{errors.dailyRate}</span>}
                              </div>
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
          onClose={closeRfidModal}
          onRescan={handleScanRFID}
          onConfirm={() => {
            setFormData(prev => ({ ...prev, user_MachipId: localScannedId }));
            setShowRfidModal(false);
            setToast({ message: `MaChip linked: ${localScannedId}`, type: "success" });
            // Clear session on confirm
            fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
          }}
          scannedId={localScannedId} 
          error={rfidError}
        />
        <RfidScanModal 
          isOpen={showFingerprintModal} 
          onClose={closeFingerprintModal}
          onRescan={handleScanFingerprint}
          onConfirm={() => {
            setFormData(prev => ({ ...prev, user_FingerprintId: localFingerprintId }));
            setShowFingerprintModal(false);
            setToast({ message: `Fingerprint slot ${localFingerprintId} assigned`, type: "success" });
            // Clear sessions on confirm
            fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
            fetchWithAuth("/api/users/clear-fingerprint-session", { method: "DELETE" }).catch(() => {});
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