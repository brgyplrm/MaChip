import "./editUser.scss";
import Sidebar from "../../components/Sidebar";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import { useNavigate } from "react-router-dom";
import RfidScanModal from "../../components/rfidScanModal/RfidScanModal";
import { fetchWithAuth } from "../../utils/api";


// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[a-zA-Z\s]+$/;


const validateForm = (formData) => {
  const errors = {};

  if (!formData.user_FirstName || !formData.user_FirstName.trim()) {
    errors.user_FirstName = "First name is required.";
  } else if (!nameRegex.test(formData.user_FirstName)) {
    errors.user_FirstName =
      "First Name cannot contain numbers or special characters";
  }

  if (!formData.user_LastName || !formData.user_LastName.trim()) {
    errors.user_LastName = "Last name is required.";
  } else if (!nameRegex.test(formData.user_LastName)) {
    errors.user_LastName =
      "Last Name cannot contain numbers or special characters";
  }

  if (formData.user_MiddleName && formData.user_MiddleName.trim() !== "" && !nameRegex.test(formData.user_MiddleName)) {
    errors.user_MiddleName =
      "Middle Name cannot contain numbers or special characters";
  }

  if (!formData.user_Email || !formData.user_Email.trim()) {
    errors.user_Email = "Email is required.";
  } else if (!EMAIL_REGEX.test(formData.user_Email.trim())) {
    errors.user_Email = "Please enter a valid email address.";
  }

  // Password is optional on edit — only validate if the user typed something
  if (formData.user_Password && formData.user_Password.length < 6) {
    errors.user_Password = "New password must be at least 6 characters.";
  }

  return errors;
};

// ─────────────────────────────────────────────────────────────────────────────

const roleMap = { Employee: 3, Supervisor: 2, Admin: 1 };
const reverseRoleMap = { 3: "Employee", 2: "Supervisor", 1: "Admin" };
const statusMap = { Regular: 1, "Part-time": 2, "Intern / OJT": 3 };
const reverseStatusMap = { 1: "Regular", 2: "Part-time", 3: "Intern / OJT" };

const Edit = ({ inputs, title }) => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState("");
  const [formData, setFormData] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [displayPic, setDisplayPic] = useState("");
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [showRfidModal, setShowRfidModal] = useState(false);
  const [showFingerprintModal, setShowFingerprintModal] = useState(false);
  const [rfidError, setRfidError] = useState("");
  const [fingerprintError, setFingerprintError] = useState("");
  const [originalMachipId, setOriginalMachipId] = useState("");
  const [originalFingerprintId, setOriginalFingerprintId] = useState("");

  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ message: "", type: "success" });

  const currentUser = JSON.parse(localStorage.getItem("userData") || "null");
  const isAdmin = currentUser?.user_RoleId === 1;

  const dismissToast = useCallback(() => setToast({ message: "", type: "success" }), []);
  const clearError = (id) => setErrors((prev) => ({ ...prev, [id]: "" }));
  const handleCancel = () => navigate(-1);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetchWithAuth(`/api/users/${userId}`);
        if (response.ok) {
          const data = await response.json();
          const { user_Password, ...otherData } = data;
          
          setFormData({
            ...otherData,
            user_Role: reverseRoleMap[data.user_RoleId] || "Employee",
            user_EmploymentStatus: reverseStatusMap[data.user_EmploymentStatusId] || "Regular"
          });
          setOriginalMachipId(data.user_MachipId || "");
          setOriginalFingerprintId(data.user_FingerprintId || "");

          if (data.user_ProfilePic) {
            setDisplayPic(`/api/uploads/${data.user_ProfilePic}`);
          }
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };
    fetchUserData();
  }, [userId]);

  const handleInput = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    clearError(id);
  };

  const handleScanRFID = async () => {
    setShowRfidModal(true);
    setFormData((prev) => ({ ...prev, user_MachipId: "" }));
    setRfidError("");
    try {
      const response = await fetchWithAuth("/api/users/generateRfid");
      const data = await response.json();

      if (response.ok) {
        if (data.rfid === originalMachipId) {
          setRfidError("Same card used. Please try a different MaChip.");
          setFormData((prev) => ({ ...prev, user_MachipId: data.rfid }));
          setToast({
            message: "Same card used. Please try a different MaChip.",
            type: "error",
          });
        } else {
          setFormData((prev) => ({ ...prev, user_MachipId: data.rfid }));
          clearError("user_MachipId");
          setToast({
            message: `New MaChip scanned! ID updated to: ${data.rfid}`,
            type: "success",
          });
        }
      } else {
        setRfidError(data.error || "Failed to scan RFID. Please try again.");
        if (data.rfid) setFormData((prev) => ({ ...prev, user_MachipId: data.rfid }));
        setToast({
          message: data.error || "Failed to scan RFID.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error scanning RFID:", err);
      const isNetworkError = err instanceof TypeError || err.message === "NetworkError";
      setRfidError(isNetworkError ? "Connection lost or backend unreachable. Check your server." : "An error occurred while scanning.");
      setToast({
        message: isNetworkError ? "Connection error: Check if backend is running." : "An error occurred while scanning the chip.",
        type: "error",
      });
    }
  };

  const handleScanFingerprint = async () => {
    setShowFingerprintModal(true);
    setFormData((prev) => ({ ...prev, user_FingerprintId: "" }));
    setFingerprintError("");
    try {
      const response = await fetchWithAuth(`/api/users/generateFingerprint?userId=${userId}`);
      const data = await response.json();

      if (response.ok) {
        setFormData((prev) => ({ 
          ...prev, 
          user_FingerprintId: data.fingerprintId,
          user_FingerprintTemplate: data.template || "" 
        }));
        clearError("user_FingerprintId");
        setToast({
          message: `Fingerprint scanned! ID updated to slot: ${data.fingerprintId}`,
          type: "success",
        });
      } else {
        setFingerprintError(data.error || "Failed to scan Fingerprint. Please try again.");
        setToast({
          message: data.error || "Failed to scan Fingerprint.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error scanning Fingerprint:", err);
      setFingerprintError("An error occurred while scanning.");
      setToast({
        message: "An error occurred while scanning the fingerprint.",
        type: "error",
      });
    }
  };

  const handleUpdate = async (e) => {
    if (e) e.preventDefault();

    // 1. Check if promoting to Admin
    if (formData.user_Role === "Admin" && reverseRoleMap[formData.user_RoleId] !== "Admin" && !showAdminConfirm) {
      setShowAdminConfirm(true);
      return;
    }

    // 2. Validate
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setToast({ message: "Please fix the highlighted errors.", type: "error" });
      return;
    }

    const submissionData = new FormData();
    Object.keys(formData).forEach((key) => {
      // Exclude these because we map them manually below, or they are not needed in body
      if (["user_RoleId", "user_EmploymentStatusId", "user_Role", "user_EmploymentStatus"].includes(key)) return;
      
      if (formData[key] !== null && formData[key] !== undefined) {
        submissionData.append(key, formData[key]);
      }
    });

    // Map the string values to their numeric IDs for the backend
    submissionData.append("user_RoleId", roleMap[formData.user_Role] || 3);
    submissionData.append("user_EmploymentStatusId", statusMap[formData.user_EmploymentStatus] || 1);

    if (file) {
      submissionData.append("user_ProfilePic", file);
    }

    // If we're doing the admin password check
    if (showAdminConfirm) {
      submissionData.append("adminConfirmPassword", adminPassword);
    }

    const operatorId = currentUser?.user_Id || currentUser?.userId;
    console.log("[DEBUG] Sending update request:", {
      targetUserId: userId,
      operatorId,
      newRole: formData.user_Role,
      hasConfirmPass: !!adminPassword
    });

    try {
      const response = await fetchWithAuth(`/api/users/updateUser/${userId}`, {
        method: "PUT",
        body: submissionData,
      });

      if (response.ok) {
        setToast({ message: "User profile updated successfully!", type: "success" });
        setShowAdminConfirm(false);
        setAdminPassword("");

        // Refresh localStorage if updating own profile
        if (currentUser?.user_Id === parseInt(userId)) {
          const updatedRes = await fetchWithAuth(`/api/users/${userId}`);
          if (updatedRes.ok) {
            const updatedData = await updatedRes.json();
            const { user_Password, ...safeData } = updatedData;
            localStorage.setItem("userData", JSON.stringify(safeData));
            // Trigger custom event for Navbar to update immediately
            window.dispatchEvent(new Event("userUpdate"));
          }
        }
      } else {
        const errorData = await response.json();
        setToast({ message: errorData.error || "Failed to update.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Connection error.", type: "error" });
    }
  };

  const confirmAdminPromotion = () => {
    if (!adminPassword) {
      setToast({ message: "Please enter your password to confirm.", type: "error" });
      return;
    }
    handleUpdate();
  };

 return (
  <div className="new">
    <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
    <Sidebar>
    <div className="newContainer">
      <div className="top">
        <h1>{title} (ID: {formatUserId(userId)})</h1>
      </div>
      <div className="bottom">
        {/* Left Side: Profile Picture Preview */}

        <div className="leftIdentity">
            <div className="imageContainer">
              <img
                src={
                  file
                    ? URL.createObjectURL(file)
                    : formData.user_ProfilePic
                      ? `/api/uploads/${formData.user_ProfilePic}`
                      : "/avatar.webp"
                }
                alt="Profile Preview"
              />
              <div className="fileInput">
                <label htmlFor="file">
                  <DriveFolderUploadOutlinedIcon className="icon" /> <div className="fileInput-label">Edit Image:</div>
                </label>
                <input
                  type="file"
                  id="file"
                  onChange={(e) => {
                    const selectedFile = e.target.files[0];
                    if (selectedFile) {
                      const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
                      if (!allowedTypes.includes(selectedFile.type)) {
                        setToast({ 
                          message: "Invalid file format. Only png, jpg, and jpeg are allowed!", 
                          type: "error" 
                        });
                        e.target.value = null; // Clear input
                        return;
                      }
                      setFile(selectedFile);
                    }
                  }}
                  style={{ display: "none" }}
                />
              </div>
            </div>

            {/* Real-time Name Display */}
            <h1 className="userName">
              {formData.user_FirstName || "First"} {formData.user_LastName || "Last"}
            </h1>

            {/* Real-time Role Display */}
            <span className="userRole">
              {formData.user_Role || "Select Role"}
            </span>

            {/* Real-time Employment Status Badge */}
            <div className={`statusBadge ${formData.user_EmploymentStatus?.toLowerCase().replace(" ", "") || "regular"}`}>
              {formData.user_EmploymentStatus || "Regular"}
            </div>
          </div>

        {/* Right Side: Form Inputs */}
        <div className="right">
          <form onSubmit={handleUpdate}>
            <div className="fullNameSection">
            <label>
              Full Name <span className="requiredMark">*</span>
            </label>
            <div className="nameInputsRow">
              <div className="nameGroup">
                <input
                  type="text"
                  id="user_FirstName"
                  placeholder="First Name"
                  value={formData.user_FirstName || ""}
                  onChange={handleInput}
                />
                {errors.user_FirstName && <span className="error">{errors.user_FirstName}</span>}
              </div>
              {/* ADDED: Middle Name Column */}
              <div className="nameGroup">
                <input
                  type="text"
                  id="user_MiddleName"
                  placeholder="Middle Name"
                  value={formData.user_MiddleName || ""}
                  onChange={handleInput}
                />
              </div>
              <div className="nameGroup">
                <input
                  type="text"
                  id="user_LastName"
                  placeholder="Last Name"
                  value={formData.user_LastName || ""}
                  onChange={handleInput}
                />
                {errors.user_LastName && <span className="error">{errors.user_LastName}</span>}
              </div>
            </div>
          </div>

          {inputs
            .filter((input) => {
              // If not admin, hide administrative fields and password change option
              if (!isAdmin) {
                return !["user_EmploymentStatus", "user_Role", "user_MachipId", "user_Password"].includes(input.id);
              }
              return true;
            })
            .map((input) => (
              <div className="formInput" key={input.id}>
                <label>{input.label}</label>
                <div className="inputActionWrapper">
                          {/* Logic for Employment Status Dropdown */}
                  {input.type === "select" ? (
                    <select id={input.id} value={formData[input.id] || ""} onChange={handleInput}>
                      <option value="" disabled>Select {input.label}</option>
                                  {/* If you updated formSource, use input.options.map here */}
                                  {input.id === "user_EmploymentStatus" && (
                                    <>
                                      <option value="Regular">Regular</option>
                                      <option value="Part-time">Part-time</option>
                                      <option value="Intern / OJT">Intern / OJT</option>
                                    </>
                                  )}
                                  {input.id === "user_Role" && (
                                    <>
                                      <option value="Employee">Employee</option>
                                      <option value="Supervisor">Supervisor</option>
                                      <option value="Admin">Admin</option>
                                    </>
                                  )}
                    </select>
                  ) : (
                    <>
                      <input
                        id={input.id}
                        type={
                          (input.id === "user_Password" && showPassword) || 
                          (input.id === "account_Number" && showAccountNumber) 
                            ? "text" 
                            : input.type
                        }
                        value={formData[input.id] || ""}
                        onChange={handleInput}
                        readOnly={input.label === "User ID"} // User ID remains read-only for everyone
                      />
                      {input.id === "user_Password" && (
                                <div className="eyeIcon" onClick={() => setShowPassword(!showPassword)}>
                                  {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                </div>
                      )}
                      {input.id === "account_Number" && (
                                <div className="eyeIcon" onClick={() => setShowAccountNumber(!showAccountNumber)}>
                                  {showAccountNumber ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                </div>
                      )}
                    </>
                  )}

                  {/* Re-Scan button: Only visible to Admin */}
                  {isAdmin && input.label === "MaChip ID" && (
                    <button type="button" className="scanBtn" onClick={handleScanRFID}>
                      RE-SCAN
                    </button>
                  )}
                  {isAdmin && input.label === "Fingerprint ID" && (
                    <button type="button" className="scanBtn" onClick={handleScanFingerprint}>
                      RE-SCAN
                    </button>
                  )}
                </div>
              </div>
          ))}
          </form>
        </div>
      </div>
      {/* Bottom Center: Action Button */}
      <div className="bottom-center">
        <button className="cancelButton" onClick={handleCancel}>
          Cancel
        </button>
        <button className="submitButton" onClick={handleUpdate}>
          Update Profile
        </button>
      </div>
    </div>

    {/* Admin Confirmation Modal */}
    {showAdminConfirm && (
      <div className="adminConfirmOverlay">
        <div className="adminConfirmModal">
          <h2>Admin Promotion Required</h2>
          <p>You are about to promote this user to <b>Admin</b>. This grants full system access.</p>
          <p className="subtext">Please enter your current admin password to verify this action:</p>
          <input
            type="password"
            placeholder="Confirm Admin Password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="adminPassInput"
            autoFocus
          />
          <div className="modalButtons">
            <button className="cancel" onClick={() => { setShowAdminConfirm(false); setAdminPassword(""); }}>
              Cancel
            </button>
            <button className="confirm" onClick={confirmAdminPromotion}>
              Confirm Promotion
            </button>
          </div>
        </div>
        
      </div>
    )}

    <RfidScanModal 
      isOpen={showRfidModal} 
      onClose={() => setShowRfidModal(false)}
      onRescan={handleScanRFID}
      scannedId={formData.user_MachipId} 
      error={rfidError}
      currentId={originalMachipId}
    />
    <RfidScanModal 
      isOpen={showFingerprintModal} 
      onClose={() => setShowFingerprintModal(false)}
      onRescan={handleScanFingerprint}
      scannedId={formData.user_FingerprintId} 
      error={fingerprintError}
      currentId={originalFingerprintId}
      title="Fingerprint Scanner"
    />
    </Sidebar>
  </div>
);
};

export default Edit;
