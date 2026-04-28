import React from "react";
import "./featured.scss";
import { CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpOutlinedIcon from "@mui/icons-material/KeyboardArrowUpOutlined";

const Featured = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="featured">
        <div className="top">
          <h1 className="title">Daily Attendance Summary</h1>
        </div>
        <div className="bottom">
          <p>Loading summary...</p>
        </div>
      </div>
    );
  }

  const presentCount = stats.onTimeCount + stats.lateArrivalsCount;
  const attendancePercentage = stats.totalEmployees > 0 
    ? Math.round((presentCount / stats.totalEmployees) * 100) 
    : 0;

  return (
    <div className="featured">
      <div className="top">
        <h1 className="title">Daily Attendance Summary</h1>
      </div>
      <div className="bottom">
        <div className="featuredChart">
          <CircularProgressbar 
            value={attendancePercentage} 
            text={`${attendancePercentage}%`} 
            strokeWidth={5} 
          />
        </div>
        <p className="title">Employees Present</p>
        <p className="amount">{presentCount}/{stats.totalEmployees}</p>
        <p className="desc">
          Today's real-time attendance data.
        </p>
        <div className="summary">
          <div className="item">
            <div className="itemTitle">Absentees</div>
            <div className="itemResult negative">
              <KeyboardArrowDownIcon fontSize="small"/>
              <div className="resultAmount">{stats.absentCount}</div>
            </div>
          </div>
          <div className="item">
            <div className="itemTitle">On Leave</div>
            <div className="itemResult positive">
              <KeyboardArrowUpOutlinedIcon fontSize="small"/>
              <div className="resultAmount">{stats.onLeaveCount}</div>
            </div>
          </div>
          <div className="item">
            <div className="itemTitle">Late Arrivals</div>
            <div className="itemResult negative">
              <KeyboardArrowDownIcon fontSize="small"/>
              <div className="resultAmount">{stats.lateArrivalsCount}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Featured;
