import React, { useState } from "react";
import "./adminRequests.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import AttachmentIcon from '@mui/icons-material/Attachment';

const AdminRequests = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const requests = [
    { 
      id: "REQ-101", 
      name: "Cydoel Tomas", 
      type: "VL", 
      fullType: "Vacation Leave",
      startDate: "2024-01-12", 
      endDate: "2024-01-13",
      days: 2,
      pay: "With Pay",
      remarks: "Family Vacation Trip to Palawan",
      status: "pending",
      filed: "2024-01-05"
    },
    { 
      id: "REQ-102", 
      name: "Borgy Tolentino", 
      type: "SL", 
      fullType: "Sick Leave",
      startDate: "2024-01-15", 
      endDate: "2024-01-15",
      days: 1,
      pay: "N/A",
      remarks: "Severe Flu and Fever",
      status: "pending",
      filed: "2024-01-14",
      attachment: "medical_cert.pdf"
    }
  ];

  const current = requests[selectedIdx];

  return (
    <div className="home adminRequests">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="adminWrapper">
          
          <div className="statsRow">
            <div className="statCard">
              <div className="info"><span>Pending Leaves</span><p>2</p></div>
              <HourglassEmptyIcon className="icon pending" />
            </div>
            <div className="statCard">
              <div className="info"><span>Approved Today</span><p>5</p></div>
              <CheckCircleOutlineIcon className="icon approved" />
            </div>
            <div className="statCard">
              <div className="info"><span>Rejected Today</span><p>1</p></div>
              <CancelOutlinedIcon className="icon rejected" />
            </div>
          </div>

          <div className="mainContent">
            {/* Left: Request Queue */}
            <div className="requestListSidebar">
              <div className="tabHeader">
                <button className={activeTab === "pending" ? "active" : ""} onClick={() => setActiveTab("pending")}>Pending</button>
                <button className={activeTab === "completed" ? "active" : ""} onClick={() => setActiveTab("completed")}>History</button>
              </div>
              <div className="listBody">
                <h4>Queue ({requests.length})</h4>
                {requests.map((req, index) => (
                  <div 
                    className={`requestItem ${selectedIdx === index ? "selected" : ""}`} 
                    key={req.id}
                    onClick={() => setSelectedIdx(index)}
                  >
                    <div className="itemHeader">
                      <span className={`typeTag ${req.type}`}>{req.type}</span>
                      <span className="reqId">{req.id}</span>
                    </div>
                    <p className="empName">{req.name}</p>
                    <p className="dateRange">{req.startDate} — {req.endDate}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Detailed Review */}
            <div className="requestDetailView">
              <div className="detailHeader">
                <div className="title">
                    <h3>Review {current.fullType}</h3>
                    <p>Submitted on {current.filed}</p>
                </div>
                <div className="actions">
                  <button className="approveBtn"><CheckCircleOutlineIcon /> Approve Leave</button>
                  <button className="rejectBtn"><CancelOutlinedIcon /> Reject</button>
                </div>
              </div>

              <div className="detailsGrid">
                <div className="detailBox">
                    <label>Employee Name</label>
                    <p>{current.name}</p>
                </div>
                <div className="detailBox">
                    <label>Duration</label>
                    <p>{current.days} Day(s)</p>
                </div>
                <div className="detailBox">
                    <label>Payment Status</label>
                    <p>{current.pay}</p>
                </div>
                {current.attachment && (
                    <div className="detailBox attachment">
                        <label>Attachment</label>
                        <p><AttachmentIcon className="icon"/> {current.attachment}</p>
                    </div>
                )}
                <div className="detailBox fullWidth">
                    <label>Employee Remarks / Purpose</label>
                    <p className="remarksText">"{current.remarks}"</p>
                </div>
              </div>

              <div className="adminDecision">
                <label>Admin Note (Optional)</label>
                <textarea placeholder="Reason for approval or rejection..."></textarea>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRequests;