import "./editUser.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";

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

  if (!formData.user_MachipId || !formData.user_MachipId.trim()) {
    errors.user_MachipId = "MaChip ID is required. Please scan the chip.";
  }

  return errors;
};

// ─────────────────────────────────────────────────────────────────────────────

const Edit = ({ inputs, title }) => {
  const [file, setFile] = useState("");
  const [formData, setFormData] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [displayPic, setDisplayPic] = useState("");

  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1;

  // field-level error messages
  const [errors, setErrors] = useState({});

  // toast notification: { message, type }
  const [toast, setToast] = useState({ message: "", type: "success" });

  const { userId } = useParams();

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
  );

  // Clear a single field error when the user edits it
  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: "" }));

  // Fetch existing user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch(
          `http://localhost:4000/api/users/${userId}`,
        );
        if (response.ok) {
          const data = await response.json();
          // Keep password blank so the user must intentionally re-enter it
          const { user_Password, ...otherData } = data;
          setFormData(otherData);
          if (data.user_ProfilePic) {
            setDisplayPic(`http://localhost:4000/uploads/${data.user_ProfilePic}`);
          }
        } else {
          setToast({
            message: "Failed to load user data. Please refresh.",
            type: "error",
          });
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        setToast({
          message: "Could not connect to the server while loading user data.",
          type: "error",
        });
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
    try {
      const response = await fetch(
        "http://localhost:4000/api/users/generateRfid",
      );
      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({ ...prev, user_MachipId: data.rfid }));
        clearError("user_MachipId");
        setToast({
          message: `New MaChip scanned! ID updated to: ${data.rfid}`,
          type: "success",
        });
      } else {
        setToast({
          message: "Failed to scan RFID. Please try again.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error scanning RFID:", err);
      setToast({
        message: "An error occurred while scanning the chip.",
        type: "error",
      });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    // 1. Validate
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setToast({
        message: "Please fix the highlighted errors before saving.",
        type: "error",
      });
      return;
    }

    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      if (formData[key] !== null && formData[key] !== undefined) {
        data.append(key, formData[key]);
      }
    });

    if (file) {
      data.append("user_ProfilePic", file);
    }

    // 2. Submit
    try {
      const response = await fetch(
        `http://localhost:4000/api/users/updateUser/${userId}`,
        {
          method: "PUT",
          body: data,
        },
      );

      if (response.ok) {
        const result = await response.json();
        setToast({
          message: "User profile updated successfully!",
          type: "success",
        });
        // Update display pic if changed
        if (result.data && result.data.user_ProfilePic) {
          setDisplayPic(`http://localhost:4000/uploads/${result.data.user_ProfilePic}`);
        }
        // Clear the password field after a successful update
        setFormData((prev) => ({ ...prev, user_Password: "" }));
        setErrors({});
        setFile("");
      } else {
        const errorData = await response.json().catch(() => ({}));
        setToast({
          message: "Failed to update: " + (errorData.error || "Unknown error."),
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error updating user:", err);
      setToast({
        message: "Could not connect to the server. Please try again.",
        type: "error",
      });
    }
  };

 return (
  <div className="new"> {/* Reusing the 'new' class for layout consistency */}
    <Sidebar />
    <div className="newContainer">
      <Navbar />
      <div className="top">
        <h1>{title} (ID: {userId})</h1>
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
                      ? `http://localhost:4000/uploads/${formData.user_ProfilePic}`
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
                  onChange={(e) => setFile(e.target.files[0])}
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
              // If not admin, hide these specific administrative fields
              if (!isAdmin) {
                return !["user_EmploymentStatus", "user_Role", "user_MachipId"].includes(input.id);
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
                                      <option value="Admin">Admin</option>
                                    </>
                                  )}
                    </select>
                  ) : (
                    <>
                      <input
                        id={input.id}
                        type={input.id === "user_Password" && showPassword ? "text" : input.type}
                        value={formData[input.id] || ""}
                        onChange={handleInput}
                        readOnly={input.label === "User ID"} // User ID remains read-only for everyone
                      />
                      {input.id === "user_Password" && (
                                <div className="eyeIcon" onClick={() => setShowPassword(!showPassword)}>
                                  {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
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
                </div>
              </div>
          ))}
          </form>
        </div>
      </div>
      {/* Bottom Center: Action Button */}
      <div className="bottom-center">
        <button className="submitButton" onClick={handleUpdate}>
          Update Profile
        </button>
      </div>
    </div>
  </div>
);
};

export default Edit;
