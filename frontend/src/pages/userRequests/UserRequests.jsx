import React, { useState, useEffect } from "react";
import "./userRequests.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Toast from "../../components/toast/Toast";
import AccessTimeIcon from '@mui/icons-material/AccessTime'; // Add this import
import { useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Link } from "react-router-dom";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { formatUserId } from "../../utils/formatUserId";

const UserRequests = () => {
  const dtrRef = useRef();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [activeTab, setActiveTab] = useState("submit"); // 'submit' or 'history'
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [historyRequests, setHistoryRequests] = useState([]);
  const [dtrData, setDtrData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Dynamic DTR Date Range (1-15 or 16-EOM)
  const getPayrollDates = () => {
    const today = new Date();
    const day = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    if (day <= 15) {
      return {
        start: new Date(year, month, 1).toISOString().split('T')[0],
        end: new Date(year, month, 15).toISOString().split('T')[0],
        payEnding: `${today.toLocaleString('en-US', { month: 'long' }).toUpperCase()} 15, ${year}`
      };
    } else {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return {
        start: new Date(year, month, 16).toISOString().split('T')[0],
        end: new Date(year, month + 1, 0).toISOString().split('T')[0],
        payEnding: `${today.toLocaleString('en-US', { month: 'long' }).toUpperCase()} ${lastDay}, ${year}`
      };
    }
  };

  const payroll = getPayrollDates();
  const [dtrStartDate, setDtrStartDate] = useState(payroll.start);
  const [dtrEndDate, setDtrEndDate] = useState(payroll.end);
  const [balance, setBalance] = useState({ VL_balance: 0, SL_balance: 0 });

  // 3. Add the PDF Export function
  const handleDownloadDTR = async () => {
    const element = dtrRef.current;
    if (!element) return;

    try {
      const canvas = await html2canvas(element, { 
        scale: 2, // Higher quality
        useCORS: true, 
        backgroundColor: "#f7f1e3" // Matches your SCSS card color
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`DTR_${userData?.user_LastName || "Report"}.pdf`);
    } catch (error) {
      setToast({ message: "Failed to generate PDF", type: "error" });
    }
  };

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
    totalHrs: 0,
    proofFile: null,
  });

  useEffect(() => {
    if (formData.hrFrom && formData.hrTo) {
      const [h1, m1] = formData.hrFrom.split(":").map(Number);
      const [h2, m2] = formData.hrTo.split(":").map(Number);
      
      if (!isNaN(h1) && !isNaN(h2)) {
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 24 * 60; // Handle overnight OT
        
        const calculatedHrs = (diff / 60).toFixed(2);
        setFormData(prev => ({ 
          ...prev, 
          totalHrs: calculatedHrs
        }));
      }
    } else {
      if (formData.totalHrs !== "0.00" && formData.totalHrs !== 0) {
        setFormData(prev => ({ ...prev, totalHrs: "0.00" }));
      }
    }
  }, [formData.hrFrom, formData.hrTo, formData.emp_reqTypeId]);

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

  // Fetch DTR
  const fetchDTR = async () => {
    if (!userData?.user_Id) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:4000/api/attendance/report?startDate=${dtrStartDate}&endDate=${dtrEndDate}&user_Id=${userData.user_Id}`);
      const data = await response.json();
      if (response.ok) {
        setDtrData(data);
      }
    } catch (error) {
      console.error("Error fetching DTR:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [userData?.user_Id]);

  useEffect(() => {
    fetchHistory();
    if (activeTab === "dtr") {
      fetchDTR();
    }
  }, [activeTab]);

  // Helper to map log data to the DTR grid (15 days or current range)
  const getDtrLogsForDay = (dayNum) => {
    const targetDate = new Date(dtrStartDate);
    targetDate.setDate(dayNum);
    const dateStr = targetDate.toISOString().split('T')[0];
    return dtrData.find(d => d.log_Date.split('T')[0] === dateStr);
  };

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

  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
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
    formDataToSubmit.append("reason", formData.remarks);
    
    if (formData.emp_reqTypeId === "1") {
      formDataToSubmit.append("OT_DateOf", formData.otDate);
      formDataToSubmit.append("HrFrom", formData.hrFrom);
      formDataToSubmit.append("HrTo", formData.hrTo);
      formDataToSubmit.append("Total_Hrs", formData.totalHrs);
    } else {
      formDataToSubmit.append("StartDate", formData.leaveStartDate);
      formDataToSubmit.append("EndDate", formData.leaveEndDate);
      formDataToSubmit.append("NoDays", formData.noDays);
    }
    
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
          otDate: "",
          hrFrom: "",
          hrTo: "",
          totalHrs: 0,
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

          <div className="statsRow">
            <div className="statCard">
              <div className="info">
                <span>Pending Requests</span>
                <p></p>
              </div>
              <HourglassEmptyIcon className="icon pending" />
            </div>
            <div className="statCard">
              <div className="info">
                <span>Approved Total</span>
                <p></p>
              </div>
              <CheckCircleOutlineIcon className="icon approved" />
            </div>
            <div className="statCard">
              <div className="info">
                <span>Rejected Total</span>
                <p></p>
              </div>
              <CancelOutlinedIcon className="icon rejected" />
            </div>
          </div><br />
          
          {/* Inside the contentSection in UserRequests.jsx */}
          <div className="contentSection">
            {activeTab !== "dtr" ? (
              /* Side-by-Side Flex Container */
              <div className="requestsSplitLayout">
                
                {/* Left Column: The Form */}
                <div className="requestCard formColumn">
                  <h2 className="cardTitle">Submit New Request</h2>
                  <form onSubmit={handleSubmit}>
                    <div className="formGroup">
                      <label>Request Type</label>
                      <select name="emp_reqTypeId" value={formData.emp_reqTypeId} onChange={handleInputChange} required>
                        <option value="" disabled>Select request type</option>
                        <option value="1">Overtime (OT)</option>
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
                              <label>Time From {formData.hrFrom && <span style={{color: "#2A174E", fontSize: "12px", marginLeft: "5px"}}>({parseInt(formData.hrFrom.split(":")[0]) >= 12 ? "PM" : "AM"})</span>}</label>
                              <input type="time" name="hrFrom" onChange={handleInputChange} required />
                            </div>
                            <div className="formGroup">
                              <label>Time To {formData.hrTo && <span style={{color: "#2A174E", fontSize: "12px", marginLeft: "5px"}}>({parseInt(formData.hrTo.split(":")[0]) >= 12 ? "PM" : "AM"})</span>}</label>
                              <input type="time" name="hrTo" onChange={handleInputChange} required />
                            </div>
                          </div>
                          <div className="formRow">
                            <div className="formGroup">
                              <label>Total Hours</label>
                              <input type="number" name="totalHrs" value={formData.totalHrs} readOnly className="readOnlyInput" />
                            </div>
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

                {/* Right Column: History */}
                <div className="fullRequests historyColumn">
                  <h2 className="cardTitle">All My Requests</h2>
                  <div className="requestsList">
                    {loading ? (
                      <p>Loading requests...</p>
                    ) : historyRequests.length > 0 ? (
                      historyRequests.slice(0, 10).map(req => { /* Showing latest 10 */
                        const statusClass = getStatusClass(req.status);
                        const dates = req.VL_StartDate ? `${req.VL_StartDate} - ${req.VL_EndDate}` : 
                                    req.SL_StartDate ? `${req.SL_StartDate} - ${req.SL_EndDate}` :
                                    req.OT_DateOf ? `${req.OT_DateOf} (${formatTime(req.HrFrom)} - ${formatTime(req.HrTo)})` : req.DateonField;
                        const days = req.VL_NoDays || req.SL_NoDays || req.OW_NoDays || 1;
                        return (
                          <Link to={`/requests/${req.emp_reqId}`} key={req.emp_reqId} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div className={`leaveLog ${statusClass}`}>
                              {statusClass === 'approved' && <CheckCircleIcon className="statusIcon approved" />}
                              {statusClass === 'rejected' && <CancelIcon className="statusIcon rejected" />}
                              {statusClass === 'pending' && <HourglassEmptyIcon className="statusIcon pending" />}
                              
                              <div className="typeBadge">{req.reqTypeName}</div>
                              <div className="text">
                                <p className="date">{req.reqTypeName}</p>
                                <p className="desc">{req.status} • {req.VL_NoDays || req.SL_NoDays || 1} Day(s)</p>
                              </div>
                            </div>
                          </Link>
                        );
                      })
                    ) : (
                      <p>No requests found.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* DTR View remains full width */
              <div className="dtrSection">
                <div className="dtrHeader">
                    <h2 className="cardTitle">Daily Time Record</h2>
                    <button className="exportDtrBtn" onClick={handleDownloadDTR}>
                        <CloudUploadIcon /> Export DTR as PDF
                    </button>
                </div>
                {/* 5. Add the ref to the container you want to capture */}
                <div className="timeCardContainer" ref={dtrRef}>
                  {/* Top Header Fields */}
                  <div className="cardTopHeader">
                    <div className="headerLine">
                      <div className="field">No. <span>{formatUserId(userData?.user_Id)}</span></div>
                      <div className="field">Pay Ending <span>{payroll.payEnding}</span></div>
                    </div>
                    <div className="headerLine">
                      <div className="field">Name <span>{userData?.user_FirstName} {userData?.user_LastName}</span></div>
                      <div className="field">Position <span>__________</span></div>
                    </div>
                    <div className="headerLine">
                      <div className="field">Dept. <span>__________</span></div>
                      <div className="field">Age <span>____</span></div>
                    </div>
                  </div>

                  {/* Summary Table: Earnings and Deductions */}
                  <table className="summaryTable">
                    <thead>
                      <tr>
                        <th colSpan="2">Hours</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th className="verticalTh" rowSpan="6">DEDUCTIONS</th>
                        <th colSpan="2">ABSENCES</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="label">Reg.</td><td className="empty"></td><td className="empty"></td><td className="empty"></td><td className="label">Fines</td><td className="empty"></td>
                      </tr>
                      <tr>
                        <td className="label">Over.</td><td className="empty"></td><td className="empty"></td><td className="empty"></td><td className="label">Withholding Tax</td><td className="empty"></td>
                      </tr>
                      <tr>
                        <td className="label" colSpan="3">Total Earnings</td><td className="empty">{dtrData.reduce((sum, d) => sum + parseFloat(d.hoursWorked || 0), 0).toFixed(2)} hrs</td><td className="label">S.S.S.</td><td className="empty"></td>
                      </tr>
                      <tr>
                        <td className="label" colSpan="3">Less Deductions</td><td className="empty"></td><td className="empty" colSpan="2"></td>
                      </tr>
                      <tr className="finalRow">
                        <td className="label" colSpan="3">NET PAY</td><td className="empty"></td><td className="label">TOTAL</td><td className="empty"></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Main Attendance Grid */}
                  <table className="mainAttendanceGrid">
                    <thead>
                      <tr>
                        <th rowSpan="2">Days</th>
                        <th colSpan="2">MORNING</th>
                        <th colSpan="2">AFTERNOON</th>
                        <th colSpan="2">OVERTIME</th>
                        <th rowSpan="2">Daily Total</th>
                      </tr>
                      <tr>
                        <th>IN</th><th>OUT</th><th>IN</th><th>OUT</th><th>IN</th><th>OUT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Generate rows based on the current period range */}
                      {Array.from({ length: (new Date(dtrEndDate).getDate() - new Date(dtrStartDate).getDate() + 1) }, (_, i) => {
                        const dayNum = new Date(dtrStartDate).getDate() + i;
                        const log = getDtrLogsForDay(dayNum);
                        
                        let morningIn = "", morningOut = "", afternoonIn = "", afternoonOut = "";
                        
                        if (log && log.time_In !== "—") {
                          const hour = parseInt(log.time_In.split(":")[0]);
                          if (hour < 12) morningIn = log.time_In;
                          else afternoonIn = log.time_In;
                        }
                        
                        if (log && log.time_Out !== "—") {
                          const hour = parseInt(log.time_Out.split(":")[0]);
                          if (hour < 13) morningOut = log.time_Out;
                          else afternoonOut = log.time_Out;
                        }

                        return (
                          <tr key={dayNum}>
                            <td className="dayCol">{dayNum}</td>
                            <td>{morningIn}</td>
                            <td>{morningOut}</td>
                            <td>{afternoonIn}</td>
                            <td>{afternoonOut}</td>
                            <td></td>
                            <td></td>
                            <td>{log ? log.hoursWorked : ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="cardFooter">
                    <p className="certification">I hereby certify that the above records are true and correct.</p>
                    <div className="signatureLine">
                      <div className="line"></div>
                      <span>EMPLOYEE'S SIGNATURE</span>
                    </div>
                    <div className="modelTag">MODEL-9,000</div>
                  </div>
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
