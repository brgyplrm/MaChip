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
import { fetchWithAuth } from "../../utils/api";

const UserRequests = () => {
  const dtrRef = useRef();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [activeTab, setActiveTab] = useState("submit"); // 'submit' or 'history'
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [historyRequests, setHistoryRequests] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [dtrData, setDtrData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Calculate stats whenever history changes
  useEffect(() => {
    const pending = historyRequests.filter(r => r.emp_reqStatusId === 1).length;
    const approved = historyRequests.filter(r => r.emp_reqStatusId === 2).length;
    const rejected = historyRequests.filter(r => r.emp_reqStatusId === 3).length;
    setStats({ pending, approved, rejected });
  }, [historyRequests]);
  
  // Dynamic DTR Date Range (1-16 or 17-EOM)
  const getPayrollDates = () => {
    const today = new Date();
    const day = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthName = today.toLocaleString('en-US', { month: 'long' });
    
    const formatDate = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (day <= 15) {
      const start = new Date(year, month, 1);
      const end = new Date(year, month, 15);
      return {
        start: formatDate(start),
        end: formatDate(end),
        payEnding: `${monthName} 1-15, ${year}`
      };
    } else {
      const start = new Date(year, month, 16);
      const end = new Date(year, month + 1, 0); // Last day of month
      return {
        start: formatDate(start),
        end: formatDate(end),
        payEnding: `${monthName} 16-${end.getDate()}, ${year}`
      };
    }
  };

  const payroll = getPayrollDates();
  const [dtrStartDate, setDtrStartDate] = useState(payroll.start);
  const [dtrEndDate, setDtrEndDate] = useState(payroll.end);
  const [balance, setBalance] = useState({ VL_balance: 0, SL_balance: 0 });
  const [minAllowedDate, setMinAllowedDate] = useState("");

  const fetchPayrollPeriods = async () => {
    try {
      const response = await fetchWithAuth("/api/system/payroll-periods");
      if (response.ok) {
        const periods = await response.json();
        // Find the latest non-Draft period
        const latestClosed = periods
          .filter(p => ["Processing", "Released", "Closed"].includes(p.status))
          .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0];
        
        if (latestClosed) {
          const nextDate = new Date(latestClosed.endDate);
          nextDate.setDate(nextDate.getDate() + 1);
          setMinAllowedDate(nextDate.toISOString().split('T')[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching periods:", error);
    }
  };

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
    // Log Correction fields
    logCorrDate: "",
    currentIn: "",
    currentOut: "",
    claimedIn: "",
    claimedOut: "",
  });

  const [currentPeriodLogs, setCurrentPeriodLogs] = useState([]);
  const [periodDates, setPeriodDates] = useState([]);

  // Fetch Current Period Logs for Log Correction
  const fetchCurrentPeriodLogs = async () => {
    if (!userData?.user_Id) return;
    try {
      const { start, end } = getPayrollDates();
      
      // Generate all dates in the range using local time
      const dates = [];
      const startDate = new Date(start + "T00:00:00");
      const endDate = new Date(end + "T00:00:00");
      
      let curr = new Date(startDate);
      while (curr <= endDate) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
        curr.setDate(curr.getDate() + 1);
      }
      setPeriodDates(dates);

      const response = await fetchWithAuth(`/api/attendance/report?startDate=${start}&endDate=${end}&user_Id=${userData.user_Id}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentPeriodLogs(data);
      }
    } catch (error) {
      console.error("Error fetching logs for correction:", error);
    }
  };

  useEffect(() => {
    if (formData.emp_reqTypeId === "5") {
      fetchCurrentPeriodLogs();
    }
  }, [formData.emp_reqTypeId]);

  const handleLogDateChange = (e) => {
    const selectedDate = e.target.value;
    const dateObj = new Date(selectedDate);
    
    // Check if Sunday (0)
    if (dateObj.getUTCDay() === 0) {
      setToast({ message: "Cannot file log correction for Sundays.", type: "error" });
      setFormData(prev => ({
        ...prev,
        logCorrDate: "",
        currentIn: "",
        currentOut: "",
      }));
      return;
    }

    const log = currentPeriodLogs.find(l => l.log_Date.split('T')[0] === selectedDate);
    
    setFormData(prev => ({
      ...prev,
      logCorrDate: selectedDate,
      currentIn: log ? (log.morning_In !== "—" ? log.morning_In : "") : "",
      currentOut: log ? (log.afternoon_Out !== "—" ? log.afternoon_Out : "") : "",
    }));
  };

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
      const response = await fetchWithAuth(`\/api\/request/balance/${userData.user_Id}`);
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
      const response = await fetchWithAuth(`\/api\/request/${userData.user_Id}`);
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
      const response = await fetchWithAuth(`\/api\/attendance/report?startDate=${dtrStartDate}&endDate=${dtrEndDate}&user_Id=${userData.user_Id}`);
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
    fetchPayrollPeriods();

    const handleRefresh = () => {
      fetchBalance();
      fetchHistory();
      if (activeTab === "dtr") fetchDTR();
    };

    window.addEventListener("dataRefresh", handleRefresh);
    return () => window.removeEventListener("dataRefresh", handleRefresh);
  }, [userData?.user_Id, activeTab]);

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
      
      let count = 0;
      let cur = new Date(start);
      while (cur <= end) {
        if (cur.getDay() !== 0) { // 0 is Sunday
          count++;
        }
        cur.setDate(cur.getDate() + 1);
      }

      setFormData((prev) => ({
        ...prev,
        noDays: count,
      }));
    }
  }, [formData.leaveStartDate, formData.leaveEndDate]);

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (type === "file" && files && files[0]) {
      const file = files[0];
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
      if (!allowedTypes.includes(file.type)) {
        setToast({ message: "Invalid file format. Only png, jpg, and jpeg are allowed!", type: "error" });
        // Clear input
        e.target.value = null;
        return;
      }
    }

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
    } else if (formData.emp_reqTypeId === "2") {
      formDataToSubmit.append("DateonField", formData.otDate);
      formDataToSubmit.append("NoHrs", formData.totalHrs);
      formDataToSubmit.append("NoDays", 1); // Default to 1 day for user-requested onfield
      formDataToSubmit.append("destination", formData.remarks);
    } else if (formData.emp_reqTypeId === "5") {
      formDataToSubmit.append("logDate", formData.logCorrDate);
      formDataToSubmit.append("currentIn", formData.currentIn);
      formDataToSubmit.append("currentOut", formData.currentOut);
      formDataToSubmit.append("claimedIn", formData.claimedIn);
      formDataToSubmit.append("claimedOut", formData.claimedOut);
      formDataToSubmit.append("reason", formData.remarks);
    } else {
      formDataToSubmit.append("StartDate", formData.leaveStartDate);
      formDataToSubmit.append("EndDate", formData.leaveEndDate);
      formDataToSubmit.append("NoDays", formData.noDays);
    }
    
    if (formData.proofFile) {
      formDataToSubmit.append("proofFile", formData.proofFile);
    }

    try {
      const response = await fetchWithAuth("/api/request", {
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
          logCorrDate: "",
          currentIn: "",
          currentOut: "",
          claimedIn: "",
          claimedOut: "",
        });
        fetchBalance();
        fetchHistory(); // Refresh history immediately
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
                <p>{stats.pending}</p>
              </div>
              <HourglassEmptyIcon className="icon pending" />
            </div>
            <div className="statCard">
              <div className="info">
                <span>Approved Total</span>
                <p>{stats.approved}</p>
              </div>
              <CheckCircleOutlineIcon className="icon approved" />
            </div>
            <div className="statCard">
              <div className="info">
                <span>Rejected Total</span>
                <p>{stats.rejected}</p>
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
                        <option value="5">Log Correction</option>
                      </select>
                    </div>

                    {/* Log Correction Specific Fields (Type 5) */}
                    {formData.emp_reqTypeId === "5" && (
                      <div className="conditionalFields">
                        <p className="periodNote">Current Period: {payroll.payEnding}</p>
                        <div className="formRow">
                          <div className="formGroup">
                            <label>Date to Correct</label>
                            <select name="logCorrDate" value={formData.logCorrDate} onChange={handleLogDateChange} required>
                              <option value="" disabled>Select a date from this period</option>
                              {periodDates.map(date => (
                                <option key={date} value={date}>
                                  {new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="formRow">
                          <div className="formGroup">
                            <label>Current In (System)</label>
                            <input type="text" value={formData.currentIn || "No Log"} readOnly className="readOnlyInput" />
                          </div>
                          <div className="formGroup">
                            <label>Current Out (System)</label>
                            <input type="text" value={formData.currentOut || "No Log"} readOnly className="readOnlyInput" />
                          </div>
                        </div>

                        <div className="formRow">
                          <div className="formGroup">
                            <label>Claimed Time-In</label>
                            <input type="time" name="claimedIn" value={formData.claimedIn} onChange={handleInputChange} required />
                          </div>
                          <div className="formGroup">
                            <label>Claimed Time-Out</label>
                            <input type="time" name="claimedOut" value={formData.claimedOut} onChange={handleInputChange} required />
                          </div>
                        </div>

                        <div className="formRow">
                          <div className="formGroup fileUploadGroup fullWidth">
                            <label className="fileLabel" htmlFor="proofFile">
                              <CloudUploadIcon /> {formData.proofFile ? formData.proofFile.name : "Upload Proof (Photo/PDF)"}
                            </label>
                            <input type="file" id="proofFile" name="proofFile" accept="image/*,.pdf" onChange={handleInputChange} style={{ display: 'none' }} />
                          </div>
                        </div>
                      </div>
                    )}

                     {/* Overtime Specific Fields (Type 1) */}
                      {formData.emp_reqTypeId === "1" && (
                        <div className="conditionalFields">
                          <div className="formRow">
                            <div className="formGroup">
                              <label>OT Date</label>
                              <input type="date" name="otDate" min={minAllowedDate} onChange={handleInputChange} required />
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
                              <input type="date" name="leaveStartDate" min={minAllowedDate} value={formData.leaveStartDate} onChange={handleInputChange} required />
                            </div>
                            <div className="formGroup">
                              <label>End Date</label>
                              <input type="date" name="leaveEndDate" min={minAllowedDate} value={formData.leaveEndDate} onChange={handleInputChange} required />
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
                      historyRequests.slice(0, 15).map(req => { /* Showing latest 15 */
                        const statusClass = getStatusClass(req.status);
                        
                        // Determine what info to show based on type
                        let detailText = "";
                        if (req.emp_reqTypeId === 1) { // OT
                          detailText = `${req.Total_Hrs} Hr(s) • ${req.OT_DateOf}`;
                        } else if (req.emp_reqTypeId === 2) { // Field Work
                          detailText = `${req.OW_NoDays} Day(s) • ${req.DateonField}`;
                        } else { // Leaves
                          const days = req.VL_NoDays || req.SL_NoDays || 1;
                          const start = req.VL_StartDate || req.SL_StartDate;
                          detailText = `${days} Day(s) • ${start}`;
                        }

                        return (
                          <Link to={`/requests/${req.emp_reqId}`} key={req.emp_reqId} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div className={`leaveLog ${statusClass}`}>
                              {statusClass === 'approved' && <CheckCircleIcon className="statusIcon approved" />}
                              {statusClass === 'rejected' && <CancelIcon className="statusIcon rejected" />}
                              {statusClass === 'pending' && <HourglassEmptyIcon className="statusIcon pending" />}
                              
                              <div className="typeBadge">{req.reqTypeName}</div>
                              <div className="text">
                                <p className="date">{req.reqTypeName}</p>
                                <p className="desc">{req.status} • {detailText}</p>
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
                        const targetDate = new Date(dtrStartDate);
                        targetDate.setDate(targetDate.getDate() + i);
                        const dayNum = targetDate.getDate();
                        const isSunday = targetDate.getDay() === 0;

                        if (isSunday) return null;

                        const log = getDtrLogsForDay(dayNum);
                        
                        let morningIn = "", morningOut = "", afternoonIn = "", afternoonOut = "";
                        let otIn = "", otOut = "";

                        if (log) {
                          morningIn = log.morning_In !== "—" ? log.morning_In : "";
                          morningOut = log.morning_Out !== "—" ? log.morning_Out : "";
                          afternoonIn = log.afternoon_In !== "—" ? log.afternoon_In : "";
                          afternoonOut = log.afternoon_Out !== "—" ? log.afternoon_Out : "";
                          otIn = log.ot_In !== "—" ? log.ot_In : "";
                          otOut = log.ot_Out !== "—" ? log.ot_Out : "";
                        }

                        return (
                          <tr key={dayNum}>
                            <td className="dayCol">{dayNum}</td>
                            <td>{morningIn}</td>
                            <td>{morningOut}</td>
                            <td>{afternoonIn}</td>
                            <td>{afternoonOut}</td>
                            <td>{otIn}</td>
                            <td>{otOut}</td>
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
