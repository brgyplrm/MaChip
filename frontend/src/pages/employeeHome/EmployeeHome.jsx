import "./employeeHome.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import HistoryIcon from '@mui/icons-material/History';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

const EmployeeHome = () => {
  return (
    <div className="home">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="contentWrapper">
          
          {/* Enhanced Top Circular Stats Section */}
          <div className="statsHeader">
            <div className="statCardGroup">
                <div className="statCircle">
                    <CircularProgressbar 
                        value={3} maxValue={30} text="1" 
                        styles={buildStyles({ pathColor: `#2A174E`, textColor: '#2A174E', trailColor: '#eee' })}
                    />
                    <span className="label">Days Absent</span>
                </div>
                <div className="statCircle">
                    <CircularProgressbar 
                        value={70} maxValue={200} text={`70\nmins`} 
                        styles={buildStyles({ 
                        pathColor: `#FFA500`, 
                        textColor: '#2A174E',
                        // Ensure the font size is appropriate for multi-line text
                        textSize: '22px' 
                    })}
                    />
                    <span className="label">Late Arrival</span>
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
                    <div className="bar"><div className="fill absent" style={{width: '10%'}}></div></div>
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
              <button className="viewAll">See History</button>
            </div>
            
            <div className="activityList">
              {/* In production, map through your fetched 'rows' state here */}
              {[1, 2, 3].map((item) => (
                <div className="activityRow" key={item}>
                  <div className="userAvatar">
                    {/* Visual initial for quicker identification */}
                    <span>K</span> 
                  </div>
                  <div className="logDetails">
                    <div className="mainInfo">
                      <p className="name">Kathleen Pinto</p>
                      <span className="userId">MACJ-001</span>
                    </div>
                    <p className="subInfo">Declarant • Main Office</p>
                  </div>
                  <div className="logTime">
                    {/* Status badge and timestamp grouped together */}
                    <span className="statusBadge in">Clock In</span>
                    <span className="timestamp">12:00:12 PM</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

            {/* Leave Consumption Card */}
            <div className="dashboardCard leaveCard">
              <h3 className="sectionTitle">Consumed Leave Types</h3>
              <p className="subText">Track your Vacation (VL) and Sick (SL) leave balance.</p>
              <div className="leaveChart">
                <div className="bars">
                    <div className="progressItem">
                        <div className="info"><span>Vacation Leave (VL)</span><span className="count">8/10</span></div>
                        <div className="bar"><div className="fill vl" style={{width: '80%'}}></div></div>
                    </div>
                    <div className="progressItem">
                        <div className="info"><span>Sick Leave (SL)</span><span className="count">2/10</span></div>
                        <div className="bar"><div className="fill sl" style={{width: '20%'}}></div></div>
                    </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Leaves Section */}
          <div className="leavesSection">
            <div className="sectionHeader">
              <h3>My Leave Requests</h3>
              <button className="applyBtn">Apply for a leave <ArrowRightAltIcon /></button>
            </div>
            <div className="leaveLog approved">
              <CheckCircleIcon className="statusIcon" />
              <div className="text">
                <p className="date">Jan 12 - Jan 13, 2024</p>
                <p className="desc">Family Vacation Trip</p>
              </div>
              <span className="badge">Approved</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeHome;