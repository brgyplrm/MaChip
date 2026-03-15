import React, { useState, useEffect } from "react";
import "./userRequests.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import SendIcon from "@mui/icons-material/Send";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Toast from "../../components/toast/Toast";

const UserRequests = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [activeTab, setActiveTab] = useState("submit"); // 'submit' or 'history'
  const [toast, setToast] = useState({ message: "", type: "success" });

  const [formData, setFormData] = useState({
    user_Id: userData?.user_Id || "",
    emp_reqTypeId: "",
    remarks: "",
    leaveStartDate: "",
    leaveEndDate: "",
    noDays: 0,
    isWithPay: false,
    proofFile: null,
  });

  // Automated Day Calculation
  useEffect(() => {
    if (formData.leaveStartDate && formData.leaveEndDate) {
      const start = new Date(formData.leaveStartDate);
      const end = new Date(formData.leaveEndDate);
      const diffTime = end - start;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      setFormData((prev) => ({
        ...prev,
        noDays: diffDays > 0 ? diffDays : 0,
      }));
    }
  }, [formData.leaveStartDate, formData.leaveEndDate]);

  // Mock data for history 
  const historyRequests = [
    { id: 1, type: "VL", title: "Family Vacation Trip", dates: "Jan 12 - Jan 13, 2024", days: 2, status: "approved" },
    { id: 2, type: "SL", title: "Medical Checkup", dates: "Jan 15, 2024", days: 1, status: "rejected" },
    { id: 3, type: "VL", title: "Wedding Anniversary", dates: "Feb 01 - Feb 03, 2024", days: 3, status: "pending" }
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "file" ? files[0] : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Implementation for multipart/form-data submission would go here
    setToast({ message: "Request submitted successfully!", type: "success" });
  };

  return (
    <div className="home requestsPage">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="requestsWrapper">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
          
          <div className="tabHeader">
            <button 
              className={`tabBtn ${activeTab === "submit" ? "active" : ""}`} 
              onClick={() => setActiveTab("submit")}
            >
              <SendIcon className="icon"/> Submit Request
            </button>
            <button 
              className={`tabBtn ${activeTab === "history" ? "active" : ""}`} 
              onClick={() => setActiveTab("history")}
            >
              <HistoryIcon className="icon"/> Request History
            </button>
          </div>

          <div className="contentSection">
            {activeTab === "submit" ? (
              <div className="requestCard">
                <h2 className="cardTitle">Submit New Report Request</h2>
                <form onSubmit={handleSubmit}>
                  <div className="formGroup">
                    <label>Request Type</label>
                    <select name="emp_reqTypeId" value={formData.emp_reqTypeId} onChange={handleInputChange} required>
                      <option value="" disabled>Select request type</option>
                      <option value="1">Vacation Leave (VL)</option>
                      <option value="2">Sick Leave (SL)</option>
                      <option value="3">Other Report</option>
                    </select>
                  </div>

                  {/* Conditional Fields for Leave (Types 1 and 2) */}
                  {(formData.emp_reqTypeId === "1" || formData.emp_reqTypeId === "2") && (
                    <div className="conditionalFields">
                      <div className="formRow">
                        <div className="formGroup">
                          <label>Start Date</label>
                          <input type="date" name="leaveStartDate" value={formData.leaveStartDate} onChange={handleInputChange} required />
                        </div>
                        <div className="formGroup">
                          <label>End Date</label>
                          <input type="date" name="leaveEndDate" value={formData.leaveEndDate} onChange={handleInputChange} required />
                        </div>
                      </div>
                      
                      <div className="formRow">
                        <div className="formGroup">
                          <label>Number of Days</label>
                          <input type="number" name="noDays" value={formData.noDays} readOnly className="readOnlyInput" />
                        </div>
                        
                        {formData.emp_reqTypeId === "1" && (
                          <div className="formGroup checkboxGroup">
                            <input type="checkbox" id="isWithPay" name="isWithPay" checked={formData.isWithPay} onChange={handleInputChange} />
                            <label htmlFor="isWithPay">With Pay</label>
                          </div>
                        )}

                        {formData.emp_reqTypeId === "2" && (
                          <div className="formGroup fileUploadGroup">
                            <label className="fileLabel" htmlFor="proofFile">
                              <CloudUploadIcon /> {formData.proofFile ? formData.proofFile.name : "Upload Medical Certificate"}
                            </label>
                            <input type="file" id="proofFile" name="proofFile" onChange={handleInputChange} style={{ display: 'none' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="formGroup">
                    <label>Description / Purpose</label>
                    <textarea 
                      name="remarks"
                      placeholder="Please provide details..."
                      value={formData.remarks}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <button type="submit" className="submitBtn">Submit Request</button>
                </form>
              </div>
            ) : (
              <div className="fullRequests">
                <h2 className="cardTitle">All My Requests</h2>
                <div className="requestsList">
                  {historyRequests.map(req => (
                    <div className={`leaveLog ${req.status}`} key={req.id}>
                      {req.status === 'approved' && <CheckCircleIcon className="statusIcon approved" />}
                      {req.status === 'rejected' && <CancelIcon className="statusIcon rejected" />}
                      {req.status === 'pending' && <HourglassEmptyIcon className="statusIcon pending" />}
                      <div className="typeBadge">{req.type}</div>
                      <div className="text">
                        <p className="date">{req.dates}</p>
                        <p className="desc">{req.title} • {req.days} Day(s)</p>
                      </div>
                      <span className={`badge ${req.status}`}>{req.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserRequests;