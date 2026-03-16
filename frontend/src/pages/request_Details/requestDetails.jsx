import React from "react";
import "./requestDetails.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DescriptionIcon from "@mui/icons-material/Description";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PersonIcon from "@mui/icons-material/Person";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { useNavigate } from "react-router-dom";

const RequestDetails = () => {
  const navigate = useNavigate();

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
                <span>Request #REQ-001</span>
              </div>
            </div>
            <div className="statusBadge approved">
              <CheckCircleIcon className="icon" /> Approved
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
                <label>Request Number</label>
                <p>#REQ-001</p>
              </div>
              <div className="item">
                <label>Request Type</label>
                <p>Leave</p>
              </div>
              <div className="item">
                <label>Leave Type</label>
                <p>Vacation Leave</p>
              </div>
              <div className="item">
                <label>Submitted On</label>
                <p>January 5, 2026 at 10:30 AM</p>
              </div>
            </div>
          </div>

          {/* Date & Duration */}
          <div className="detailCard">
            <div className="cardHeader">
              <CalendarTodayIcon className="headerIcon" />
              <h3>Date & Duration</h3>
            </div>
            <div className="infoGrid">
              <div className="item">
                <label>Start Date</label>
                <p>January 12, 2026</p>
              </div>
              <div className="item">
                <label>End Date</label>
                <p>January 13, 2026</p>
              </div>
              <div className="item">
                <label>Total Days</label>
                <p>2 days</p>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="detailCard">
            <div className="cardHeader">
              <h3>Reason</h3>
            </div>
            <div className="textContent">
              <p>Family vacation trip to Boracay. Need time off to spend quality time with family and recharge.</p>
            </div>
          </div>

          {/* Approval Information */}
          <div className="detailCard">
            <div className="cardHeader">
              <PersonIcon className="headerIcon" />
              <h3>Approval Information</h3>
            </div>
            <div className="infoGrid">
              <div className="item">
                <label>Approved By</label>
                <p className="bold">Manager John Doe</p>
              </div>
              <div className="item">
                <label>Approved On</label>
                <p>January 6, 2026</p>
              </div>
            </div>
            <div className="commentsBox">
              <label>Comments</label>
              <p>Approved. Enjoy your vacation!</p>
            </div>
          </div>

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
                  <p className="date">January 5, 2026 at 10:30 AM</p>
                </div>
              </div>
              <div className="timelineItem last">
                <div className="marker green"><CheckCircleIcon className="icon"/></div>
                <div className="content">
                  <p className="status">Request Approved</p>
                  <p className="date">January 6, 2026</p>
                  <p className="sub">by Manager John Doe</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RequestDetails;