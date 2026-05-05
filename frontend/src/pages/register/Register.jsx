import { useState, useEffect } from 'react';
import { formatUserId } from '../../utils/formatUserId';
import { fetchWithAuth } from '../../utils/api';
import Sidebar from "../../components/Sidebar";
import Toast from "../../components/toast/Toast";
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
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/users/registerUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
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
    </div>
  );
}

export default Register;
