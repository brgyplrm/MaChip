import "./new.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useEffect, useState, useCallback } from "react";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";

// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[a-zA-Z\s]+$/;

const validateForm = (formData) => {
  const errors = {};

  if (!formData.user_Username.trim()) {
    errors.user_Username = "Username is required.";
  } else if (formData.user_Username.trim().length < 3) {
    errors.user_Username = "Username must be at least 3 characters.";
  }

  if (!formData.user_FirstName.trim()) {
    errors.user_FirstName = "First name is required.";
  } else if (!nameRegex.test(formData.user_FirstName)) {
    errors.user_FirstName =
      "First Name cannot contain numbers or special characters";
  }

  if (!formData.user_LastName.trim()) {
    errors.user_LastName = "Last name is required.";
  } else if (!nameRegex.test(formData.user_LastName)) {
    errors.user_LastName =
      "Last Name cannot contain numbers or speical characters";
  }

  if (!nameRegex.test(formData.user_MiddleName)) {
    errors.user_MiddleName =
      "Middle Name cannot contain numbers or speical characters";
  }

  if (!formData.user_Email.trim()) {
    errors.user_Email = "Email is required.";
  } else if (!EMAIL_REGEX.test(formData.user_Email.trim())) {
    errors.user_Email = "Please enter a valid email address.";
  }

  if (!formData.user_Password) {
    errors.user_Password = "Password is required.";
  } else if (formData.user_Password.length < 6) {
    errors.user_Password = "Password must be at least 6 characters.";
  }

  if (!formData.user_MachipId.trim()) {
    errors.user_MachipId = "MaChip ID is required. Please scan the chip.";
  }

  return errors;
};

// ─────────────────────────────────────────────────────────────────────────────

const New = ({ inputs, title }) => {
  const [file, setFile] = useState("");
  // user_Id stores the raw numeric value (e.g. 1), display uses formatUserId
  const [displayId, setDisplayId] = useState("");
  const [formData, setFormData] = useState({
    user_Id: "",
    user_Username: "",
    user_FirstName: "",
    user_LastName: "",
    user_MiddleName: "",
    user_Email: "",
    user_Password: "",
    user_MachipId: "",
    user_Role: "Employee",
  });

  // field-level errors
  const [errors, setErrors] = useState({});

  // toast notification: { message, type }
  const [toast, setToast] = useState({ message: "", type: "success" });

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
  );

  // Clear a single field error when the user edits it
  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: "" }));

  useEffect(() => {
    const fetchNextId = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/users/nextId");
        if (response.ok) {
          const data = await response.json();
          // nextId is the raw number; displayId is the formatted "MACJ-XXX" string
          setFormData((prev) => ({ ...prev, user_Id: data.nextId }));
          setDisplayId(data.displayId);
        }
      } catch (err) {
        console.error("Failed to fetch next ID:", err);
      }
    };
    fetchNextId();
  }, []);

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
          message: `MaChip scanned successfully! ID: ${data.rfid}`,
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validate
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setToast({
        message: "Please fill in all required fields correctly.",
        type: "error",
      });
      return;
    }

    // 2. Submit
    try {
      const response = await fetch(
        "http://localhost:4000/api/users/registerUser",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        },
      );

      if (response.ok) {
        setToast({
          message: "User added successfully!",
          type: "success",
        });
        // Refresh auto-generated ID and reset form
        const nextIdRes = await fetch("http://localhost:4000/api/users/nextId");
        const nextIdData = nextIdRes.ok ? await nextIdRes.json() : {};
        setDisplayId(nextIdData.displayId || "");
        setFormData({
          user_Id: nextIdData.nextId || "",
          user_Username: "",
          user_FirstName: "",
          user_LastName: "",
          user_MiddleName: "",
          user_Email: "",
          user_Password: "",
          user_MachipId: "",
          user_Role: "Employee",
        });
        setErrors({});
      } else {
        const errorData = await response.json().catch(() => ({}));
        setToast({
          message:
            "Failed to add user: " + (errorData.error || "Unknown error."),
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error submitting form:", err);
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
          <h1>{title}</h1>
        </div>

        <div className="bottom">
          <div className="right">
            <form onSubmit={handleSubmit} noValidate>
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
                  </label>

                  <div className="inputActionWrapper">
                    <input
                      id={input.id}
                      type={input.type}
                      placeholder={input.placeholder}
                      value={
                        input.id === "user_Id"
                          ? displayId
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

                    {/* Scan button for MaChip ID */}
                    {input.label === "MaChip ID" && (
                      <button
                        type="button"
                        className="scanButton"
                        onClick={handleScanRFID}
                      >
                        SCAN
                      </button>
                    )}
                  </div>

                  {/* Inline error message */}
                  {errors[input.id] && (
                    <span className="fieldError">{errors[input.id]}</span>
                  )}
                </div>
              ))}
            </form>
          </div>

          <div className="bottom-center">
            <button
              className="submitButton"
              type="button"
              onClick={handleSubmit}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default New;
