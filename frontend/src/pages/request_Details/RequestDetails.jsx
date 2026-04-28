import React, { useState, useEffect } from "react";
import "./requestDetails.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import DescriptionIcon from "@mui/icons-material/Description";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PersonIcon from "@mui/icons-material/Person";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AttachmentIcon from "@mui/icons-material/Attachment";
import { useNavigate, useParams } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";

const RequestDetails = () => {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await fetchWithAuth(`/api/request/details/${requestId}`);
        if (response.ok) {
          const data = await response.json();
          setRequest(data);
        } else {
          console.error("Failed to fetch request details");
        }
      } catch (error) {
        console.error("Error fetching request details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (requestId) {
      fetchDetails();
    }
  }, [requestId]);

  if (loading) {
    return (
      <div className="home requestDetails">
        <Sidebar />
        <div className="homeContainer">
          <Navbar />
          <div className="detailsWrapper loading">
            <p>Loading request details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="home requestDetails">
        <Sidebar />
        <div className="homeContainer">
          <Navbar />
          <div className="detailsWrapper error">
            <p>Request not found.</p>
            <button onClick={() => navigate(-1)}>Go Back</button>
          </div>
        </div>
      </div>
    );
  }

  const statusClass = request.status?.toLowerCase() || "pending";
  const isApproved = statusClass.includes("approve");
  const isRejected = statusClass.includes("reject");

  return (
    <div className="home requestDetails">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="detailsWrapper">
          
          {/* Header Section */}
          <div className="pageHeader">
            <div className="left">
              <ArrowBackIcon className="backIcon" onClick={() => navigate(-1)} />
              <div className="titleText">
                <h1>Request Details</h1>
                <span>Request #REQ-{request.emp_reqId}</span>
              </div>
            </div>
            <div className={`statusBadge ${statusClass}`}>
              {isApproved && <CheckCircleIcon className="icon" />}
              {isRejected && <CancelIcon className="icon" />}
              {!isApproved && !isRejected && <HourglassEmptyIcon className="icon" />}
              {request.status}
            </div>
          </div>

          {/* Request Information */}
          <div className="detailCard">
            <div className="cardHeader">
              <DescriptionIcon className="headerIcon" />
              <h3>Request Information</h3>
            </div>
            <div className="infoGrid">
              <div className="item">
                <label>Employee Name</label>
                <p>{request.userName}</p>
              </div>
              <div className="item">
                <label>Request Type</label>
                <p>{request.reqTypeName}</p>
              </div>
              <div className="item">
                <label>Submitted On</label>
                <p>{new Date(request.date_Filed).toLocaleDateString()}</p>
              </div>
              {request.emp_reqTypeId === 1 && (
                <div className="item">
                  <label>OT Date</label>
                  <p>{request.OT_DateOf}</p>
                </div>
              )}
              {request.emp_reqTypeId === 2 && (
                <div className="item">
                  <label>Field Work Date</label>
                  <p>{request.DateonField}</p>
                </div>
              )}
              {request.emp_reqTypeId === 5 && (
                <>
                  <div className="item">
                    <label>Log Date</label>
                    <p>{request.LC_logDate}</p>
                  </div>
                  <div className="item">
                    <label>Category</label>
                    <p className="categoryBadge">{request.LC_correctionCategory || "N/A"}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dynamic Details Section */}
          <div className="detailCard">
            <div className="cardHeader">
              <CalendarTodayIcon className="headerIcon" />
              <h3>Specific Details</h3>
            </div>
            <div className="infoGrid">
              {/* Overtime Details */}
              {request.emp_reqTypeId === 1 && (
                <>
                  <div className="item">
                    <label>Time From</label>
                    <p>{formatTime(request.HrFrom)}</p>
                  </div>
                  <div className="item">
                    <label>Time To</label>
                    <p>{formatTime(request.HrTo)}</p>
                  </div>
                  <div className="item">
                    <label>Total Hours</label>
                    <p>{request.Total_Hrs} Hrs</p>
                  </div>
                </>
              )}

              {/* On-field Details */}
              {request.emp_reqTypeId === 2 && (
                <>
                  <div className="item">
                    <label>Destination</label>
                    <p>{request.destination}</p>
                  </div>
                  <div className="item">
                    <label>Total Hours</label>
                    <p>{request.OW_NoHrs} Hrs</p>
                  </div>
                  <div className="item">
                    <label>Total Days</label>
                    <p>{request.OW_NoDays} Day(s)</p>
                  </div>
                </>
              )}

              {/* Log Correction Details */}
              {request.emp_reqTypeId === 5 && (
                <>
                  <div className="item">
                    <label>Correction Category</label>
                    <p className="categoryBadge">{request.LC_correctionCategory}</p>
                  </div>
                  <div className="item">
                    <label>Current Time-In</label>
                    <p>{request.LC_currentIn || "No Log"}</p>
                  </div>
                  <div className="item">
                    <label>Current Time-Out</label>
                    <p>{request.LC_currentOut || "No Log"}</p>
                  </div>
                  <div className="item">
                    <label>Claimed Time-In</label>
                    <p className="claimed">{formatTime(request.LC_claimedIn)}</p>
                  </div>
                  <div className="item">
                    <label>Claimed Time-Out</label>
                    <p className="claimed">{formatTime(request.LC_claimedOut)}</p>
                  </div>
                </>
              )}

              {/* Leave Details (VL/SL) */}
              {(request.emp_reqTypeId === 3 || request.emp_reqTypeId === 4) && (
                <>
                  <div className="item">
                    <label>Start Date</label>
                    <p>{request.VL_StartDate || request.SL_StartDate}</p>
                  </div>
                  <div className="item">
                    <label>End Date</label>
                    <p>{request.VL_EndDate || request.SL_EndDate}</p>
                  </div>
                  <div className="item">
                    <label>Total Days</label>
                    <p>{request.VL_NoDays || request.SL_NoDays} Day(s)</p>
                  </div>
                  <div className="item">
                    <label>Payment Status</label>
                    <p>{request.VL_withPayName || request.SL_withPayName || "N/A"}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Attachments (If any) */}
          {(request.SL_proof_File || request.OW_proof_File || request.LC_proof_File) && (
            <div className="detailCard">
              <div className="cardHeader">
                <AttachmentIcon className="headerIcon" />
                <h3>Attachments</h3>
              </div>
              <div className="infoGrid">
                <div className="item">
                  <label>Proof Document</label>
                  <a 
                    href={`/api/uploads/${request.SL_proof_File || request.OW_proof_File || request.LC_proof_File}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="attachmentLink"
                  >
                    View Attached File
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Reason / Remarks */}
          <div className="detailCard">
            <div className="cardHeader">
              <h3>Employee Remarks / Purpose</h3>
            </div>
            <div className="textContent">
              <p>{request.remarks || "No details provided."}</p>
            </div>
          </div>

          {/* Decision Section (Only if processed) */}
          {request.emp_reqStatusId !== 1 && (
            <div className="detailCard">
              <div className="cardHeader">
                <PersonIcon className="headerIcon" />
                <h3>Review Information</h3>
              </div>
              <div className="infoGrid">
                <div className="item">
                  <label>Processed By</label>
                  <p className="bold">{request.approverName ? `${request.approverName} (${formatUserId(request.processedBy)})` : "System"}</p>
                </div>
                <div className="item">
                  <label>Processed On</label>
                  <p>{request.date_Processed || "N/A"}</p>
                </div>
              </div>
              <div className="commentsBox">
                <label>Management Note / Remarks</label>
                <p>{request.admin_remarks || "No additional notes provided."}</p>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="detailCard">
            <div className="cardHeader">
              <h3>Timeline</h3>
            </div>
            <div className="timeline">
              <div className="timelineItem">
                <div className="marker blue"><AccessTimeIcon className="icon"/></div>
                <div className="content">
                  <p className="status">Request Submitted</p>
                  <p className="date">{new Date(request.date_Filed).toLocaleDateString()}</p>
                </div>
              </div>
              {request.emp_reqStatusId !== 1 && (
                <div className="timelineItem last">
                  <div className={`marker ${isApproved ? 'green' : 'red'}`}>
                    {isApproved ? <CheckCircleIcon className="icon"/> : <CancelIcon className="icon"/>}
                  </div>
                  <div className="content">
                    <p className="status">Request {request.status}</p>
                    <p className="date">{request.date_Processed}</p>
                    <p className="sub">Reviewed by {request.approverName} ({formatUserId(request.processedBy)})</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RequestDetails;