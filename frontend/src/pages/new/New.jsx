import "./new.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useEffect, useState, useCallback } from "react";
import Toast from "../../components/toast/Toast";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";

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
  if (!formData.user_MachipId.trim()) errors.user_MachipId = "Scan required.";
  return errors;
};

const New = ({ inputs, title }) => {
  const [file, setFile] = useState("");
  const [displayId, setDisplayId] = useState("");
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
    try {
      const response = await fetch("http://localhost:4000/api/users/generateRfid");
      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({ ...prev, user_MachipId: data.rfid }));
        setToast({ message: "MaChip scanned!", type: "success" });
      }
    } catch (err) { console.error(err); }
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
          <div className="left">
            <img src={file ? URL.createObjectURL(file) : "https://icon-library.com/images/no-image-icon/no-image-icon-0.jpg"} alt="" />
            <div className="fileInput">
              <label htmlFor="file">Upload Photo <DriveFolderUploadOutlinedIcon /></label>
              <input type="file" id="file" onChange={(e) => setFile(e.target.files[0])} style={{ display: "none" }} />
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
                      <select id={input.id} value={formData[input.id]} onChange={handleInput}>
                        {input.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
          <button className="submitButton" onClick={handleSubmit}>Add User</button>
        </div>
      </div>
    </div>
  );
};

export default New;