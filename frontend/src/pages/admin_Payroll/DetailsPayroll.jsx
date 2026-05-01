import React, { useState, useEffect } from "react";
import "./detailsPayroll.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ListAltIcon from "@mui/icons-material/ListAlt";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";

const PayrollDetails = () => {
  const navigate = useNavigate();
  const { payrollId } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const periodStart = queryParams.get("start");
  const periodEnd = queryParams.get("end");

  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const fetchPayrollDetails = async () => {
      setLoading(true);
      try {
        if (payrollId.startsWith("live-") || payrollId.startsWith("preview-")) {
          const userId = payrollId.split("-")[1];
          const empRes = await fetchWithAuth(`/api/users/${userId}`);
          const emp = await empRes.json();
          const prevRes = await fetchWithAuth(`/api/payroll/preview?user_Id=${userId}&period_Start=${periodStart}&period_End=${periodEnd}`);
          const preview = await prevRes.json();

          if (empRes.ok && prevRes.ok) {
            setPayroll({
              payrollId: "LIVE-PREVIEW",
              user_FirstName: emp.user_FirstName,
              user_LastName: emp.user_LastName,
              user_Id: emp.user_Id,
              dailyRate: preview.dailyRate,
              ratePerHr: preview.ratePerHr,
              period_Start: periodStart,
              period_End: periodEnd,
              NoDays_Worked: preview.NoDays_Worked,
              NoHrs_Worked: preview.NoHrs_Worked,
              basicPay: preview.basicPay,
              OT_Hrs: preview.OT_Hrs,
              OT_Amnt: preview.OT_Amnt,
              legalHol_Amnt: preview.legalHol_Amnt,
              specialHol_Amnt: preview.specialHol_Amnt,
              totalEarnings: preview.totalEarnings,
              absence_Hrs: preview.absence_Days * 8,
              absence_Amnt: preview.absence_Amnt,
              tardiness_Mins: preview.tardiness_Mins,
              tardiness_Amnt: preview.tardiness_Amnt,
              unpaidLeave_Days: preview.unpaidLeave_Days,
              unpaidLeave_Amnt: preview.unpaidLeave_Amnt,
              paidLeave_Days: preview.paidLeave_Days,
              SSS_Ded: preview.SSS_Ded,
              Philhealth_Ded: preview.Philhealth_Ded,
              HDMF_Ded: preview.HDMF_Ded,
              Tax_Ded: preview.Tax_Ded,
              healthCard_Amnt: preview.healthCard_Amnt,
              SSS_Loan: preview.SSS_Loan,
              HDMF_Loan: preview.HDMF_Loan,
              calamityLoan_Amnt: preview.calamityLoan_Amnt,
              advances_Amnt: preview.advances_Amnt,
              globe_Deduction: preview.globe_Deduction,
              multiPurposeSavings: preview.multiPurposeSavings,
              totalDeductions: preview.totalDeductions,
              netPay: preview.netPay,
              PaystatusName: "Draft",
              incentives: preview.incentives || 0,
              allowance: preview.allowance || 0
            });
          }
        } else {
          const response = await fetchWithAuth(`/api/payroll/${payrollId}`);
          const data = await response.json();
          if (response.ok) setPayroll(data);
        }
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };
    if (payrollId) fetchPayrollDetails();
  }, [payrollId, periodStart, periodEnd]);

  if (loading) return <div className="home payrollDetails"><Sidebar /><div className="homeContainer"><Navbar /><div className="detailsWrapper">Loading...</div></div></div>;
  if (!payroll) return <div className="home payrollDetails"><Sidebar /><div className="homeContainer"><Navbar /><div className="detailsWrapper">Not Found.</div></div></div>;

  // ── Helper: Safe Deduction Parsing ──────────────────────────────────────
  const eeSSS = parseFloat(payroll.SSS_Ded || 0);
  const eePH  = parseFloat(payroll.Philhealth_Ded || 0);
  const eeHD  = parseFloat(payroll.HDMF_Ded || 0);
  const eeTax = parseFloat(payroll.Tax_Ded || 0);
  
  const basicPay = parseFloat(payroll.basicPay || 0);
  const holidayAdj = parseFloat(payroll.specialHol_Adj || 0);
  const otherEarnings = parseFloat(payroll.totalEarnings || 0) - basicPay + holidayAdj;
  const tardinessDeds = parseFloat(payroll.absence_Amnt || 0) + parseFloat(payroll.tardiness_Amnt || 0) + parseFloat(payroll.unpaidLeave_Amnt || 0);
  const govtDeds = eeSSS + eePH + eeHD;
  const otherDeds = parseFloat(payroll.totalDeductions || 0) - tardinessDeds - govtDeds;

  // ── Calculation Trail Flow Logic ─────────────────────────────────────────
  const renderTrail = () => {
    if (activeTab === 'overview') return null;

    const items = [];
    let runningTotal = basicPay;

    // 1. Always show Basic Pay
    items.push({ label: "Basic Pay", value: basicPay });

    // 2. Earnings Tab and beyond
    if (['earnings', 'tardiness', 'govt', 'other'].includes(activeTab)) {
      runningTotal += otherEarnings;
      items.push({ operator: "+", label: "Other Earnings", value: otherEarnings });

      if (holidayAdj > 0) {
        runningTotal -= holidayAdj;
        items.push({ operator: "-", label: "Hol. Adjustment", value: holidayAdj, isRed: true });
      }
    }

    // 3. Tardiness Tab and beyond
    if (['tardiness', 'govt', 'other'].includes(activeTab)) {
      runningTotal -= tardinessDeds;
      items.push({ operator: "-", label: "Tardiness", value: tardinessDeds, isRed: true });
    }

    // 4. Govt Tab and beyond
    if (['govt', 'other'].includes(activeTab)) {
      runningTotal -= govtDeds;
      items.push({ operator: "-", label: "Govt Deds", value: govtDeds, isRed: true });
    }

    // 5. Other Tab (Final)
    if (activeTab === 'other') {
      runningTotal -= otherDeds;
      items.push({ operator: "-", label: "Other Deds/Tax", value: otherDeds, isRed: true });
    }

    return (
      <div className="calculationTrail">
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {item.operator && <div className="trailOperator">{item.operator}</div>}
            <div className={`trailItem ${item.isRed ? 'red' : ''}`}>
              <span>{item.label}</span>
              <p>₱{item.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </React.Fragment>
        ))}
        <div className="trailOperator">=</div>
        <div className="trailItem net">
          <span>{activeTab === 'other' ? 'Net Pay' : 'Current Total'}</span>
          <p>₱{runningTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>
    );
  };

  // ── Helper: Mock Employer Shares (if not in DB) ───────────────────────────
  const calculateErSSS = (ee) => {
    if (!ee || ee <= 0) return 0;
    const msc = ee / 0.05;
    const ec = msc >= 15000 ? 30 : 10;
    return Math.round((msc * 0.10 + ec) * 100) / 100;
  };
  const erSSS = calculateErSSS(eeSSS);
  const erPH  = eePH;
  const erHD  = Math.min(eeHD, 200); 

  return (
    <div className="home payrollDetails">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="detailsWrapper">
          <div className="pageHeader">
            <div className="left">
              <div className="titleWithBack">
                <ArrowBackIcon className="backLink" onClick={() => navigate(-1)} />
                <div className="titleText">
                  <h1>{payroll.user_FirstName} {payroll.user_LastName}</h1>
                  <span>Payroll ID: {payroll.payrollId} • {new Date(payroll.period_Start).toLocaleDateString()} to {new Date(payroll.period_End).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <span className={`statusBadge ${payroll.PaystatusName?.toLowerCase()}`}>{payroll.PaystatusName}</span>
          </div>

          <div className="tabs">
            <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}><PersonOutlineIcon /> Overview</button>
            <button className={activeTab === 'earnings' ? 'active' : ''} onClick={() => setActiveTab('earnings')}><TrendingUpIcon /> Earnings</button>
            <button className={activeTab === 'tardiness' ? 'active' : ''} onClick={() => setActiveTab('tardiness')}><AccessTimeIcon /> Tardiness</button>
            <button className={activeTab === 'govt' ? 'active' : ''} onClick={() => setActiveTab('govt')}><AccountBalanceIcon /> Govt Deductions</button>
            <button className={activeTab === 'other' ? 'active' : ''} onClick={() => setActiveTab('other')}><ListAltIcon /> Other Deductions</button>
          </div>

          {renderTrail()}

          <div className="tabContent">
            {activeTab === 'overview' && (
              <div className="grid">
                <div className="detailCard">
                  <h3>Employment Info</h3>
                  <div className="row"><span>Employee ID</span><p>{formatUserId(payroll.user_Id)}</p></div>
                  <div className="row"><span>Daily Rate</span><p>₱{parseFloat(payroll.dailyRate).toLocaleString()}</p></div>
                  <div className="row"><span>Hourly Rate</span><p>₱{parseFloat(payroll.ratePerHr).toLocaleString()}</p></div>
                </div>
                <div className="detailCard">
                  <h3>Work Summary</h3>
                  <div className="row"><span>Days Worked</span><p>{payroll.NoDays_Worked}</p></div>
                  <div className="row"><span>Hours Worked</span><p>{payroll.NoHrs_Worked}</p></div>
                  <div className="row"><span>Tardiness</span><p>{payroll.tardiness_Mins} mins</p></div>
                </div>
                <div className="netPaySummary">
                  <div className="item"><span>Total Earnings</span><p>₱{parseFloat(payroll.totalEarnings).toLocaleString()}</p></div>
                  <div className="item minus"><span>Total Deductions</span><p>-₱{parseFloat(payroll.totalDeductions).toLocaleString()}</p></div>
                  <div className="item total"><span>Net Pay</span><p>₱{parseFloat(payroll.netPay).toLocaleString()}</p></div>
                </div>
              </div>
            )}

            {activeTab === 'earnings' && (
              <div className="breakdownCard">
                <div className="row"><span>Basic Pay</span><p>₱{parseFloat(payroll.basicPay).toLocaleString()}</p></div>
                {parseFloat(payroll.specialHol_Adj || 0) > 0 && (
                  <div className="row">
                    <span>Special Holiday Adjustment</span>
                    <p className="neg">-₱{parseFloat(payroll.specialHol_Adj).toLocaleString()}</p>
                  </div>
                )}
                <div className="row"><span>Overtime Pay ({payroll.OT_Hrs} hrs)</span><p>₱{parseFloat(payroll.OT_Amnt || 0).toLocaleString()}</p></div>
                <div className="row"><span>Regular Holiday Pay</span><p>₱{parseFloat(payroll.legalHol_Amnt || 0).toLocaleString()}</p></div>
                <div className="row"><span>Special Holiday Pay</span><p>₱{parseFloat(payroll.specialHol_Amnt || 0).toLocaleString()}</p></div>
                <div className="row"><span>Incentives</span><p>₱{parseFloat(payroll.incentives || 0).toLocaleString()}</p></div>
                <div className="row"><span>Allowance</span><p>₱{parseFloat(payroll.allowance || 0).toLocaleString()}</p></div>
              </div>
            )}

            {activeTab === 'tardiness' && (
              <div className="breakdownCard">
                <h3>Attendance Deductions</h3>
                <div className="row">
                  <span>Absences ({payroll.absence_Hrs / 8} days)</span>
                  <p className="neg">-₱{parseFloat(payroll.absence_Amnt || 0).toLocaleString()}</p>
                </div>
                <div className="row">
                  <span>Tardiness ({payroll.tardiness_Mins} mins)</span>
                  <p className="neg">-₱{parseFloat(payroll.tardiness_Amnt || 0).toLocaleString()}</p>
                </div>
                <div className="row">
                  <span>Unpaid Leave ({payroll.unpaidLeave_Days} days)</span>
                  <p className="neg">-₱{parseFloat(payroll.unpaidLeave_Amnt || 0).toLocaleString()}</p>
                </div>
                <div className="totalHighlightRow">
                  <span>Total Tardiness Deduction</span>
                  <p>₱{tardinessDeds.toLocaleString()}</p>
                </div>
              </div>
            )}

            {activeTab === 'govt' && (
              <div className="govtTableWrapper">
                <table className="govtTable">
                  <thead>
                    <tr>
                      <th>Deduction Name</th>
                      <th>Employee Share</th>
                      <th>Employer Share</th>
                      <th>Total Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>SSS Contribution</td>
                      <td>₱{eeSSS.toLocaleString()}</td>
                      <td>₱{erSSS.toLocaleString()}</td>
                      <td className="bold">₱{(eeSSS + erSSS).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>PhilHealth</td>
                      <td>₱{eePH.toLocaleString()}</td>
                      <td>₱{erPH.toLocaleString()}</td>
                      <td className="bold">₱{(eePH + erPH).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>HDMF (Pag-IBIG)</td>
                      <td>₱{eeHD.toLocaleString()}</td>
                      <td>₱{erHD.toLocaleString()}</td>
                      <td className="bold">₱{(eeHD + erHD).toLocaleString()}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="totalRow">
                      <td>Total Government</td>
                      <td className="empTotal">₱{(eeSSS + eePH + eeHD).toLocaleString()}</td>
                      <td>₱{(erSSS + erPH + erHD).toLocaleString()}</td>
                      <td>₱{(eeSSS + eePH + eeHD + erSSS + erPH + erHD).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {activeTab === 'other' && (
              <div className="breakdownCard">
                <div className="row highlightTax"><span>Withholding Tax</span><p>₱{eeTax.toLocaleString()}</p></div>
                <div className="row"><span>Health Card (Maxicare)</span><p>₱{parseFloat(payroll.healthCard_Amnt || 0).toLocaleString()}</p></div>
                <div className="row"><span>SSS Loan</span><p>₱{parseFloat(payroll.SSS_Loan || 0).toLocaleString()}</p></div>
                <div className="row"><span>HDMF Loan</span><p>₱{parseFloat(payroll.HDMF_Loan || 0).toLocaleString()}</p></div>
                <div className="row"><span>Calamity Loan</span><p>₱{parseFloat(payroll.calamityLoan_Amnt || 0).toLocaleString()}</p></div>
                <div className="row"><span>Advances to Employees</span><p>₱{parseFloat(payroll.advances_Amnt || 0).toLocaleString()}</p></div>
                <div className="row"><span>Globe Deduction</span><p>₱{parseFloat(payroll.globe_Deduction || 0).toLocaleString()}</p></div>
                <div className="row"><span>Multi-Purpose Savings</span><p>₱{parseFloat(payroll.multiPurposeSavings || 0).toLocaleString()}</p></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollDetails;
