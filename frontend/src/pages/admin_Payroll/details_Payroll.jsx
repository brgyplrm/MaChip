import "./detailsPayroll.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import { useNavigate } from "react-router-dom";

const PayrollDetails = () => {
  const navigate = useNavigate();

  return (
    <div className="home payrollDetails">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="detailsWrapper">
          {/* Header Section */}
          <div className="pageHeader">
            <div className="left">
              <ArrowBackIcon className="backIcon" onClick={() => navigate(-1)} />
              <div className="titleText">
                <h1>Payroll Details</h1>
                <span>Payroll ID: 1</span>
              </div>
            </div>
            <span className="statusBadge paid">Paid</span>
          </div>

          {/* Employee Information Card */}
          <div className="detailCard">
            <div className="cardHeader">
              <PersonOutlineIcon className="icon" />
              <h3>Employee Information</h3>
            </div>
            <div className="infoGrid">
              <div className="infoItem">
                <label>Employee Name</label>
                <p>Kathleen Pinto</p>
              </div>
              <div className="infoItem">
                <label>Employee ID</label>
                <p>1</p>
              </div>
              <div className="infoItem">
                <label>Rate Per Hour</label>
                <p>₱150</p>
              </div>
            </div>
          </div>

          {/* Pay Period Card */}
          <div className="detailCard">
            <div className="cardHeader">
              <CalendarTodayIcon className="icon" />
              <h3>Pay Period</h3>
            </div>
            <div className="infoGrid">
              <div className="infoItem">
                <label>Period Start</label>
                <p>3/1/2026</p>
              </div>
              <div className="infoItem">
                <label>Period End</label>
                <p>3/15/2026</p>
              </div>
              <div className="infoItem">
                <label>Days Worked</label>
                <p>10 days</p>
              </div>
              <div className="infoItem">
                <label>Hours Worked</label>
                <p>80 hours</p>
              </div>
            </div>
          </div>

          {/* Earnings Breakdown Card */}
          <div className="detailCard breakdown">
            <div className="cardHeader">
              <TrendingUpIcon className="icon earnings" />
              <h3>Earnings Breakdown</h3>
            </div>
            <div className="breakdownList">
              <div className="row"><span>Basic Pay</span><p>₱12,000</p></div>
              <div className="row"><span>Overtime (5 hrs)</span><p>₱1,125</p></div>
              <div className="row"><span>Rest Day OT (2 hrs)</span><p>₱600</p></div>
              <div className="row"><span>Night Differential (8 hrs)</span><p>₱400</p></div>
              <div className="row"><span>Special Holiday Pay</span><p>₱500</p></div>
              <div className="row"><span>Incentives</span><p>₱200</p></div>
              <div className="totalRow earnings">
                <span>Total Earnings</span>
                <p>₱15,500</p>
              </div>
            </div>
          </div>

          {/* Deductions Breakdown Card */}
          <div className="detailCard breakdown">
            <div className="cardHeader">
              <TrendingDownIcon className="icon deductions" />
              <h3>Deductions Breakdown</h3>
            </div>
            <div className="breakdownList">
              <div className="row"><span>Absence (4 hrs)</span><p>₱600</p></div>
              <div className="row"><span>Tardiness (120 mins)</span><p>₱300</p></div>
              <div className="row"><span>Unpaid Leave (0.5 days)</span><p>₱300</p></div>
              <div className="totalRow deductions">
                <span>Total Deductions</span>
                <p>₱1,200</p>
              </div>
            </div>
          </div>

          {/* Net Pay Highlight */}
          <div className="netPayCard">
            <div className="text">
              <label>Net Pay</label>
              <p>₱14,300</p>
            </div>
            <AttachMoneyIcon className="bgIcon" />
          </div>

          {/* Record Information */}
          <div className="recordInfo">
            <div className="item">
              <label>Created At</label>
              <p>3/15/2026, 6:00:00 PM</p>
            </div>
            <div className="item">
              <label>Last Updated</label>
              <p>3/15/2026, 6:00:00 PM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollDetails;