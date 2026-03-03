import "./editUser.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";

// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[a-zA-Z\s]+$/;

const validateForm = (formData) => {
  const errors = {};

  if (!formData.user_Username || !formData.user_Username.trim()) {
    errors.user_Username = "Username is required.";
  } else if (formData.user_Username.trim().length < 3) {
    errors.user_Username = "Username must be at least 3 characters.";
  }

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
  const [formData, setFormData] = useState({});
  const [showPassword, setShowPassword] = useState(false);

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

    // 2. Submit
    try {
      const response = await fetch(
        `http://localhost:4000/api/users/updateUser/${userId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        },
      );

      if (response.ok) {
        setToast({
          message: "User profile updated successfully!",
          type: "success",
        });
        // Clear the password field after a successful update
        setFormData((prev) => ({ ...prev, user_Password: "" }));
        setErrors({});
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
    <div className="new">
      {/* ── Toast ── */}
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />

      <Sidebar />
      <div className="newContainer">
        <Navbar />
        <div className="top">
          <h1>
            {title} ({formatUserId(userId)})
          </h1>
        </div>

        <div className="bottom">
          <div className="right">
            <form onSubmit={handleUpdate} noValidate>
              {inputs.map((input) => (
                <div
                  className={`formInput${errors[input.id] ? " formInput--error" : ""}`}
                  key={input.id}
                >
                  <label htmlFor={input.id}>
                    {input.label}
                    {/* Required indicator — skip for optional fields */}
                    {input.id !== "user_MiddleName" &&
                      input.label !== "User ID" && (
                        <span className="requiredMark"> *</span>
                      )}
                    {/* Password is optional on edit */}
                    {input.id === "user_Password" && (
                      <span className="optionalMark"> (optional)</span>
                    )}
                  </label>

                  <div className="inputActionWrapper">
                    <input
                      id={input.id}
                      type={
                        input.id === "user_Password" && showPassword
                          ? "text"
                          : input.type
                      }
                      placeholder={input.placeholder}
                      value={
                        input.id === "user_Id"
                          ? formatUserId(formData[input.id])
                          : formData[input.id] || ""
                      }
                      onChange={handleInput}
                      readOnly={
                        input.label === "User ID" || input.label === "MaChip ID"
                      }
                      autoComplete={
                        input.id === "user_Password" ? "new-password" : "off"
                      }
                    />

                    {/* Password visibility toggle */}
                    {input.id === "user_Password" && (
                      <button
                        type="button"
                        className="visibilityToggle"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <VisibilityOffIcon fontSize="small" />
                        ) : (
                          <VisibilityIcon fontSize="small" />
                        )}
                      </button>
                    )}

                    {/* Re-scan button for MaChip ID */}
                    {input.label === "MaChip ID" && (
                      <button
                        type="button"
                        className="scanButton"
                        onClick={handleScanRFID}
                      >
                        RE-SCAN
                      </button>
                    )}
                  </div>

                  {/* Inline field error message */}
                  {errors[input.id] && (
                    <span className="fieldError">{errors[input.id]}</span>
                  )}
                </div>
              ))}

              <button className="submitButton" type="submit">
                Update Profile
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Edit;
