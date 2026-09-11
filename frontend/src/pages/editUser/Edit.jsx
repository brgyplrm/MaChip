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
import { getStoredUser, setStoredUser } from "../../utils/authStorage";
import { ChevronLeft } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  if (formData.user_MiddleName && formData.user_MiddleName.trim()) {
    if (!nameRegex.test(formData.user_MiddleName)) {
      errors.user_MiddleName = "Middle Name cannot contain numbers or special characters";
    }
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

  const accNum = formData.account_Number?.trim() || "";
  if (!accNum) {
    errors.account_Number = "Account number is required.";
  } else if (!/^\d+$/.test(accNum)) {
    errors.account_Number = "Account number must contain numbers only.";
  } else if (accNum.length < 12) {
    const missing = 12 - accNum.length;
    errors.account_Number = `Account number must be 12 or 15 digits (${missing} more digit${missing > 1 ? "s" : ""} required).`;
  } else if (accNum.length > 12 && accNum.length < 15) {
    const missing = 15 - accNum.length;
    errors.account_Number = `Account number must be 12 or 15 digits (${missing} more digit${missing > 1 ? "s" : ""} required for 15 digits).`;
  } else if (accNum.length > 15) {
    const extra = accNum.length - 15;
    errors.account_Number = `Account number must be 12 or 15 digits (${extra} digit${extra > 1 ? "s" : ""} over limit).`;
  }

  if (!formData.bank_Company) {
    errors.bank_Company = "Bank is required.";
  }

  if (!formData.bank_AccountName || !formData.bank_AccountName.trim()) {
    errors.bank_AccountName = "Account name is required.";
  }

  // Password is only required if user starts typing a new one
  if (formData.user_Password && formData.user_Password.trim() !== "") {
    const pwd = formData.user_Password;
    if (pwd.length < 8) {
      errors.user_Password = "Password must be at least 8 characters.";
    } else if (!/[A-Z]/.test(pwd)) {
      errors.user_Password = "Password must include at least one uppercase letter (A-Z).";
    } else if (!/[a-z]/.test(pwd)) {
      errors.user_Password = "Password must include at least one lowercase letter (a-z).";
    } else if (!/[0-9]/.test(pwd)) {
      errors.user_Password = "Password must include at least one number (0-9).";
    } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
      errors.user_Password = "Password must include at least one special character (!@#$%^&*).";
    }
  }

  return errors;
};

import EditRequestModal from "../../components/EditRequestModal";
import FileViewerModal from "../../components/FileViewerModal";
import ImageCropperModal from "../../components/ImageCropperModal";

const Edit = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("userData") || "{}");
  const roleId = Number(currentUser?.user_RoleId);
  const isAdmin = roleId === 1 || currentUser?.user_Role === "Admin Manager";
  const isAccountant = roleId === 4 || currentUser?.user_Role === "Admin Accountant";
  const isSupervisor = roleId === 2 || currentUser?.user_Role === "Supervisor";
  const isMaster = isAdmin || isAccountant;

  const [file, setFile] = useState("");
  const [existingAvatar, setExistingAvatar] = useState("");
  const [isFileViewerOpen, setIsFileViewerOpen] = useState(false);
  
  // Cropper State
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState(null);

  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [formData, setFormData] = useState({
    user_FirstName: "",
    user_LastName: "",
    user_MiddleName: "",
    user_Email: "",
    user_Phone: "",
    user_Address: "",
    user_Role: "",
    user_RoleId: "",
    department: "",
    position: "",
    position_id: "",
    user_EmploymentStatus: "",
    user_EmploymentStatusId: "",
    hireDate: "",
    taxStatus: "S",
    user_Password: "",
    user_MachipId: "",
    user_FingerprintId: "",
    user_DOB: "",
    user_Gender: "",
    civil_status: "Single",
    is_solo_parent: false,
    shift_Schedule: "",
    dailyRate: "",
    is_time_exempt: false,
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
  const isTargetAdminManager = Number(formData.user_RoleId) === 1 || formData.user_Role === "Admin Manager" || Number(userData?.user_RoleId) === 1 || originalRole === "Admin Manager";
// ... (rest of state)

  // ── Automatic Calculation ──────────────────────────────────────────────────
  useEffect(() => {
    if (isMaster) {
      const rate = parseFloat(formData.dailyRate);
      if (!isNaN(rate) && rate > 0 && !loadingGovt) {
        const timer = setTimeout(() => {
          handleCalculateGovt(rate);
        }, 1000); // Debounce
        return () => clearTimeout(timer);
      }
    }
  }, [formData.dailyRate, isMaster]);

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
      const scanResponse = await fetchWithAuth(`/api/users/generateRfid?userId=${userId}`);
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
      .then(res => {
        if (res.status === 403) return [];
        return res.json();
      })
      .then(data => setPositions(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error("Error fetching positions:", err);
        setPositions([]);
      });
  }, []);

  // Synchronize position_id and department with positions list if mismatched or missing
  useEffect(() => {
    if (positions.length > 0 && formData.position) {
      const currentValid = positions.some(p => 
        p.positionId.toString() === formData.position_id?.toString() && 
        p.department === formData.department &&
        p.title.trim().toLowerCase() === formData.position.trim().toLowerCase()
      );
      if (!currentValid) {
        const match = positions.find(p => p.title.trim().toLowerCase() === formData.position.trim().toLowerCase());
        if (match) {
          setFormData(prev => ({
            ...prev,
            position_id: match.positionId,
            position: match.title,
            department: match.department || prev.department
          }));
        }
      }
    }
  }, [positions, formData.position, formData.department, formData.position_id]);

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
            user_MiddleName: userData.user_MiddleName || "",
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
            hireDate: userData.hireDate ? userData.hireDate.split('T')[0] : "",
            taxStatus: userData.taxStatus || "S",
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
            is_time_exempt: Boolean(userData.is_time_exempt),
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
          setExistingAvatar(userData.user_ProfilePic || "");
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
        const statusMap = { "Regular": 1, "Probationary": 2 };
        updated.user_EmploymentStatusId = statusMap[value] || 1;
      }
      
      return updated;
    });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const generatePassword = () => {
    const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lowers = "abcdefghijkmnopqrstuvwxyz";
    const numbers = "23456789";
    const symbols = "!@#$%^&*";
    const all = uppers + lowers + numbers + symbols;

    let password = [
      uppers[Math.floor(Math.random() * uppers.length)],
      lowers[Math.floor(Math.random() * lowers.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
    ];

    for (let i = 4; i < 12; i++) {
      password.push(all[Math.floor(Math.random() * all.length)]);
    }

    password = password.sort(() => 0.5 - Math.random()).join("");
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

      // Explicitly append user_MiddleName even if empty string so clearing it works
      if (formData.user_MiddleName !== undefined) {
        formDataToSend.set("user_MiddleName", formData.user_MiddleName);
      }

      // If Admin Manager, explicitly set hireDate and is_time_exempt
      if (isAdmin) {
        formDataToSend.set("is_time_exempt", formData.is_time_exempt ? "true" : "false");
        if (formData.hireDate) {
          formDataToSend.set("hireDate", formData.hireDate);
        }
      } else {
        formDataToSend.delete("hireDate");
        formDataToSend.delete("is_time_exempt");
      }

      if (file) {
        formDataToSend.append("user_ProfilePic", file);
      }

      if (adminVerification) {
        formDataToSend.append("adminPassword", adminVerification);
      }

      const response = await fetchWithAuth(`/api/users/updateUser/${userId}`, {
        method: "PUT",
        body: formDataToSend,
      });

      if (response.ok) {
        const result = await response.json();
        
        // If the updated user is the current logged-in user, update session and local storage
        const sessionUser = getStoredUser();
        if (sessionUser && parseInt(sessionUser.user_Id) === parseInt(userId)) {
          // Merge existing session data with updated data from server
          const updatedSessionData = { ...sessionUser, ...result.data };
          setStoredUser(updatedSessionData);
          
          // Trigger a custom event to notify other components (Sidebar/Navbar)
          window.dispatchEvent(new Event("userUpdate"));
        }

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
      
      <div className="flex-1 p-4 md:p-4 w-full max-w-6xl mx-auto overflow-x-hidden min-w-0">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <TooltipProvider>
            <div className="group flex items-center gap-0 transition-all">
              {/* Back Button: Slides in on hover */}
              <div className="w-0 overflow-hidden group-hover:w-12 transition-all duration-300 ease-in-out shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate(-1)} 
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[#2A174E] hover:bg-slate-200/60 rounded-full h-10 w-10"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800">
                    Back to previous page
                  </TooltipContent>
                </Tooltip>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Edit Profile | {formatUserId(userId)}</h1>
                <span className="text-sm text-slate-500 mt-1 block">Update employee records, compensation, and security access.</span>
              </div>
            </div>
          </TooltipProvider>
          <Button onClick={handleSubmit} className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30] shadow-sm h-11 px-6">
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className={`grid w-full ${isMaster ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1"} h-auto sm:h-12 bg-slate-200/60 p-1 rounded-lg gap-1 sm:gap-0 mb-6`}>
            <TabsTrigger value="personal" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
              Personal Information
            </TabsTrigger>
            {isMaster && (
              <>
                <TabsTrigger value="employment" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
                  Employment & Comp
                </TabsTrigger>
                <TabsTrigger value="security" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
                  Security & Hardware
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* TAB 1: Personal Information */}
          <TabsContent value="personal">
            <div className="space-y-6">
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
                        {file || existingAvatar ? (
                          <img
                            src={
                              file
                                ? URL.createObjectURL(file)
                                : `/api/uploads/${existingAvatar}`
                            }
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-[#2A174E] flex items-center justify-center text-white text-3xl font-bold tracking-wider select-none">
                            {((formData.user_FirstName?.trim().charAt(0) || "") + (formData.user_LastName?.trim().charAt(0) || "")).toUpperCase() || "U"}
                          </div>
                        )}
                        <label htmlFor="file" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                          <DriveFolderUploadOutlinedIcon />
                        </label>
                      </div>
                      <input
                        type="file"
                        id="file"
                        onChange={(e) => {
                          const selectedFile = e.target.files[0];
                          if (selectedFile) {
                            const validMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif"];
                            const validExtensions = [".png", ".jpg", ".jpeg", ".gif"];
                            const fileName = selectedFile.name.toLowerCase();
                            const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));
                            const hasValidMime = validMimeTypes.includes(selectedFile.type);

                            if (!hasValidExt && !hasValidMime) {
                              showToastMsg("File type is not accepted. Only PNG, JPEG, and GIF files are allowed.", "error");
                              e.target.value = "";
                              return;
                            }

                            const reader = new FileReader();
                            reader.onload = () => {
                              setTempImageSrc(reader.result);
                              setIsCropperOpen(true);
                            };
                            reader.readAsDataURL(selectedFile);
                          }
                        }}
                        style={{ display: "none" }}
                        accept=".png, .jpg, .jpeg, .gif, image/png, image/jpeg, image/gif"
                      />
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-semibold text-slate-500">Upload Photo</span>
                        {existingAvatar && (
                          <button
                            type="button"
                            onClick={() => setIsFileViewerOpen(true)}
                            className="text-[10px] text-[#2A174E] font-bold hover:underline"
                          >
                            View Full Photo
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Basic Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full md:w-3/4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">First Name <span className="text-red-500">*</span></Label>
                        <Input name="user_FirstName" value={formData.user_FirstName} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E]"/>
                        {renderError("user_FirstName")}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Middle Name</Label>
                        <Input name="user_MiddleName" placeholder="Optional" value={formData.user_MiddleName} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E]"/>
                        {renderError("user_MiddleName")}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Name <span className="text-red-500">*</span></Label>
                        <Input name="user_LastName" value={formData.user_LastName} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E]"/>
                        {renderError("user_LastName")}
                      </div>
                      <div className="space-y-2 sm:col-span-1">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address <span className="text-red-500">*</span></Label>
                        <Input name="user_Email" type="email" value={formData.user_Email} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E]"/>
                        {renderError("user_Email")}
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number <span className="text-red-500">*</span></Label>
                        <Input name="user_Phone" value={formData.user_Phone} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E]"/>
                        {renderError("user_Phone")}
                      </div>
                      <div className="space-y-2 sm:col-span-3">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Home Address</Label>
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
                      <div className="space-y-2 flex items-center gap-3 pt-4 sm:col-span-3">
                        <input 
                          type="checkbox" 
                          id="is_solo_parent" 
                          checked={formData.is_solo_parent} 
                          onChange={(e) => handleSelectChange("is_solo_parent", e.target.checked)}
                          className="h-4 w-4 text-[#2A174E] focus:ring-[#2A174E] border-gray-300 rounded cursor-pointer"
                        />
                        <Label htmlFor="is_solo_parent" className="text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer">Solo Parent</Label>
                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>

              {/* Bank Details (Visible to everyone in Personal Tab if non-master, otherwise in Comp tab) */}
              {!isMaster && (
                <Card className="shadow-sm border-0 bg-white">
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <CardTitle className="text-lg text-[#2A174E]">Bank Details</CardTitle>
                    <CardDescription>Payout information.</CardDescription>
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
                      <Input name="bank_AccountName" placeholder="Juan Dela Cruz" value={formData.bank_AccountName} onChange={handleChange} className="border-slate-200 focus-visible:ring-[#2A174E]" />
                      {renderError("bank_AccountName")}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Account Number <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Input name="account_Number" type={showAccountNumber ? "text" : "password"} placeholder="e.g. 00123456789" value={formData.account_Number} onChange={handleChange} className="pr-10 border-slate-200 focus-visible:ring-[#2A174E] font-mono" />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setShowAccountNumber(!showAccountNumber)}>
                          {showAccountNumber ? <VisibilityOffIcon fontSize="small"/> : <VisibilityIcon fontSize="small"/>}
                        </div>
                      </div>
                      {renderError("account_Number")}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
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
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Role <span className="text-red-500">*</span></Label>
                      {!isAdmin && isTargetAdminManager && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                          Read-only
                        </span>
                      )}
                    </div>
                    {!isAdmin && isTargetAdminManager ? (
                      <Input
                        value={formData.user_Role}
                        readOnly
                        disabled
                        className="border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed opacity-90 font-medium"
                      />
                    ) : (
                      <Select value={formData.user_Role} onValueChange={(val) => handleSelectChange("user_Role", val)}>
                        <SelectTrigger className="border-slate-200 focus-visible:ring-[#2A174E]">
                          <SelectValue placeholder="Select Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Employee">Employee</SelectItem>
                          <SelectItem value="Supervisor">Supervisor</SelectItem>
                          {isAdmin && <SelectItem value="Admin Manager">Admin Manager</SelectItem>}
                          <SelectItem value="Admin Accountant">Admin Accountant</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
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
                  {/* Department & Position Section */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department <span className="text-red-500">*</span></Label>
                    <Select 
                      value={formData.department || ""} 
                      onValueChange={(val) => {
                        setFormData(prev => ({ ...prev, department: val, position: "", position_id: "" }));
                      }}
                    >
                      <SelectTrigger className="border-slate-200 focus-visible:ring-[#2A174E]">
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(positions) && [...new Set([
                          ...(formData.department ? [formData.department] : []),
                          ...positions.map(p => p.department)
                        ])].filter(Boolean).map((dept) => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Position <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.position_id ? formData.position_id.toString() : ""}
                      onValueChange={(val) => {
                        const selectedPos = Array.isArray(positions) ? positions.find(p => p.positionId.toString() === val) : null;
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
                        {formData.department && Array.isArray(positions) && positions
                          .filter(p => p.department === formData.department)
                          .map((pos) => (
                            <SelectItem key={pos.positionId} value={pos.positionId.toString()}>{pos.title}</SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Hired: Editable by Admin Manager (1), Read-only for Supervisor (2) & Accountant (4) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date Hired</Label>
                      {!isAdmin && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                          Read-only
                        </span>
                      )}
                    </div>
                    {isAdmin ? (
                      <Input 
                        name="hireDate" 
                        type="date" 
                        value={formData.hireDate} 
                        onChange={handleChange} 
                        className="border-slate-200 focus-visible:ring-[#2A174E]"
                      />
                    ) : (
                      <Input 
                        name="hireDate" 
                        type="date" 
                        value={formData.hireDate} 
                        readOnly 
                        disabled 
                        className="border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed opacity-90 font-medium"
                      />
                    )}
                  </div>

                  {/* Tax Status */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tax Status</Label>
                    <Select value={formData.taxStatus} onValueChange={(val) => handleSelectChange("taxStatus", val)}>
                      <SelectTrigger className="border-slate-200 focus-visible:ring-[#2A174E]">
                        <SelectValue placeholder="Select Tax Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="S">Single (S)</SelectItem>
                        <SelectItem value="ME">Married / Head of Family (ME)</SelectItem>
                        <SelectItem value="Z">Zero Exemption (Z)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Attendance Time Exemption: Visible to Admin Manager (Role 1) ONLY, Hidden to Supervisor & Accountant */}
                  {isAdmin && (
                    <div className="space-y-2 sm:col-span-3 bg-purple-50/70 p-4 rounded-xl border border-purple-100 flex items-center justify-between mt-1">
                      <div>
                        <Label htmlFor="is_time_exempt" className="text-sm font-bold text-[#2A174E] cursor-pointer">
                          Attendance Time Exemption
                        </Label>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Exempt this employee from mandatory RFID attendance tracking (for executives & field personnel).
                        </p>
                      </div>
                      <Switch
                        id="is_time_exempt"
                        checked={Boolean(formData.is_time_exempt)}
                        onCheckedChange={(checked) => handleSelectChange("is_time_exempt", checked)}
                      />
                    </div>
                  )}

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
                    {formData.user_Password && formData.user_Password.trim() !== "" && (
                      <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                        <p className="text-slate-500 font-medium text-[11px] mb-1">Password Requirements:</p>
                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                          <span className={`flex items-center gap-1 ${formData.user_Password?.length >= 8 ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                            <span>{formData.user_Password?.length >= 8 ? "✓" : "○"}</span> At least 8 characters
                          </span>
                          <span className={`flex items-center gap-1 ${/[A-Z]/.test(formData.user_Password || "") ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                            <span>{/[A-Z]/.test(formData.user_Password || "") ? "✓" : "○"}</span> Uppercase (A-Z)
                          </span>
                          <span className={`flex items-center gap-1 ${/[a-z]/.test(formData.user_Password || "") ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                            <span>{/[a-z]/.test(formData.user_Password || "") ? "✓" : "○"}</span> Lowercase (a-z)
                          </span>
                          <span className={`flex items-center gap-1 ${/[0-9]/.test(formData.user_Password || "") ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                            <span>{/[0-9]/.test(formData.user_Password || "") ? "✓" : "○"}</span> Number (0-9)
                          </span>
                          <span className={`flex items-center gap-1 col-span-2 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.user_Password || "") ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                            <span>{/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.user_Password || "") ? "✓" : "○"}</span> Special character (!@#$%^&*)
                          </span>
                        </div>
                      </div>
                    )}
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
              <DialogTitle className="text-xl font-bold text-[#2A174E]">Verify Role Elevation</DialogTitle>
              <DialogDescription className="text-slate-500 mt-2 leading-relaxed">
                You are about to assign this user to <b>{formData.user_Role}</b>. This grants elevated administrative access. Please enter your account password to verify this action.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Your Password</Label>
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

      <FileViewerModal
        isOpen={isFileViewerOpen}
        onClose={() => setIsFileViewerOpen(false)}
        fileUrl={existingAvatar}
        fileName={`${formData.user_FirstName} ${formData.user_LastName} Profile Photo`}
      />

      <ImageCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        imageSrc={tempImageSrc}
        onCropComplete={(croppedBlob) => {
          setFile(croppedBlob);
        }}
      />

      </Sidebar>
    </div>
  );
};

export default Edit;