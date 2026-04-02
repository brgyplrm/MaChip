import React, { useState, useEffect } from "react";
import "./detailsPayroll.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";

const PayrollDetails = () => {
  const navigate = useNavigate();
  const { payrollId } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const periodStart = queryParams.get("start");
  const periodEnd = queryParams.get("end");

  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayrollDetails = async () => {
      setLoading(true);
      try {
        if (payrollId.startsWith("live-") || payrollId.startsWith("preview-")) {
          const userId = payrollId.split("-")[1];
          // 1. Get Employee Info
          const empRes = await fetch(`/api/users/${userId}`);
          const emp = await empRes.json();

          // 2. Get Live Preview
          const prevRes = await fetch(`/api/payroll/preview?user_Id=${userId}&period_Start=${periodStart}&period_End=${periodEnd}`);
          const preview = await prevRes.json();

          if (empRes.ok && prevRes.ok) {
            const ratePerHr = emp.dailyRate / 8;
            const ratePerMin = ratePerHr / 60;
            const combinedAbsences = (preview.absence_Days || 0) + (preview.unpaidLeave_Days || 0);
            const daysWorked = (preview.totalScheduledDays || 0) - combinedAbsences;
            const basicPay = daysWorked * 8 * ratePerHr;
            const otPay = (preview.OT_Hrs || 0) * ratePerHr;
            const tardinessDed = (preview.tardiness_Mins || 0) * ratePerMin;
            const absenceDed = combinedAbsences * emp.dailyRate;

            setPayroll({
              payrollId: "LIVE-PREVIEW",
              user_FirstName: emp.user_FirstName,
              user_LastName: emp.user_LastName,
              user_Id: emp.user_Id,
              ratePerHr: ratePerHr,
              dailyRate: emp.dailyRate,
              period_Start: periodStart,
              period_End: periodEnd,
              NoDays_Worked: daysWorked,
              NoHrs_Worked: daysWorked * 8,
              basicPay: basicPay,
              OT_Hrs: preview.OT_Hrs,
              OT_Amnt: otPay,
              totalEarnings: basicPay + otPay,
              absence_Hrs: combinedAbsences * 8,
              absence_Amnt: absenceDed,
              tardiness_Mins: preview.tardiness_Mins,
              tardiness_Amnt: tardinessDed,
              unpaidLeave_Days: preview.unpaidLeave_Days,
              unpaidLeave_Amnt: preview.unpaidLeave_Days * emp.dailyRate,
              paidLeave_Days: preview.paidLeave_Days,
              totalDeductions: tardinessDed + absenceDed,
              netPay: (basicPay + otPay) - (tardinessDed + absenceDed),
              PaystatusName: "Draft",
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        } else {
          // Standard DB fetch
          const response = await fetch(`/api/payroll/${payrollId}`);
          const data = await response.json();
          if (response.ok) {
            setPayroll(data);
          }
        }
      } catch (error) {
        console.error("Error fetching payroll details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (payrollId) {
      fetchPayrollDetails();
    }
  }, [payrollId, periodStart, periodEnd]);

  if (loading) return (
    <div className="home payrollDetails">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="detailsWrapper">
          <p>Loading payroll details...</p>
        </div>
      </div>
    </div>
  );

  if (!payroll) return (
    <div className="home payrollDetails">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="detailsWrapper">
          <p>Payroll record not found.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="home payrollDetails">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="detailsWrapper">
          {/* Header Section */}
          <div className="pageHeader">
            <div className="left">
              <div className="titleWithBack">
                <ArrowBackIcon className="backLink" onClick={() => navigate(-1)} />
                <div className="titleText">
                  <h1>Payroll Details</h1>
                  <span>Payroll ID: {payroll.payrollId}</span>
                </div>
              </div>
            </div>
            <span className={`statusBadge ${payroll.PaystatusName?.toLowerCase()}`}>
              {payroll.PaystatusName}
            </span>
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
                <p>{payroll.user_FirstName} {payroll.user_LastName}</p>
              </div>
              <div className="infoItem">
                <label>Employee ID</label>
                <p>{formatUserId(payroll.user_Id)}</p>
              </div>
              <div className="infoItem">
                <label>Rate Per Hour</label>
                <p>₱{parseFloat(payroll.ratePerHr).toLocaleString()}</p>
              </div>
              <div className="infoItem">
                <label>Daily Rate</label>
                <p>₱{parseFloat(payroll.dailyRate || 0).toLocaleString()}</p>
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
                <p>{new Date(payroll.period_Start).toLocaleDateString()}</p>
              </div>
              <div className="infoItem">
                <label>Period End</label>
                <p>{new Date(payroll.period_End).toLocaleDateString()}</p>
              </div>
              <div className="infoItem">
                <label>Days Worked</label>
                <p>{payroll.NoDays_Worked} days</p>
              </div>
              <div className="infoItem">
                <label>Hours Worked</label>
                <p>{payroll.NoHrs_Worked} hours</p>
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
              <div className="row"><span>Basic Pay</span><p>₱{parseFloat(payroll.basicPay).toLocaleString()}</p></div>
              <div className="row"><span>Overtime ({payroll.OT_Hrs} hrs)</span><p>₱{parseFloat(payroll.OT_Amnt || 0).toLocaleString()}</p></div>
              {payroll.restDay_OT_Amnt > 0 && <div className="row"><span>Rest Day OT ({payroll.restDay_OT_Hrs} hrs)</span><p>₱{parseFloat(payroll.restDay_OT_Amnt).toLocaleString()}</p></div>}
              {payroll.nightDiff_Amnt > 0 && <div className="row"><span>Night Differential ({payroll.nightDiff_Hrs} hrs)</span><p>₱{parseFloat(payroll.nightDiff_Amnt).toLocaleString()}</p></div>}
              {payroll.specialHol_Amnt > 0 && <div className="row"><span>Special Holiday Pay</span><p>₱{parseFloat(payroll.specialHol_Amnt).toLocaleString()}</p></div>}
              {payroll.incentives > 0 && <div className="row"><span>Incentives</span><p>₱{parseFloat(payroll.incentives).toLocaleString()}</p></div>}
              {payroll.allowance > 0 && <div className="row"><span>Allowance</span><p>₱{parseFloat(payroll.allowance).toLocaleString()}</p></div>}
              <div className="totalRow earnings">
                <span>Total Earnings</span>
                <p>₱{parseFloat(payroll.totalEarnings).toLocaleString()}</p>
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
              <div className="row"><span>Absence ({payroll.absence_Hrs} hrs)</span><p>₱{parseFloat(payroll.absence_Amnt || 0).toLocaleString()}</p></div>
              <div className="row"><span>Tardiness ({payroll.tardiness_Mins} mins)</span><p>₱{parseFloat(payroll.tardiness_Amnt || 0).toLocaleString()}</p></div>
              {payroll.unpaidLeave_Amnt > 0 && <div className="row"><span>Unpaid Leave ({payroll.unpaidLeave_Days} days)</span><p>₱{parseFloat(payroll.unpaidLeave_Amnt).toLocaleString()}</p></div>}
              {payroll.paidLeave_Days > 0 && <div className="row"><span>Paid Leave ({payroll.paidLeave_Days} days)</span><p><i>(Covered)</i></p></div>}
              <div className="totalRow deductions">
                <span>Total Deductions</span>
                <p>₱{parseFloat(payroll.totalDeductions).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Net Pay Highlight */}
          <div className="netPayCard">
            <div className="text">
              <label>Net Pay</label>
              <p>₱{parseFloat(payroll.netPay).toLocaleString()}</p>
            </div>
            <AttachMoneyIcon className="bgIcon" />
          </div>

          {/* Record Information */}
          <div className="recordInfo">
            <div className="item">
              <label>Created At</label>
              <p>{new Date(payroll.createdAt).toLocaleString()}</p>
            </div>
            <div className="item">
              <label>Last Updated</label>
              <p>{new Date(payroll.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollDetails;