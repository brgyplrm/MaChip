import "./new.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom"; // 1. Import the hook
import Toast from "../../components/toast/Toast";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import RfidScanModal from "../../components/rfidScanModal/RfidScanModal";
import { fetchWithAuth } from "../../utils/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[a-zA-Z\s]+$/;

const validateForm = (formData) => {
  const errors = {};
  if (!formData.user_FirstName.trim()) errors.user_FirstName = "Required";
  if (!formData.user_LastName.trim()) errors.user_LastName = "Required";
  if (!formData.user_Email.trim()) {
    errors.user_Email = "Email is required.";
  } else if (!EMAIL_REGEX.test(formData.user_Email.trim())) {
    errors.user_Email = "Invalid email.";
  }
  if (!formData.user_Password || formData.user_Password.length < 6) {
    errors.user_Password = "Min 6 characters.";
  }
  return errors;
};

const New = ({ inputs, title }) => {
  const navigate = useNavigate();
  const [file, setFile] = useState("");
  const [displayId, setDisplayId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showRfidModal, setShowRfidModal] = useState(false);
  const [rfidError, setRfidError] = useState("");
  const [formData, setFormData] = useState({
    user_Id: "",
    user_FirstName: "",
    user_LastName: "",
    user_MiddleName: "",
    user_EmploymentStatus: "Employee",
    user_Email: "",
    user_Password: "",
    user_MachipId: "",
    user_FingerprintId: "",
    account_Number: "",
    user_RoleId: 3,
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const dismissToast = useCallback(() => setToast({ message: "", type: "success" }), []);

  const [showFingerprintModal, setShowFingerprintModal] = useState(false);
  const [fingerprintError, setFingerprintError] = useState("");

  const handleScanFingerprint = async () => {
    setShowFingerprintModal(true); 
    setFormData(prev => ({ ...prev, user_FingerprintId: "" }));
    setFingerprintError("");

    try {
      // Assuming you have a similar endpoint for fingerprint generation
      const response = await fetchWithAuth("/api/users/generateFingerprint");
      const data = await response.json();

      if (response.ok) {
        setFormData((prev) => ({ ...prev, user_FingerprintId: data.fingerprintId }));
        setToast({
          message: `Fingerprint registered: ${data.fingerprintId}`,
          type: "success",
        });
      } else {
        setFingerprintError(data.error || "Failed to scan fingerprint.");
        setToast({ message: data.error || "Scan failed.", type: "error" });
      }
    } catch (err) {
      setFingerprintError("An error occurred during scanning.");
      setToast({ message: "An error occurred.", type: "error" });
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
      
      // Handle manual User ID input
      if (id === "user_Id") {
        // Extract numbers from the input (handles both MACJ-001 and 1)
        const numericMatch = value.match(/\d+/);
        const numericId = numericMatch ? parseInt(numericMatch[0], 10) : "";
        updated.user_Id = numericId;
        // Keep the raw value for display during editing
        setDisplayId(value);
      }
      
      // Sync IDs when select values change
      if (id === "user_Role") {
        updated.user_RoleId = value === "Admin" ? 1 : value === "Staff" ? 2 : 3;
      }
      if (id === "user_EmploymentStatus") {
        updated.user_EmploymentStatusId = value === "Regular" ? 1 : value === "Part-time" ? 2 : 3;
      }
      
      return updated;
    });

    // If it was user_Id, we want to format it nicely when they blur, but let them type freely
    setErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const handleIdBlur = () => {
    if (formData.user_Id) {
      setDisplayId(`MACJ-${String(formData.user_Id).padStart(3, "0")}`);
    }
  };

  const handleScanRFID = async () => {
    // 1. Open the modal immediately
    setShowRfidModal(true); 
    setFormData(prev => ({ ...prev, user_MachipId: "" }));
    setRfidError("");

    try {
      const response = await fetchWithAuth("/api/users/generateRfid");
      const data = await response.json();

      if (response.ok) {
        // 2. Update the form data with the scanned ID
        setFormData((prev) => ({ ...prev, user_MachipId: data.rfid }));
        setToast({
          message: `New MaChip scanned: ${data.rfid}`,
          type: "success",
        });
      } else {
        setRfidError(data.error || "Failed to scan RFID. Please try again.");
        if (data.rfid) setFormData((prev) => ({ ...prev, user_MachipId: data.rfid }));
        setToast({ message: data.error || "Failed to scan RFID.", type: "error" });
      }
    } catch (err) {
      console.error("Error scanning RFID:", err);
      setRfidError("An error occurred while scanning.");
      setToast({ message: "An error occurred while scanning.", type: "error" });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setToast({ message: "Check required fields.", type: "error" });
      return;
    }

    setLoading(true);
    const data = new FormData();
    // Append all fields from formData
    Object.keys(formData).forEach((key) => {
      if (formData[key] !== undefined && formData[key] !== null) {
        data.append(key, formData[key]);
      }
    });
    
    // Ensure IDs are present even if selects weren't touched
    if (!formData.user_EmploymentStatusId) data.append("user_EmploymentStatusId", 1);
    if (!formData.user_RoleId) data.append("user_RoleId", 3);

    // Append the file if it exists
    if (file) {
      data.append("user_ProfilePic", file);
    }

    try {
      const response = await fetchWithAuth("/api/users/registerUser", {
        method: "POST",
        body: data,
      });

      if (response.ok) {
        setToast({ message: "User added successfully!", type: "success" });

        setTimeout(() => {
          navigate("/users");
        }, 1100);
      } else {
        const errorData = await response.json();
        setToast({ message: errorData.error || "Failed to add user.", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Something went wrong.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="new">
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      <Sidebar />
      <div className="newContainer">
        <Navbar />
        <div className="top"><h1>{title}</h1></div>
        <div className="bottom">
          <div className="leftIdentity">
            <div className="imageContainer">
              <img
                src={
                  file
                    ? URL.createObjectURL(file)
                    : formData.user_ProfilePic
                      ? `http://localhost:4000/uploads/${formData.user_ProfilePic}`
                      : "/avatar.webp"
                }
                alt="Profile Preview"
              />
              <div className="fileInput">
                <label htmlFor="file">
                  <DriveFolderUploadOutlinedIcon className="icon" /> <div className="fileInput-label">Image Upload</div>
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

            
            <div className="right">
            <form onSubmit={handleSubmit}>
              <div className="fullNameSection">
                <label>Full Name <span className="requiredMark">*</span></label>
                <div className="nameInputsRow">
                  <div className="nameGroup">
                    <input id="user_FirstName" placeholder="First Name" value={formData.user_FirstName} onChange={handleInput} />
                    {errors.user_FirstName && <span className="error">{errors.user_FirstName}</span>}
                  </div>
                  <div className="nameGroup">
                    <input id="user_MiddleName" placeholder="Middle Name" value={formData.user_MiddleName} onChange={handleInput} />
                  </div>
                  <div className="nameGroup">
                    <input id="user_LastName" placeholder="Last Name" value={formData.user_LastName} onChange={handleInput} />
                    {errors.user_LastName && <span className="error">{errors.user_LastName}</span>}
                  </div>
                </div>
              </div>

              {inputs.map((input) => (
                <div className="formInput" key={input.id}>
                  <label>{input.label}</label>
                  <div className="inputActionWrapper">
                    {input.type === "select" ? (
                      <select 
                        id={input.id} 
                        value={formData[input.id] || ""} 
                        onChange={handleInput}
                      >
                        <option value="" disabled>Select {input.label}</option>
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
                            <option value="Admin">Admin</option>
                          </>
                        )}
                      </select>
                    ) : (
                      <div style={{ width: "100%", position: "relative" }}>
                        <input
                          id={input.id} 
                          type={
                            (input.id === "user_Password" && showPassword) || 
                            (input.id === "account_Number" && showAccountNumber) 
                              ? "text" 
                              : input.type
                          } 
                          placeholder={input.placeholder}
                          value={input.id === "user_Id" ? displayId : formData[input.id]}
                          onChange={handleInput}
                          onBlur={input.id === "user_Id" ? handleIdBlur : undefined}
                          readOnly={input.label === "MaChip ID" || input.label === "Fingerprint ID"}
                        />
                        {input.id === "user_Password" && (
                          <div className="eyeIcon" style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", display: "flex", alignItems: "center", height: "100%", color: "gray" }} onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </div>
                        )}
                        {input.id === "account_Number" && (
                          <div className="eyeIcon" style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", display: "flex", alignItems: "center", height: "100%", color: "gray" }} onClick={() => setShowAccountNumber(!showAccountNumber)}>
                            {showAccountNumber ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </div>
                        )}
                        {errors[input.id] && <span className="error" style={{ color: "red", fontSize: "12px" }}>{errors[input.id]}</span>}
                      </div>
                    )}
                    {input.label === "MaChip ID" && (
                      <button type="button" className="scanBtn" onClick={handleScanRFID}>SCAN</button>
                      )}
                    {input.label === "Fingerprint ID" && (
                      <button type="button" className="scanBtn" onClick={handleScanFingerprint}>SCAN</button>
                    )}

                  </div>
                </div>
              ))}
            </form>
            </div>
            </div>
            <div className="bottom-center">
            <button className="cancelButton" onClick={() => navigate("/users")} disabled={loading}>Cancel</button>
            <button className="submitButton" onClick={handleSubmit} disabled={loading}>
              {loading ? "Adding..." : "Add User"}
            </button>
          </div>
        </div>
        <RfidScanModal 
          isOpen={showRfidModal} 
          onClose={() => setShowRfidModal(false)}
          onRescan={handleScanRFID}
          scannedId={formData.user_MachipId} 
          error={rfidError}
        />
        <RfidScanModal 
          isOpen={showFingerprintModal} 
          onClose={() => setShowFingerprintModal(false)}
          onRescan={handleScanFingerprint}
          scannedId={formData.user_FingerprintId} 
          error={fingerprintError}
          // You might want to pass a title prop if your modal supports it
          title="Fingerprint Scanner" 
        />
      </div>
    );
  };

export default New;