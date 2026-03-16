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
import { Link } from "react-router-dom";

const UserRequests = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [activeTab, setActiveTab] = useState("submit"); // 'submit' or 'history'
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [historyRequests, setHistoryRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState({ VL_balance: 0, SL_balance: 0 });

  const [formData, setFormData] = useState({
    user_Id: userData?.user_Id || "",
    emp_reqTypeId: "",
    remarks: "",
    // Leave fields
    leaveStartDate: "",
    leaveEndDate: "",
    noDays: 0,
    // OT fields
    otDate: "",
    hrFrom: "",
    hrTo: "",
    // On-field fields
    fieldDate: "",
    fieldNoHrs: 0,
    destination: "",
    proofFile: null,
  });

  useEffect(() => {
  if (formData.hrFrom && formData.hrTo) {
    const start = new Date(`1970-01-01T${formData.hrFrom}`);
    const end = new Date(`1970-01-01T${formData.hrTo}`);
    let diff = (end - start) / (1000 * 60 * 60); // convert to hours
    setFormData(prev => ({ ...prev, fieldNoHrs: diff > 0 ? diff.toFixed(2) : 0 }));
  }
}, [formData.hrFrom, formData.hrTo]);

  // Fetch Balance
  const fetchBalance = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetch(`http://localhost:4000/api/request/balance/${userData.user_Id}`);
      if (response.ok) {
        const data = await response.json();
        setBalance(data);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  // Fetch History
  const fetchHistory = async () => {
    if (!userData?.user_Id) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:4000/api/request/${userData.user_Id}`);
      const data = await response.json();
      if (response.ok) {
        setHistoryRequests(data);
      } else {
        console.error("Failed to fetch history:", data.error);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [userData?.user_Id]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

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

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "file" ? files[0] : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check balance for warning
    let isInsufficient = false;
    if (formData.emp_reqTypeId === "3" && formData.noDays > balance.VL_balance) {
      isInsufficient = true;
    } else if (formData.emp_reqTypeId === "4" && formData.noDays > balance.SL_balance) {
      isInsufficient = true;
    }

    // Check VL 3-day filing rule
    let isLateFiling = false;
    if (formData.emp_reqTypeId === "3") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(formData.leaveStartDate);
      const diffTime = startDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 3) {
        isLateFiling = true;
      }
    }

    const formDataToSubmit = new FormData();
    formDataToSubmit.append("user_Id", userData.user_Id);
    formDataToSubmit.append("emp_reqTypeId", formData.emp_reqTypeId);
    formDataToSubmit.append("remarks", formData.remarks); // Used as fallback for purpose/reason
    formDataToSubmit.append("purpose", formData.remarks);
    formDataToSubmit.append("StartDate", formData.leaveStartDate);
    formDataToSubmit.append("EndDate", formData.leaveEndDate);
    formDataToSubmit.append("NoDays", formData.noDays);
    
    if (formData.proofFile) {
      formDataToSubmit.append("proofFile", formData.proofFile);
    }

    try {
      const response = await fetch("http://localhost:4000/api/request", {
        method: "POST",
        body: formDataToSubmit,
        // Important: Don't set Content-Type header when using FormData, 
        // the browser will set it automatically with the correct boundary
      });

      const result = await response.json();

      if (response.ok) {
        let finalMessage = "Request submitted successfully!";
        if (isInsufficient && isLateFiling) {
          finalMessage = "Warning: Insufficient balance & late filing. Request submitted but may be rejected.";
        } else if (isInsufficient) {
          finalMessage = "Warning: Insufficient balance. Request submitted but may be rejected.";
        } else if (isLateFiling) {
          finalMessage = "Warning: Vacation Leave must be filed 3 days in advance. Request submitted but may be rejected.";
        }

        setToast({ 
          message: finalMessage, 
          type: (isInsufficient || isLateFiling) ? "error" : "success" 
        });
        // Reset form
        setFormData({
          user_Id: userData?.user_Id || "",
          emp_reqTypeId: "",
          remarks: "",
          leaveStartDate: "",
          leaveEndDate: "",
          noDays: 0,
          proofFile: null,
        });
        fetchBalance();
      } else {
        setToast({ message: result.error || "Failed to submit request", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Error connecting to server", type: "error" });
    }
  };

  const getStatusClass = (status) => {
    if (!status) return "pending";
    const s = status.toLowerCase();
    if (s.includes("approve")) return "approved";
    if (s.includes("reject") || s.includes("denied")) return "rejected";
    return "pending";
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
                      <option value="1">Overtime (OT)</option>
                      <option value="2">On-field Work (OW)</option>
                      <option value="3">Vacation Leave (VL)</option>
                      <option value="4">Sick Leave (SL)</option>
                    </select>
                  </div>

                  {/* Overtime Specific Fields (Type 1) */}
                  {formData.emp_reqTypeId === "1" && (
                    <div className="conditionalFields">
                      <div className="formRow">
                        <div className="formGroup">
                          <label>OT Date</label>
                          <input type="date" name="otDate" onChange={handleInputChange} required />
                        </div>
                      </div>
                      <div className="formRow">
                        <div className="formGroup">
                          <label>Time From</label>
                          <input type="time" name="hrFrom" onChange={handleInputChange} required />
                        </div>
                        <div className="formGroup">
                          <label>Time To</label>
                          <input type="time" name="hrTo" onChange={handleInputChange} required />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* On-field Specific Fields (Type 2) */}
                  {formData.emp_reqTypeId === "2" && (
                    <div className="conditionalFields">
                      <div className="formRow">
                        <div className="formGroup">
                          <label>Date of Field Work</label>
                          <input type="date" name="fieldDate" onChange={handleInputChange} required />
                        </div>
                        <div className="formGroup">
                          <label>No. of Hours</label>
                          <input type="number" name="fieldNoHrs" step="0.5" onChange={handleInputChange} required />
                        </div>
                      </div>
                      <div className="formGroup">
                        <label>Destination</label>
                        <input type="text" name="destination" placeholder="Client site / Office location" onChange={handleInputChange} required />
                      </div>
                      <div className="formGroup fileUploadGroup">
                          <label className="fileLabel" htmlFor="proofFile">
                            <CloudUploadIcon /> {formData.proofFile ? formData.proofFile.name : "Upload Itinerary / Proof"}
                          </label>
                          <input type="file" id="proofFile" name="proofFile" onChange={handleInputChange} style={{ display: 'none' }} />
                      </div>
                    </div>
                  )}
                  {/* Conditional Fields for Leave (Types 3 and 4) */}
                  {(formData.emp_reqTypeId === "3" || formData.emp_reqTypeId === "4") && (
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

                        {formData.emp_reqTypeId === "4" && (
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
                  {loading ? (
                    <p>Loading requests...</p>
                  ) : historyRequests.length > 0 ? (
                    historyRequests.map(req => {
                      const statusClass = getStatusClass(req.status);
                      const dates = req.VL_StartDate ? `${req.VL_StartDate} - ${req.VL_EndDate}` : 
                                    req.SL_StartDate ? `${req.SL_StartDate} - ${req.SL_EndDate}` :
                                    req.OT_DateOf ? req.OT_DateOf : req.DateonField;
                      const days = req.VL_NoDays || req.SL_NoDays || req.OW_NoDays || 1;

                      return (
                        /* 1. Wrap the entire log in a Link */
                        <Link 
                          to={`/requests/${req.emp_reqIdDetails}`} 
                          key={req.emp_reqId} 
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          <div className={`leaveLog ${statusClass}`}>
                            {statusClass === 'approved' && <CheckCircleIcon className="statusIcon approved" />}
                            {statusClass === 'rejected' && <CancelIcon className="statusIcon rejected" />}
                            {statusClass === 'pending' && <HourglassEmptyIcon className="statusIcon pending" />}
                            
                            <div className="typeBadge">{req.reqTypeName}</div>
                            
                            <div className="text">
                              <p className="date">{dates}</p>
                              <p className="desc">{req.remarks || "No details provided"} • {days} Day(s)</p>
                            </div>
                            
                            <span className={`badge ${statusClass}`}>{req.status}</span>
                          </div>
                        </Link>
                      );
                    })
                  ) : (
                    <p>No requests found.</p>
                  )}
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
