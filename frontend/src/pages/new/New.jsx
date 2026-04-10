import "./new.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom"; // 1. Import the hook
import Toast from "../../components/toast/Toast";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import RfidScanModal from "../../components/rfidScanModal/RfidScanModal";

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
    user_RoleId: 3,
  });

  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ message: "", type: "success" });

  const dismissToast = useCallback(() => setToast({ message: "", type: "success" }), []);

  useEffect(() => {
    const fetchNextId = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/users/nextId");
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
    setFormData((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const handleScanRFID = async () => {
    // 1. Open the modal immediately
    setShowRfidModal(true); 
    setFormData(prev => ({ ...prev, user_MachipId: "" }));
    setRfidError("");

    try {
      const response = await fetch("http://localhost:4000/api/users/generateRfid");
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
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setToast({ message: "Check required fields.", type: "error" });
      return;
    }

    const data = new FormData();
    // Append all fields from formData
    Object.keys(formData).forEach((key) => {
      data.append(key, formData[key]);
    });
    
    // Map Employment Status to ID if necessary (assuming 1 for Employee)
    if (formData.user_EmploymentStatus === "Employee") {
      data.append("user_EmploymentStatusId", 1);
    }

    // Append the file if it exists
    if (file) {
      data.append("user_ProfilePic", file);
    }

    try {
      const response = await fetch("http://localhost:4000/api/users/registerUser", {
        method: "POST",
        body: data, // Sending FormData automatically sets multipart/form-data
      });

      if (response.ok) {
        setToast({ message: "User added successfully!", type: "success" });

        setTimeout(() => {
          navigate("/users"); // Redirects to the User List page
        }, 1100);
        // Optional: Reset form or redirect
        setFormData({
          user_Id: "",
          user_FirstName: "",
          user_LastName: "",
          user_MiddleName: "",
          user_EmploymentStatus: "Employee",
          user_Email: "",
          user_Password: "",
          user_MachipId: "",
          user_RoleId: 3,
        });
        setFile("");
        // Re-fetch next ID
        const nextIdResponse = await fetch("http://localhost:4000/api/users/nextId");
        if (nextIdResponse.ok) {
          const nextIdData = await nextIdResponse.json();
          setFormData((prev) => ({ ...prev, user_Id: nextIdData.nextId }));
          setDisplayId(nextIdData.displayId);
        }
      } else {
        const errorData = await response.json();
        setToast({ message: errorData.error || "Failed to add user.", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Something went wrong.", type: "error" });
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
                      <input
                        id={input.id} type={input.type} placeholder={input.placeholder}
                        value={input.id === "user_Id" ? displayId : formData[input.id]}
                        onChange={handleInput} readOnly={input.label === "User ID" || input.label === "MaChip ID"}
                      />
                    )}
                    {input.label === "MaChip ID" && <button type="button" className="scanBtn" onClick={handleScanRFID}>SCAN</button>}

                  </div>
                </div>
              ))}
            </form>
            </div>
            </div>
            <div className="bottom-center">
            <button className="cancelButton" onClick={() => navigate("/users")}>Cancel</button>
            <button className="submitButton" onClick={handleSubmit}>Add User</button>
          </div>
        </div>
        <RfidScanModal 
          isOpen={showRfidModal} 
          onClose={() => setShowRfidModal(false)}
          onRescan={handleScanRFID}
          scannedId={formData.user_MachipId} 
          error={rfidError}
        />
      </div>
    );
  };

export default New;