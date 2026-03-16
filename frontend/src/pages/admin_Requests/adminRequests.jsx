import React, { useState, useEffect } from "react";
import "./adminRequests.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import AttachmentIcon from "@mui/icons-material/Attachment";
import Toast from "../../components/toast/Toast";

const AdminRequests = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(2); // 2 = Leave without Pay (default)
  const [toast, setToast] = useState({ message: "", type: "success" });

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:4000/api/request/all");
      const data = await response.json();
      if (response.ok) {
        setRequests(data);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Reset paymentStatus when selectedIdx or activeTab changes
  useEffect(() => {
    setPaymentStatus(2); // Default to without pay
  }, [selectedIdx, activeTab]);

  const handleStatusUpdate = async (emp_reqId, statusId) => {
    try {
      const response = await fetch(
        "http://localhost:4000/api/request/update-status",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emp_reqId,
            emp_reqStatusId: statusId,
            processedBy: userData?.user_Id,
            remarks: adminNote,
            withPayId:
              current?.emp_reqTypeId === 3 || current?.emp_reqTypeId === 4
                ? paymentStatus
                : null,
          }),
        },
      );

      if (response.ok) {
        setToast({
          message: `Request ${statusId === 2 ? "Approved" : "Rejected"} successfully!`,
          type: "success",
        });
        setAdminNote("");
        fetchRequests(); // Refresh list
      } else {
        const err = await response.json();
        setToast({
          message: err.error || "Failed to update status",
          type: "error",
        });
      }
    } catch (error) {
      setToast({ message: "Error connecting to server", type: "error" });
    }
  };

  // Filter based on active tab
  // emp_reqStatusId: 1 = Pending, 2 = Approved, 3 = Rejected
  const filteredRequests = requests.filter((req) => {
    if (activeTab === "pending") return req.emp_reqStatusId === 1;
    return req.emp_reqStatusId !== 1; // Completed (Approved or Rejected)
  });

  const current =
    filteredRequests.length > selectedIdx
      ? filteredRequests[selectedIdx]
      : null;

  const getShortType = (typeName) => {
    if (!typeName) return "REQ";
    if (typeName.includes("Vacation")) return "VL";
    if (typeName.includes("Sick")) return "SL";
    if (typeName.includes("Overtime")) return "OT";
    if (typeName.includes("Onfield")) return "OW";
    return "REQ";
  };

  const getDates = (req) => {
    if (!req) return "";
    return req.VL_StartDate
      ? `${req.VL_StartDate} — ${req.VL_EndDate}`
      : req.SL_StartDate
        ? `${req.SL_StartDate} — ${req.SL_EndDate}`
        : req.OT_DateOf
          ? req.OT_DateOf
          : req.DateonField;
  };

  return (
    <div className="home adminRequests">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="adminWrapper">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast({ ...toast, message: "" })}
          />

          <div className="statsRow">
            <div className="statCard">
              <div className="info">
                <span>Pending Requests</span>
                <p>{requests.filter((r) => r.emp_reqStatusId === 1).length}</p>
              </div>
              <HourglassEmptyIcon className="icon pending" />
            </div>
            <div className="statCard">
              <div className="info">
                <span>Approved Total</span>
                <p>{requests.filter((r) => r.emp_reqStatusId === 2).length}</p>
              </div>
              <CheckCircleOutlineIcon className="icon approved" />
            </div>
            <div className="statCard">
              <div className="info">
                <span>Rejected Total</span>
                <p>{requests.filter((r) => r.emp_reqStatusId === 3).length}</p>
              </div>
              <CancelOutlinedIcon className="icon rejected" />
            </div>
          </div>

          <div className="mainContent">
            {/* Left: Request Queue */}
            <div className="requestListSidebar">
              <div className="tabHeader">
                <button
                  className={activeTab === "pending" ? "active" : ""}
                  onClick={() => {
                    setActiveTab("pending");
                    setSelectedIdx(0);
                  }}
                >
                  Pending
                </button>
                <button
                  className={activeTab === "completed" ? "active" : ""}
                  onClick={() => {
                    setActiveTab("completed");
                    setSelectedIdx(0);
                  }}
                >
                  History
                </button>
              </div>
              <div className="listBody">
                <h4>
                  {activeTab === "pending" ? "Queue" : "Past Requests"} (
                  {filteredRequests.length})
                </h4>
                {loading ? (
                  <p>Loading...</p>
                ) : (
                  filteredRequests.map((req, index) => (
                    <div
                      className={`requestItem ${selectedIdx === index ? "selected" : ""}`}
                      key={req.emp_reqId}
                      onClick={() => setSelectedIdx(index)}
                    >
                      <div className="itemHeader">
                        <span
                          className={`typeTag ${getShortType(req.reqTypeName)}`}
                        >
                          {getShortType(req.reqTypeName)}
                        </span>
                        <span className="reqId">REQ-{req.emp_reqId}</span>
                      </div>
                      <p className="empName">{req.userName}</p>
                      <p className="dateRange">{getDates(req)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Detailed Review */}
            <div className="requestDetailView">
              {current ? (
                <>
                  <div className="detailHeader">
                    <div className="title">
                      <h3>Review {current.reqTypeName}</h3>
                      <p>Submitted on {current.date_Filed}</p>
                    </div>
                    {current.emp_reqStatusId === 1 && (
                      <div className="actions">
                        <button
                          className="approveBtn"
                          onClick={() =>
                            handleStatusUpdate(current.emp_reqId, 2)
                          }
                        >
                          <CheckCircleOutlineIcon /> Approve
                        </button>
                        <button
                          className="rejectBtn"
                          onClick={() =>
                            handleStatusUpdate(current.emp_reqId, 3)
                          }
                        >
                          <CancelOutlinedIcon /> Reject
                        </button>
                      </div>
                    )}
                    {current.emp_reqStatusId !== 1 && (
                      <div
                        className={`statusBadge ${current.status.toLowerCase()}`}
                      >
                        {current.status}
                      </div>
                    )}
                  </div>

                  <div className="detailsGrid">
                    <div className="detailBox">
                      <label>Employee Name</label>
                      <p>{current.userName}</p>
                    </div>
                    <div className="detailBox">
                      <label>Duration / Details</label>
                      <p>
                        {current.emp_reqTypeId === 1 // Overtime
                          ? `${current.Total_Hrs || 0} Hrs`
                          : current.emp_reqTypeId === 2 // Onfield
                            ? `${current.OW_NoDays || 0} Day(s) (${current.OW_NoHrs || 0} Hrs)`
                            : `${current.VL_NoDays || current.SL_NoDays || 0} Day(s)`}
                      </p>
                    </div>
                    <div className="detailBox">
                      <label>Payment Status</label>
                      {current.emp_reqStatusId === 1 &&
                      (current.emp_reqTypeId === 3 ||
                        current.emp_reqTypeId === 4) ? (
                        <select
                          className="paymentDropdown"
                          value={paymentStatus}
                          onChange={(e) =>
                            setPaymentStatus(parseInt(e.target.value))
                          }
                        >
                          <option value={1}>Leave with Pay</option>
                          <option value={2}>Leave without Pay</option>
                          <option value={3}>Considered AWOL</option>
                          <option value={4}>For Suspension</option>
                          <option value={5}>For Dismissal</option>
                        </select>
                      ) : (
                        <p>
                          {current.VL_withPayName ||
                            current.SL_withPayName ||
                            "N/A"}
                        </p>
                      )}
                    </div>
                    <div className="detailBox">
                        <label>{current.emp_reqStatusId === 1 ? "Remaining Balance" : "Leave Used"}</label>
                        <p className={
                          (current.emp_reqStatusId === 1) && (
                            (current.emp_reqTypeId === 3 && current.VL_balance < current.VL_NoDays) ||
                            (current.emp_reqTypeId === 4 && current.SL_balance < current.SL_NoDays)
                          ) ? "insufficient" : ""
                        }>
                          {current.emp_reqTypeId === 3 
                            ? (current.emp_reqStatusId === 1 ? `${current.VL_balance || 0} VL Remaining` : `${current.VL_NoDays || 0} Day(s) Used`)
                            : current.emp_reqTypeId === 4 
                            ? (current.emp_reqStatusId === 1 ? `${current.SL_balance || 0} SL Remaining` : `${current.SL_NoDays || 0} Day(s) Used`)
                            : "N/A"}
                        </p>
                    </div>
                    {(current.SL_proof_File || current.OW_proof_File) && (
                      <div className="detailBox attachment">
                        <label>Attachment</label>
                        <p>
                          <AttachmentIcon className="icon" />{" "}
                          {current.SL_proof_File || current.OW_proof_File}
                        </p>
                      </div>
                    )}
                    <div className="detailBox fullWidth">
                        <label>Employee Remarks / Purpose</label>
                        <p className="remarksText">"{current.remarks || "No details provided"}"</p>
                    </div>
                    {current.system_remarks && (
                      <div className="detailBox fullWidth systemNoteBox">
                          <label>System Remarks Note:</label>
                          <p className="remarksText errorNote">"{current.system_remarks}"</p>
                      </div>
                    )}
                    {current.admin_remarks && (
                      <div className="detailBox fullWidth adminNoteBox">
                        <label>Admin Note</label>
                        <p className="remarksText">"{current.admin_remarks}"</p>
                      </div>
                    )}
                  </div>

                  {current.emp_reqStatusId === 1 && (
                    <div className="adminDecision">
                      <label>Admin Note (Optional)</label>
                      <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder="Reason for approval or rejection..."
                      ></textarea>
                    </div>
                  )}
                </>
              ) : (
                <div className="noSelection">
                  <p>Select a request to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRequests;
