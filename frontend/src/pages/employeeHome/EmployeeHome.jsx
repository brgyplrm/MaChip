import React, { useState, useEffect } from "react";
import "./employeeHome.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import HistoryIcon from '@mui/icons-material/History';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import Toast from "../../components/toast/Toast";
import { Link } from "react-router-dom";
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';

const EmployeeHome = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [leaveBalance, setLeaveBalance] = useState({
    VL_total: 7, VL_used: 0, VL_balance: 7,
    SL_total: 7, SL_used: 0, SL_balance: 7,
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "success" });

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!userData?.user_Id) return;
      try {
        const [balanceRes, requestsRes, notifRes] = await Promise.all([
          fetch(`/api/request/balance/${userData.user_Id}`),
          fetch(`/api/request/${userData.user_Id}`),
          fetch(`/api/notifications/unread-count/${userData.user_Id}`)
        ]);

        if (balanceRes.ok) setLeaveBalance(await balanceRes.json());
        if (requestsRes.ok) {
          const data = await requestsRes.json();
          setRecentRequests(data.slice(0, 3));
        }
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          if (notifData.count > 0) {
            setToast({
              message: `You have ${notifData.count} unread notification(s).`,
              type: "success"
            });
          }
        }
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [userData?.user_Id]);

  return (
    <div className="home">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ ...toast, message: "" })} 
        />
        <div className="contentWrapper">
          
          {/* Top Section: Attendance Overview (Restored) */}
          <div className="statsHeader">
            <div className="statCardGroup">
                <div className="statCircle">
                    <CircularProgressbar 
                        value={1} maxValue={30} text="1" 
                        styles={buildStyles({ pathColor: `#ff4d4f`, textColor: '#2A174E', trailColor: '#eee' })}
                    />
                    <span className="label">Days Absent</span>
                </div>
                <div className="statCircle">
                    <CircularProgressbar 
                        value={70} maxValue={200} text={`70`} 
                        styles={buildStyles({ pathColor: `#FFA500`, textColor: '#2A174E' })}
                    />
                    <span className="label">Late Arrival (Mins)</span>
                </div>
                <div className="statCircle">
                    <CircularProgressbar 
                        value={8} maxValue={10} text="8" 
                        styles={buildStyles({ pathColor: `#22c55e`, textColor: '#2A174E' })}
                    />
                    <span className="label">On-Time</span>
                </div>
            </div>

            <div className="statProgressBars">
                <h3 className="sectionTitle">Attendance Overview</h3>
                <div className="progressItem">
                    <div className="info"><span>Absent</span><span className="count">1 / 30</span></div>
                    <div className="bar"><div className="fill absent" style={{width: '3%'}}></div></div>
                </div>
                <div className="progressItem">
                    <div className="info"><span>Late Arrival</span><span className="count">70 / 200</span></div>
                    <div className="bar"><div className="fill late" style={{width: '35%'}}></div></div>
                </div>
                <div className="progressItem">
                    <div className="info"><span>On-Time</span><span className="count">8 / 10</span></div>
                    <div className="bar"><div className="fill ontime" style={{width: '80%'}}></div></div>
                </div>
            </div>
          </div>

          <div className="middleSection">
            {/* Recent Activity Card */}
           <div className="dashboardCard activityCard">
            <div className="cardHeader">
              <div className="titleGroup">
                <HistoryIcon className="icon" />
                <span>Recent Attendance Activity</span>
              </div>
              <Link to="/accessLogs">
                <button className="viewAll">
                  See History
                </button>
              </Link>
              
            </div>
            <div className="activityList">
              <p style={{padding: '10px', color: '#64748b', fontSize: '13px'}}>Recent logs will appear here...</p>
            </div>
          </div>

            {/* Leave Consumption Card (Dynamic) */}
            <div className="dashboardCard leaveCard">
              <h3 className="sectionTitle">Consumed Leave Types</h3>
              <p className="subText">Track your Vacation (VL) and Sick (SL) leave balance.</p>
              <div className="leaveChart">
                {loading ? (
                    <div className="bars">
                        <div className="skeleton box" style={{height: '60px', marginBottom: '15px'}}></div>
                        <div className="skeleton box" style={{height: '60px'}}></div>
                    </div>
                ) : (
                    <div className="bars">
                        <div className="progressItem">
                            <div className="info">
                            <span>Vacation Leave (VL)</span>
                            <span className="count">
                                {Math.min(leaveBalance.VL_used, leaveBalance.VL_total)} / {leaveBalance.VL_total}
                            </span>
                            </div>
                            <div className="bar">
                            <div className="fill vl" style={{width: `${Math.min((leaveBalance.VL_used / leaveBalance.VL_total) * 100, 100)}%`}}></div>
                            </div>
                        </div>
                        <div className="progressItem">
                            <div className="info">
                            <span>Sick Leave (SL)</span>
                            <span className="count">
                                {Math.min(leaveBalance.SL_used, leaveBalance.SL_total)} / {leaveBalance.SL_total}
                            </span>
                            </div>
                            <div className="bar">
                            <div className="fill sl" style={{width: `${Math.min((leaveBalance.SL_used / leaveBalance.SL_total) * 100, 100)}%`}}></div>
                            </div>
                        </div>
                    </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Leaves Section */}
          <div className="leavesSection">
            <div className="sectionHeader">
              <h3>My Leave Requests</h3>
              <Link to="/requests">
                <button className="applyBtn">
                  Apply for a leave <ChevronRightOutlinedIcon className="icon" />
                </button>
              </Link>
            </div>
            
            {loading ? (
              <div className="skeletonList">
                  <div className="skeleton box" style={{height: '80px', marginBottom: '15px'}}></div>
                  <div className="skeleton box" style={{height: '80px', marginBottom: '15px'}}></div>
                  <div className="skeleton box" style={{height: '80px'}}></div>
              </div>
            ) : recentRequests.length > 0 ? (
              recentRequests.map(req => (
                <div className={`leaveLog ${req.status?.toLowerCase()}`} key={req.emp_reqId}>
                  {req.status?.toLowerCase().includes("approve") ? <CheckCircleIcon className="statusIcon" /> : 
                   req.status?.toLowerCase().includes("reject") ? <CancelIcon className="statusIcon" /> : 
                   <HourglassEmptyIcon className="statusIcon" />}
                  <div className="text">
                    <p className="date">{req.VL_StartDate || req.SL_StartDate} - {req.VL_EndDate || req.SL_EndDate}</p>
                    <p className="desc">{req.reqTypeName}: {req.remarks || "No description"}</p>
                  </div>
                  <span className="badge">{req.status}</span>
                </div>
              ))
            ) : (
              <p>No recent leave requests.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeHome;