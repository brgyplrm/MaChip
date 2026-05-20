import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import { useParams, useNavigate, Link } from "react-router-dom";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import RfidScanModal from "../../components/rfidScanModal/RfidScanModal";
import { fetchWithAuth } from "../../utils/api";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

import { Switch } from "@/components/ui/switch";

// ── Validation helpers ────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[a-zA-Z\s]+$/;

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

const validateForm = (formData) => {
  const errors = {};

  if (!formData.user_FirstName || !formData.user_FirstName.trim()) {
    errors.user_FirstName = "First name is required.";
  } else if (!nameRegex.test(formData.user_FirstName)) {
    errors.user_FirstName = "First Name cannot contain numbers or special characters";
  }

  if (!formData.user_LastName || !formData.user_LastName.trim()) {
    errors.user_LastName = "Last name is required.";
  } else if (!nameRegex.test(formData.user_LastName)) {
    errors.user_LastName = "Last Name cannot contain numbers or special characters";
  }

  if (!formData.user_Email || !formData.user_Email.trim()) {
    errors.user_Email = "Email is required.";
  } else if (!EMAIL_REGEX.test(formData.user_Email)) {
    errors.user_Email = "Invalid email format.";
  }

  if (!formData.user_Role) {
    errors.user_Role = "Role is required.";
  }

  if (!formData.user_EmploymentStatus) {
    errors.user_EmploymentStatus = "Employment Status is required.";
  }

  if (!formData.account_Number || !formData.account_Number.trim()) {
    errors.account_Number = "Account number is required.";
  } else if (![12, 15].includes(formData.account_Number.length)) {
    errors.account_Number = "Account number must be 12 or 15 digits.";
  }

  if (!formData.bank_Company) {
    errors.bank_Company = "Bank is required.";
  }

  if (!formData.bank_AccountName || !formData.bank_AccountName.trim()) {
    errors.bank_AccountName = "Account name is required.";
  }

  // Password is only required if user starts typing a new one
  if (formData.user_Password && formData.user_Password.trim() !== "") {
    if (formData.user_Password.length < 6) {
      errors.user_Password = "Password must be at least 6 characters.";
    }
  }

  return errors;
};

const Edit = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState("");
  const [existingAvatar, setExistingAvatar] = useState("");
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [formData, setFormData] = useState({
    user_FirstName: "",
    user_LastName: "",
    user_Email: "",
    user_Phone: "",
    user_Address: "",
    user_Role: "",
    user_RoleId: "",
    user_EmploymentStatus: "",
    user_EmploymentStatusId: "",
    user_Password: "",
    user_MachipId: "",
    user_FingerprintId: "",
    user_DOB: "",
    user_Gender: "",
    civil_status: "Single",
    is_solo_parent: false,
    shift_Schedule: "",
    dailyRate: "",
    is_attendance_exempt: false,
    healthCard_Amnt: "",
    SSS_Ded: "",
    Philhealth_Ded: "",
    HDMF_Ded: "",
    Tax_Ded: "",
    SSS_Loan: "",
    HDMF_Loan: "",
    calamityLoan_Amnt: "",
    eastwest_Loan: "",
    globe_Deduction: "",
    multiPurposeSavings: "",
    advances_Amnt: "",
    account_Number: "",
    bank_Company: "",
    bank_AccountName: ""
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [positions, setPositions] = useState([]);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [loadingGovt, setLoadingGovt] = useState(false);
  const [userData, setUserData] = useState(null);
  
  const [originalRole, setOriginalRole] = useState("");
// ... (rest of state)

  // ── Automatic Calculation ──────────────────────────────────────────────────
  useEffect(() => {
    const rate = parseFloat(formData.dailyRate);
    if (!isNaN(rate) && rate > 0 && !loadingGovt) {
      const timer = setTimeout(() => {
        handleCalculateGovt(rate);
      }, 1000); // Debounce
      return () => clearTimeout(timer);
    }
  }, [formData.dailyRate]);

  const handleCalculateGovt = async (rate) => {
    setLoadingGovt(true);
    try {
      const gross = rate * 26;
      const response = await fetchWithAuth(`/api/payroll/govt-deductions-preview?grossPay=${gross}&user_Id=${userId}`);
      const result = await response.json();
      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          SSS_Ded: result.SSS_Ded,
          Philhealth_Ded: result.Philhealth_Ded,
          HDMF_Ded: result.HDMF_Ded,
          Tax_Ded: result.Tax_Ded
        }));
      }
    } catch (error) {
      console.error("Calculation error:", error);
    } finally {
      setLoadingGovt(false);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  const [showRfidModal, setShowRfidModal] = useState(false);
  const [rfidError, setRfidError] = useState("");
  const [localScannedId, setLocalScannedId] = useState("");
  const [originalMachipId, setOriginalMachipId] = useState("");
  const [originalFingerprintId, setOriginalFingerprintId] = useState("");

  const [showFingerprintModal, setShowFingerprintModal] = useState(false);
  const [fingerprintError, setFingerprintError] = useState("");
  const [localFingerprintId, setLocalFingerprintId] = useState("");

  const handleScanRFID = async () => {
    setShowRfidModal(true);
    setRfidError("");
    setLocalScannedId("");

    // Clear any previous conflicting session on the ESP32 first
    await fetchWithAuth("/api/esp/fingerprint/session/clear", { method: "POST" })
      .catch(err => console.warn("Could not clear previous session:", err));

    // Wait briefly to allow the hardware to acknowledge the clear command
    await new Promise(resolve => setTimeout(resolve, 500));

    // Start session
    fetchWithAuth("/api/system/reg-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, type: 'RFID' })
    }).catch(err => console.error("Failed to start RFID session:", err));
    try {
      const scanResponse = await fetchWithAuth("/api/users/generateRfid");
      const scanData = await scanResponse.json();
  
      if (scanResponse.ok && scanData.rfid) {
        if (scanData.rfid === originalMachipId) {
          setLocalScannedId(scanData.rfid);
          return;
        }
  
        const checkResponse = await fetchWithAuth(`/api/users/check-machip/${scanData.rfid}`);
        const checkData = await checkResponse.json();
  
        if (checkResponse.ok && checkData.exists && checkData.user_Id !== parseInt(userId)) {
          setRfidError("This MaChip ID is already assigned to another user.");
          setLocalScannedId(scanData.rfid);
        } else {
          setLocalScannedId(scanData.rfid);
        }
      } else {
        setRfidError(scanData.error || "Failed to scan RFID. Please try again.");
      }
    } catch (err) {
      setRfidError("Connection error during RFID scan.");
    }
  };
  
  const handleScanFingerprint = async () => {
    setShowFingerprintModal(true);
    setFingerprintError("");
    setLocalFingerprintId("");

    // Clear any previous conflicting session on the ESP32 first
    await fetchWithAuth("/api/esp/fingerprint/session/clear", { method: "POST" })
      .catch(err => console.warn("Could not clear previous session:", err));

    // Wait briefly to allow the hardware to acknowledge the clear command
    await new Promise(resolve => setTimeout(resolve, 500));

    // Start session
    fetchWithAuth("/api/system/reg-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, type: 'FP' })
    }).catch(err => console.error("Failed to start FP session:", err));

    try {
      const scanResponse = await fetchWithAuth(`/api/users/generateFingerprint?userId=${userId}`);
      const scanData = await scanResponse.json();
  
      if (scanResponse.ok && scanData.fingerprintId !== undefined) {
        const fpIdStr = scanData.fingerprintId.toString();

        if (fpIdStr === originalFingerprintId) {
          setLocalFingerprintId(fpIdStr);
          return;
        }

        const checkResponse = await fetchWithAuth(`/api/users/check-fingerprint/${fpIdStr}`);
        const checkData = await checkResponse.json();
  
        if (checkResponse.ok && checkData.exists && checkData.user_Id !== parseInt(userId)) {
          setFingerprintError("This Fingerprint ID is already assigned to another user.");
          setLocalFingerprintId(fpIdStr);
        } else {
          setLocalFingerprintId(fpIdStr);
        }
      } else {
        setFingerprintError(scanData.error || "Failed to enroll fingerprint. Please try again.");
      }
    } catch (err) {
      setFingerprintError("Connection error during fingerprint scan.");
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

  useEffect(() => {
    fetchWithAuth("/api/positions")
      .then(res => res.json())
      .then(data => setPositions(data))
      .catch(err => console.error("Error fetching positions:", err));
  }, []);

  const dismissToast = useCallback(() => {
    setToast({ message: "", type: "success" });
  }, []);

  const showToastMsg = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "success" }), 3000);
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetchWithAuth(`/api/users/${userId}`);
        if (response.ok) {
          const userData = await response.json();
          setFormData({
            user_FirstName: userData.user_FirstName || "",
            user_LastName: userData.user_LastName || "",
            user_Email: userData.user_Email || "",
            user_Phone: userData.user_Phone || "",
            user_Address: userData.user_Address || "",
            user_Role: userData.user_Role || "",
            user_RoleId: userData.user_RoleId || 3,
            department: userData.department || "",
            position: userData.position || "",
            position_id: userData.position_id || "",
            user_EmploymentStatus: userData.user_EmploymentStatus || "",
            user_EmploymentStatusId: userData.user_EmploymentStatusId || 1,
            user_Password: "", // Do not show hash, leave empty for optional update
            user_MachipId: userData.user_MachipId || "",
            user_FingerprintId: userData.user_FingerprintId || "",
            user_ShiftId: userData.user_ShiftId || 1,
            user_DOB: userData.user_DOB ? userData.user_DOB.split('T')[0] : "",
            user_Gender: userData.user_Gender || "",
            civil_status: userData.civil_status || "Single",
            is_solo_parent: userData.is_solo_parent || false,
            shift_Schedule: userData.shift_Schedule || "",
            dailyRate: userData.dailyRate || "",
            is_attendance_exempt: userData.is_attendance_exempt || false,
            healthCard_Amnt: userData.healthCard_Amnt || "",
            SSS_Ded: userData.sss_Share || "",
            Philhealth_Ded: userData.philhealth_Share || "",
            HDMF_Ded: userData.hdmf_Share || "",
            Tax_Ded: userData.tax_Share || "",
            SSS_Loan: userData.SSS_Loan || "",
            HDMF_Loan: userData.HDMF_Loan || "",
            calamityLoan_Amnt: userData.calamityLoan_Amnt || "",
            eastwest_Loan: userData.eastwest_Loan || "",
            globe_Deduction: userData.globe_Deduction || "",
            multiPurposeSavings: userData.multiPurposeSavings || "",
            advances_Amnt: userData.advances_Amnt || "",
            account_Number: userData.account_Number || "",
            bank_Company: userData.bank_Company || "UnionBank of the Philippines",
            bank_AccountName: userData.bank_AccountName || ""
          });
          setUserData(userData);
          setExistingAvatar(userData.user_Avatar || "");
          setOriginalRole(userData.user_Role);
          setOriginalMachipId(userData.user_MachipId || "");
          setOriginalFingerprintId(userData.user_FingerprintId || "");
        } else {
          showToastMsg("Failed to fetch user data.", "error");
        }
      } catch (err) {
        showToastMsg("Error fetching user data.", "error");
      }
    };
    fetchUser();
  }, [userId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Only allow digits for account_Number
    if (name === "account_Number" && value !== "" && !/^\d+$/.test(value)) {
      return; 
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      
      // Sync Role ID
      if (name === "user_Role") {
        const roleMap = { "Admin Manager": 1, "Supervisor": 2, "Employee": 3, "Admin Accountant": 4 };
        updated.user_RoleId = roleMap[value] || 3;
      }
      
      // Sync Employment Status ID
      if (name === "user_EmploymentStatus") {
        const statusMap = { "Regular": 1, "Part-time": 2, "Intern / OJT": 3 };
        updated.user_EmploymentStatusId = statusMap[value] || 1;
      }
      
      return updated;
    });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const generatePassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
    let password = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
      password += charset.charAt(Math.floor(Math.random() * n));
    }
    setFormData((prev) => ({ ...prev, user_Password: password }));
    if (errors.user_Password) setErrors((prev) => ({ ...prev, user_Password: "" }));
  };

  // ── Auto-Compute Govt Deductions ───────────────────────────────────────────
  useEffect(() => {
    const rate = parseFloat(formData.dailyRate);
    if (!isNaN(rate) && rate > 0) {
      const monthly = rate * 26;

      // 1. SSS Computation (Approximate Table Logic)
      const sss_msc = Math.min(Math.max(Math.round(monthly / 500) * 500, 5000), 35000);
      const sss_ee = Math.round(sss_msc * 0.05 * 100) / 100;

      // 2. PhilHealth (5% total split 50/50)
      const ph_clamped = Math.min(Math.max(monthly, 10000), 100000);
      const ph_ee = Math.round((ph_clamped * 0.05 / 2) * 100) / 100;
      
      // 3. HDMF (2% capped at 10,000 salary)
      const hdmf_mfs = Math.min(monthly, 10000);
      const hdmf_ee = Math.round(hdmf_mfs * (monthly <= 1500 ? 0.01 : 0.02));

      // Update form data IF they are currently 0 or empty (prevent overwriting manual entry on load)
      // Or if the rate was just changed
      setFormData(prev => ({
        ...prev,
        SSS_Ded: prev.SSS_Ded === "" || prev.SSS_Ded == 0 || prev.dailyRate !== userData?.dailyRate ? sss_ee : prev.SSS_Ded,
        Philhealth_Ded: prev.Philhealth_Ded === "" || prev.Philhealth_Ded == 0 || prev.dailyRate !== userData?.dailyRate ? ph_ee : prev.Philhealth_Ded,
        HDMF_Ded: prev.HDMF_Ded === "" || prev.HDMF_Ded == 0 || prev.dailyRate !== userData?.dailyRate ? hdmf_ee : prev.HDMF_Ded
      }));
    }
  }, [formData.dailyRate, userData?.dailyRate]);

  const handleUpdate = async (adminVerification = null) => {
    try {
      const formDataToSend = new FormData();

      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== undefined && formData[key] !== "") {
          formDataToSend.append(key, formData[key]);
        }
      });

      if (file) {
        formDataToSend.append("user_Avatar", file);
      }

      if (adminVerification) {
        formDataToSend.append("adminPassword", adminVerification);
      }

      const response = await fetch(`/api/users/updateUser/${userId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formDataToSend,
      });

      if (response.ok) {
        showToastMsg("User profile successfully updated!", "success");
        setTimeout(() => navigate(-1), 2000);
      } else {
        const errorData = await response.json();
        showToastMsg(errorData.error || "Failed to update user.", "error");
      }
    } catch (error) {
      showToastMsg("Network error occurred.", "error");
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const validationErrors = validateForm(formData);
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      console.error("[VALIDATION ERROR] Fields failed validation:", validationErrors);
      showToastMsg("Please fix the validation errors before saving.", "error");
      return;
    }

    if (['Admin Manager', 'Admin Accountant'].includes(formData.user_Role) && originalRole !== formData.user_Role) {
      setShowAdminConfirm(true);
    } else {
      handleUpdate();
    }
  };

  const confirmAdminPromotion = async () => {
    if (!adminPassword) {
      showToastMsg("Please enter your admin password to confirm.", "error");
      return;
    }
    setShowAdminConfirm(false);
    handleUpdate(adminPassword);
  };

  const renderError = (field) => {
    return errors[field] ? <span className="text-red-500 text-xs mt-1 block">{errors[field]}</span> : null;
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      
      <div className="flex-1 p-4 md:p-8 w-full max-w-6xl mx-auto overflow-x-hidden min-w-0">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full hover:bg-slate-200">
              <ArrowBackIcon className="text-slate-600" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Edit Profile: {formatUserId(userId)}</h1>
              <span className="text-sm text-slate-500 mt-1 block">Update employee records, compensation, and security access.</span>
            </div>
          </div>
          <Button onClick={handleSubmit} className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30] shadow-sm h-11 px-6">
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto sm:h-12 bg-slate-200/60 p-1 rounded-lg gap-1 sm:gap-0 mb-6">
            <TabsTrigger value="personal" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
              Personal Information
            </TabsTrigger>
            <TabsTrigger value="employment" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
              Employment & Comp
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
              Security & Hardware
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Personal Information */}
          <TabsContent value="personal">
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg text-[#2A174E]">Personal Details</CardTitle>
                <CardDescription>Basic contact and identity information.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                
                <div className="flex flex-col md:flex-row gap-8 mb-6">
                  {/* Avatar Upload */}
                  <div className="flex flex-col items-center justify-center gap-3 w-full md:w-1/4">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-100 shadow-sm relative group bg-slate-50 flex items-center justify-center">
                      <img
                        src={
                          file
                            ? URL.createObjectURL(file)
                            : existingAvatar
                            ? `/api/uploads/${existingAvatar}`
                            : "https://icon-library.com/images/no-image-icon/no-image-icon-0.jpg"
                        }
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                      <label htmlFor="file" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                        <DriveFolderUploadOutlinedIcon />
                      </label>
                    </div>
                    <input
                      type="file"
                      id="file"
                      onChange={(e) => setFile(e.target.files[0])}
                      style={{ display: "none" }}
                      accept="image/*"
                    />
                    <span className="text-xs font-semibold text-slate-500">Upload Photo</span>
                  </div>

                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full md:w-3/4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">First Name <span className="text-red-500">*</span></Label>
                      <Input name="user_FirstName" value={formData.user_FirstName} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E]"/>
                      {renderError("user_FirstName")}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Name <span className="text-red-500">*</span></Label>
                      <Input name="user_LastName" value={formData.user_LastName} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E]"/>
                      {renderError("user_LastName")}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address <span className="text-red-500">*</span></Label>
                      <Input name="user_Email" type="email" value={formData.user_Email} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E]"/>
                      {renderError("user_Email")}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number <span className="text-red-500">*</span></Label>
                      <Input name="user_Phone" value={formData.user_Phone} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E]"/>
                      {renderError("user_Phone")}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Home Address <span className="text-red-500">*</span></Label>
                      <Input name="user_Address" value={formData.user_Address} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E]"/>
                      {renderError("user_Address")}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date of Birth</Label>
                      <Input name="user_DOB" type="date" value={formData.user_DOB} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E]"/>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gender</Label>
                      <Select value={formData.user_Gender} onValueChange={(val) => handleSelectChange("user_Gender", val)}>
                        <SelectTrigger className="border-slate-200 focus-visible:ring-[#2A174E]">
                          <SelectValue placeholder="Select Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Civil Status</Label>
                      <Select value={formData.civil_status} onValueChange={(val) => handleSelectChange("civil_status", val)}>
                        <SelectTrigger className="border-slate-200 focus-visible:ring-[#2A174E]">
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
                    <div className="space-y-2 flex items-center gap-3 pt-6">
                      <input 
                        type="checkbox" 
                        id="is_solo_parent" 
                        checked={formData.is_solo_parent} 
                        onChange={(e) => handleSelectChange("is_solo_parent", e.target.checked)}
                        className="h-4 w-4 text-[#2A174E] focus:ring-[#2A174E] border-gray-300 rounded"
                      />
                      <Label htmlFor="is_solo_parent" className="text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer">Solo Parent?</Label>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Employment & Compensation */}
          <TabsContent value="employment">
            <div className="space-y-6">
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg text-[#2A174E]">Role & Status</CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Role <span className="text-red-500">*</span></Label>
                    <Select value={formData.user_Role} onValueChange={(val) => handleSelectChange("user_Role", val)}>
                      <SelectTrigger className="border-slate-200 focus-visible:ring-[#2A174E]">
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Employee">Employee</SelectItem>
                        <SelectItem value="Supervisor">Supervisor</SelectItem>
                        <SelectItem value="Admin Manager">Admin Manager</SelectItem>
                        <SelectItem value="Admin Accountant">Admin Accountant</SelectItem>
                      </SelectContent>
                    </Select>
                    {renderError("user_Role")}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employment Status <span className="text-red-500">*</span></Label>
                    <Select value={formData.user_EmploymentStatus} onValueChange={(val) => handleSelectChange("user_EmploymentStatus", val)}>
                      <SelectTrigger className="border-slate-200 focus-visible:ring-[#2A174E]">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Regular">Regular</SelectItem>
                        <SelectItem value="Part-time">Part-time</SelectItem>
                        <SelectItem value="Intern / OJT">Intern / OJT</SelectItem>
                      </SelectContent>
                    </Select>
                    {renderError("user_EmploymentStatus")}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shift Schedule <span className="text-red-500">*</span></Label>
                    <Select value={formData.user_ShiftId?.toString()} onValueChange={(val) => handleSelectChange("user_ShiftId", parseInt(val))}>
                      <SelectTrigger className="border-slate-200 focus-visible:ring-[#2A174E]">
                        <SelectValue placeholder="Select Shift" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Morning Shift (8:30 AM - 5:30 PM)</SelectItem>
                        <SelectItem value="2">Evening Shift (8:30 PM - 5:30 AM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* New Department & Position Section */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department <span className="text-red-500">*</span></Label>
                    <Select 
                      value={formData.department} 
                      onValueChange={(val) => {
                        setFormData(prev => ({ ...prev, department: val, position: "", position_id: "" }));
                      }}
                    >
                      <SelectTrigger className="border-slate-200 focus-visible:ring-[#2A174E]">
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {[...new Set(positions.map(p => p.department))].map((dept) => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Position <span className="text-red-500">*</span></Label>
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
                      <SelectTrigger className="border-slate-200 focus-visible:ring-[#2A174E]">
                        <SelectValue placeholder={formData.department ? "Select Position" : "Select Dept First"} />
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
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg text-[#2A174E]">Compensation & Deductions</CardTitle>
                  <CardDescription>Leave empty or 0 if not applicable.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  
                  {/* Daily Rate */}
                  <div className="space-y-2 sm:col-span-2 md:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-2">
                    <Label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Base Daily Rate (₱)</Label>
                    <Input name="dailyRate" type="number" step="0.01" value={formData.dailyRate} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E] font-mono text-lg bg-white"/>
                  </div>

                </CardContent>
              </Card>

              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg text-[#2A174E]">Bank & Payroll Details</CardTitle>
                  <CardDescription>Configure payout destination.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bank Company <span className="text-red-500">*</span></Label>
                    <Select value={formData.bank_Company} onValueChange={(val) => handleSelectChange("bank_Company", val)}>
                      <SelectTrigger className="border-slate-200 focus-visible:ring-[#2A174E]">
                        <SelectValue placeholder="Select Bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {PHILIPPINE_BANKS.map((bank, idx) => (
                          <SelectItem key={idx} value={bank}>{bank}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {renderError("bank_Company")}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Account Name <span className="text-red-500">*</span></Label>
                    <Input 
                      name="bank_AccountName" 
                      placeholder="Juan Dela Cruz" 
                      value={formData.bank_AccountName} 
                      onChange={handleChange} 
                      className="border-slate-200 focus-visible:ring-[#2A174E]" 
                    />
                    {renderError("bank_AccountName")}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Account Number <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input 
                        name="account_Number" 
                        type={showAccountNumber ? "text" : "password"}
                        placeholder="e.g. 00123456789" 
                        value={formData.account_Number} 
                        onChange={handleChange} 
                        className="pr-10 border-slate-200 focus-visible:ring-[#2A174E]" 
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowAccountNumber(!showAccountNumber)}>
                        {showAccountNumber ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </button>
                    </div>
                    {renderError("account_Number")}
                  </div>

                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 3: Security & Hardware */}
          <TabsContent value="security">
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg text-[#2A174E]">Security & Access Configuration</CardTitle>
                <CardDescription>Manage password and biometric hardware tokens.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                
                {/* Password Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 relative">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Password <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        name="user_Password"
                        value={formData.user_Password}
                        onChange={handleChange}
                        className="pr-10 border-slate-200 focus-visible:ring-[#2A174E]"
                      />
                      <div 
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600" 
                        onClick={togglePasswordVisibility}
                      >
                        {showPassword ? <VisibilityOffIcon fontSize="small"/> : <VisibilityIcon fontSize="small"/>}
                      </div>
                    </div>
                    {renderError("user_Password")}
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" onClick={generatePassword} className="w-full sm:w-auto border-[#2A174E] text-[#2A174E] hover:bg-slate-50">
                      <VpnKeyOutlinedIcon className="mr-2 h-4 w-4" /> Auto-Generate
                    </Button>
                  </div>
                </div>

                {/* Biometrics Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div className="space-y-3 bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">MaChip Hardware Token</Label>
                        <p className="text-lg font-mono font-bold text-[#2A174E] mt-1 break-all">
                          {formData.user_MachipId || "Unlinked"}
                        </p>
                      </div>
                    </div>
                    <Button onClick={handleScanRFID} className="w-full bg-[#2A174E] text-white hover:bg-[#1a0e30]">
                      Scan / Assign MaChip
                    </Button>
                  </div>

                  <div className="space-y-3 bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fingerprint Template</Label>
                        <p className="text-lg font-mono font-bold text-[#2A174E] mt-1 break-all">
                          {formData.user_FingerprintId || "Unenrolled"}
                        </p>
                      </div>
                    </div>
                    <Button onClick={handleScanFingerprint} className="w-full bg-[#2A174E] text-white hover:bg-[#1a0e30]">
                      Enroll Fingerprint
                    </Button>
                  </div>
                </div>

              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Admin Verification Dialog */}
        <Dialog open={showAdminConfirm} onOpenChange={(open) => {
          if(!open) {
            setShowAdminConfirm(false);
            setAdminPassword("");
          }
        }}>
          <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#2A174E]">Verify Administrator Override</DialogTitle>
              <DialogDescription className="text-slate-500 mt-2 leading-relaxed">
                You are about to promote this user to <b>{formData.user_Role}</b>. This grants elevated system access. Please enter your current admin password to verify this critical action.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Your Admin Password</Label>
                <Input
                  type="password"
                  placeholder="Enter your password..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="h-12 border-slate-200 focus-visible:ring-[#2A174E]"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="flex sm:justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowAdminConfirm(false); setAdminPassword(""); }} className="border-slate-200">
                Cancel
              </Button>
              <Button onClick={confirmAdminPromotion} className="bg-[#2A174E] hover:bg-[#1a0e30] text-white">
                Confirm Promotion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
      
      {/* Modals for Scanning */}
      <RfidScanModal 
        isOpen={showRfidModal} 
        onClose={closeRfidModal}
        onRescan={handleScanRFID}
        onConfirm={() => {
          setFormData(prev => ({ ...prev, user_MachipId: localScannedId }));
          setShowRfidModal(false);
          // Also clear session on confirm
          fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
        }}
        scannedId={localScannedId} 
        error={rfidError}
        currentId={originalMachipId}
      />
      <RfidScanModal 
        isOpen={showFingerprintModal} 
        onClose={closeFingerprintModal}
        onRescan={handleScanFingerprint}
        onConfirm={() => {
          setFormData(prev => ({ ...prev, user_FingerprintId: localFingerprintId }));
          setShowFingerprintModal(false);
          // Also clear sessions on confirm
          fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
          fetchWithAuth("/api/users/clear-fingerprint-session", { method: "DELETE" }).catch(() => {});
        }}
        scannedId={localFingerprintId} 
        error={fingerprintError}
        currentId={originalFingerprintId}
        title="Fingerprint Scanner"
      />

      </Sidebar>
    </div>
  );
};

export default Edit;