import { useState, useEffect } from 'react';
import { formatUserId } from '../../utils/formatUserId';
import { fetchWithAuth } from '../../utils/api';
import Sidebar from "../../components/Sidebar";
import Toast from "../../components/toast/Toast";
import ImageCropperModal from "../../components/ImageCropperModal";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import "./register.scss";

function Register() {
  const [userData, setUserData] = useState({
    user_Id: '',
    user_FirstName: '',
    user_LastName: '',
    user_MiddleName: '',
    user_Email: '',
    user_Password: '',
    user_MachipId: '',
    user_RoleId: '2' // 2 for Employee, 1 for Admin
  });

  const [file, setFile] = useState(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState(null);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const fetchNextId = async () => {
    try {
      const response = await fetchWithAuth('/api/users/nextId');
      if (response.ok) {
        const data = await response.json();
        setUserData(prev => ({ ...prev, user_Id: data.nextId }));
      }
    } catch (err) {
      console.error("Failed to fetch next ID:", err);
    }
  };

  useEffect(() => {
    fetchNextId();
  }, []);

  const handleChange = (e) => {
    setUserData({ ...userData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pwd = userData.user_Password || "";
    if (pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
      setToast({ 
        message: "Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.", 
        type: "error" 
      });
      return;
    }

    setLoading(true);
    try {
      const formDataToSend = new FormData();
      Object.keys(userData).forEach(key => {
        formDataToSend.append(key, userData[key]);
      });
      if (file) {
        formDataToSend.append("user_ProfilePic", file);
      }

      const response = await fetchWithAuth('/api/users/registerUser', {
        method: 'POST',
        body: formDataToSend
      });

      const data = await response.json();
      if (response.ok) {
        setToast({ message: "User Registered Successfully!", type: "success" });
        // Refresh the ID and clear form
        fetchNextId();
        setUserData({
          user_Id: '',
          user_FirstName: '',
          user_LastName: '',
          user_MiddleName: '',
          user_Email: '',
          user_Password: '',
          user_MachipId: '',
          user_RoleId: '2'
        });
        setFile(null);
      } else {
        setToast({ message: "Error: " + (data.error || "Registration failed"), type: "error" });
      }
    } catch (err) {
      setToast({ message: "Connection failed: " + err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex bg-[#fdfaf5] min-h-screen">
      <Sidebar />

      <div className="flex-1 min-w-0 pt-20">
        <div className="register-container">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
          
          <div className="register-card">
            <h3>Register New User</h3>
            <form onSubmit={handleSubmit}>
              
              <div className="profile-upload-section mb-6 flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm relative group bg-white flex items-center justify-center">
                  <img
                    src={file ? URL.createObjectURL(file) : "https://icon-library.com/images/no-image-icon/no-image-icon-0.jpg"}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
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
                      const reader = new FileReader();
                      reader.onload = () => {
                        setTempImageSrc(reader.result);
                        setIsCropperOpen(true);
                      };
                      reader.readAsDataURL(selectedFile);
                    }
                  }}
                  style={{ display: "none" }}
                  accept="image/*"
                />
                <span className="text-xs font-semibold text-slate-500">Profile Picture</span>
              </div>

              <div className="form-group">
                <label>User ID (Auto-generated)</label>
                <input 
                  type="text" 
                  value={formatUserId(userData.user_Id)} 
                  readOnly 
                  className="readonly"
                />
              </div>

              <div className="form-group">
                <label>First Name</label>
                <input type="text" id="user_FirstName" placeholder="Enter First Name" value={userData.user_FirstName} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label>Last Name</label>
                <input type="text" id="user_LastName" placeholder="Enter Last Name" value={userData.user_LastName} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label>Middle Name (Optional)</label>
                <input type="text" id="user_MiddleName" placeholder="Enter Middle Name" value={userData.user_MiddleName} onChange={handleChange} />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input type="email" id="user_Email" placeholder="Enter Email Address" value={userData.user_Email} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label>Temporary Password</label>
                <input type="password" id="user_Password" placeholder="Create a temporary password" value={userData.user_Password} onChange={handleChange} required />
                {userData.user_Password && (
                  <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-600">
                    <p className="font-semibold text-[11px] mb-1">Password Requirements:</p>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <span className={userData.user_Password.length >= 8 ? "text-emerald-600 font-medium" : "text-slate-400"}>
                        {userData.user_Password.length >= 8 ? "✓" : "○"} At least 8 characters
                      </span>
                      <span className={/[A-Z]/.test(userData.user_Password) ? "text-emerald-600 font-medium" : "text-slate-400"}>
                        {/[A-Z]/.test(userData.user_Password) ? "✓" : "○"} Uppercase (A-Z)
                      </span>
                      <span className={/[a-z]/.test(userData.user_Password) ? "text-emerald-600 font-medium" : "text-slate-400"}>
                        {/[a-z]/.test(userData.user_Password) ? "✓" : "○"} Lowercase (a-z)
                      </span>
                      <span className={/[0-9]/.test(userData.user_Password) ? "text-emerald-600 font-medium" : "text-slate-400"}>
                        {/[0-9]/.test(userData.user_Password) ? "✓" : "○"} Number (0-9)
                      </span>
                      <span className={`col-span-2 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(userData.user_Password) ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                        {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(userData.user_Password) ? "✓" : "○"} Special character (!@#$%^&*)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>MaChip ID (Optional)</label>
                <input type="text" id="user_MachipId" placeholder="Assign RFID/MaChip ID" value={userData.user_MachipId} onChange={handleChange} />
              </div>

              <div className="form-group">
                <label>User Role</label>
                <select id="user_RoleId" value={userData.user_RoleId} onChange={handleChange}>
                  <option value="2">Employee</option>
                  <option value="1">Admin</option>
                </select>
              </div>

              <button type="submit" className="register-btn" disabled={loading}>
                {loading ? "Registering..." : "Register User"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <ImageCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        imageSrc={tempImageSrc}
        onCropComplete={(croppedBlob) => {
          setFile(croppedBlob);
        }}
      />
    </div>
  );
}

export default Register;

