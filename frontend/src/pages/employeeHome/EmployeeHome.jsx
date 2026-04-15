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
import { fetchWithAuth } from "../../utils/api";

const EmployeeHome = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [dashboardStats, setDashboardStats] = useState({
    attendance: { absent: 0, onTime: 0, late: 0, monthName: "" },
    leaveBalance: { VL_total: 7, VL_used: 0, VL_balance: 7, SL_total: 7, SL_used: 0, SL_balance: 7 },
    recentLogs: [],
    monthlyRequests: []
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "success" });

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!userData?.user_Id) return;
      try {
        const [statsRes, notifRes] = await Promise.all([
          fetchWithAuth(`/api/attendance/employee-dashboard/${userData.user_Id}`),
          fetchWithAuth(`/api/notifications/unread-count/${userData.user_Id}`)
        ]);

        if (statsRes.ok) {
          setDashboardStats(await statsRes.json());
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

    window.addEventListener("dataRefresh", fetchDashboardData);
    return () => window.removeEventListener("dataRefresh", fetchDashboardData);
  }, [userData?.user_Id]);

  const att = dashboardStats.attendance;
  const balance = dashboardStats.leaveBalance;
  const recentRequests = dashboardStats.monthlyRequests;
  const totalTrackedDays = att.absent + att.onTime + att.late || 1;

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
          
          {/* Top Section: Attendance Overview */}
          <div className="statsHeader">
            <div className="statCardGroup">
                <div className="statCircle">
                    <CircularProgressbar 
                        value={att.absent} maxValue={20} text={`${att.absent}`} 
                        styles={buildStyles({ pathColor: `#ff4d4f`, textColor: '#2A174E', trailColor: '#eee' })}
                    />
                    <span className="label">Days Absent</span>
                </div>
                <div className="statCircle">
                    <CircularProgressbar 
                        value={att.late} maxValue={20} text={`${att.late}`} 
                        styles={buildStyles({ pathColor: `#FFA500`, textColor: '#2A174E' })}
                    />
                    <span className="label">Late Arrivals</span>
                </div>
                <div className="statCircle">
                    <CircularProgressbar 
                        value={att.onTime} maxValue={20} text={`${att.onTime}`} 
                        styles={buildStyles({ pathColor: `#22c55e`, textColor: '#2A174E' })}
                    />
                    <span className="label">On-Time</span>
                </div>
            </div>

            <div className="statProgressBars">
                <h3 className="sectionTitle">Attendance Overview ({att.monthName})</h3>
                <div className="progressItem">
                    <div className="info"><span>Absent</span><span className="count">{att.absent} day(s)</span></div>
                    <div className="bar"><div className="fill absent" style={{width: `${(att.absent/totalTrackedDays)*100}%`}}></div></div>
                </div>
                <div className="progressItem">
                    <div className="info"><span>Late</span><span className="count">{att.late} day(s)</span></div>
                    <div className="bar"><div className="fill late" style={{width: `${(att.late/totalTrackedDays)*100}%`}}></div></div>
                </div>
                <div className="progressItem">
                    <div className="info"><span>On-Time / On-Field</span><span className="count">{att.onTime} day(s)</span></div>
                    <div className="bar"><div className="fill ontime" style={{width: `${(att.onTime/totalTrackedDays)*100}%`}}></div></div>
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
              {dashboardStats.recentLogs.length > 0 ? (
                dashboardStats.recentLogs.map((log, idx) => (
                  <div className="activityRow" key={idx}>
                    <div className="userAvatar">{userData.user_FirstName?.charAt(0)}</div>
                    <div className="logDetails">
                      <div className="mainInfo">
                        <p className="name">{new Date(log.date).toLocaleDateString(undefined, {weekday: 'long', month: 'short', day: 'numeric'})}</p>
                      </div>
                      <p className="subInfo">{log.timeIn} to {log.timeOut}</p>
                    </div>
                    <div className="logTime">
                      <span className={`statusBadge ${log.status.toLowerCase().includes('time') || log.status.toLowerCase().includes('field') ? 'in' : 'out'}`}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{padding: '10px', color: '#64748b', fontSize: '13px'}}>No recent logs found.</p>
              )}
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
                                {Math.min(balance.VL_used, balance.VL_total)} / {balance.VL_total}
                            </span>
                            </div>
                            <div className="bar">
                            <div className="fill vl" style={{width: `${Math.min((balance.VL_used / balance.VL_total) * 100, 100)}%`}}></div>
                            </div>
                        </div>
                        <div className="progressItem">
                            <div className="info">
                            <span>Sick Leave (SL)</span>
                            <span className="count">
                                {Math.min(balance.SL_used, balance.SL_total) || 0} / {balance.SL_total}
                            </span>
                            </div>
                            <div className="bar">
                            <div className="fill sl" style={{width: `${Math.min((balance.SL_used / balance.SL_total) * 100, 100) || 0}%`}}></div>
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
              <h3>My Requests</h3>
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
              recentRequests.map(req => {
                let dateDisplay = "";
                if (req.emp_reqTypeId === 1) dateDisplay = req.OT_DateOf;
                else if (req.emp_reqTypeId === 2) dateDisplay = req.DateonField;
                else dateDisplay = `${req.VL_StartDate || req.SL_StartDate} to ${req.VL_EndDate || req.SL_EndDate}`;

                return (
                  <div className={`leaveLog ${req.status?.toLowerCase()}`} key={req.emp_reqId}>
                    {req.status?.toLowerCase().includes("approve") ? <CheckCircleIcon className="statusIcon" /> : 
                     req.status?.toLowerCase().includes("reject") ? <CancelIcon className="statusIcon" /> : 
                     <HourglassEmptyIcon className="statusIcon" />}
                    <div className="text">
                      <p className="date">{dateDisplay}</p>
                      <p className="desc">{req.reqTypeName}: {req.remarks || "No description"}</p>
                    </div>
                    <span className="badge">{req.status}</span>
                  </div>
                );
              })
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