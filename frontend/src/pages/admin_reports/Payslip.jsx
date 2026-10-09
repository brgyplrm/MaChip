import React, { useRef, useState, useEffect } from "react";
import "./payslip.scss";
import Sidebar from "../../components/Sidebar";
import PrintIcon from "@mui/icons-material/Print";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useParams, Link, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { fetchWithAuth } from "../../utils/api";

const Payslip = () => {
  const { id } = useParams(); // Using 'id' from App.jsx route /adminReports/payslip/:id
  const payslipRef = useRef();
  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation(); // Initialize location

  const previousTab = location.state?.fromTab || "attendance";

  useEffect(() => {
    const fetchPayrollDetails = async () => {
      setLoading(true);
      try {
        const response = await fetchWithAuth(`/api/payroll/${id}`);
        const data = await response.json();
        if (response.ok) {
          setPayroll(data);
        }
      } catch (error) {
        console.error("Error fetching payroll details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchPayrollDetails();
    }
  }, [id]);

  // PDF Export Logic
  const handleDownloadPDF = async () => {
    const element = payslipRef.current;
    const canvas = await html2canvas(element, { 
      scale: 2, 
      useCORS: true,
      logging: false
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Payslip_${payroll?.user_LastName}_${id}.pdf`);
  };

  const formatMoney = (val) => {
    return `₱${parseFloat(val || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) return (
  <div className="home payslipPage">
    <Sidebar>
    <div className="homeContainer">
      <div className="payslipWrapper skeletonWrapper">
        <div className="headerActions">
          <div className="skeletonTitle"></div>
          <div className="skeletonButton"></div>
        </div>
        
        {/* Skeleton Payslip Card */}
        <div className="payslipCard skeletonCard">
          <div className="skeletonCompanyHeader"></div>
          <div className="skeletonEmployeeInfo">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeletonInfoRow"></div>
            ))}
          </div>
          <div className="skeletonTable"></div>
          <div className="skeletonSignature"></div>
        </div>
      </div>
    </div>
    </Sidebar>
  </div>
);

  // Payslip.jsx - Update the !payroll conditional
// Payslip.jsx
if (!payroll) return (
  <div className="home payslipPage">
    <Sidebar>
    <div className="homeContainer">
      <div className="payslipWrapper errorState">
        <div className="errorContent">
          <div className="iconCircle">
            <ReceiptLongIcon className="errorIcon" />
            <div className="errorOverlay">!</div>
          </div>
          <h2>Payslip Not Found</h2>
          <p>
            We couldn't find a payroll record for <strong>ID: {id}</strong>. 
            It may have been deleted, or the ID in the URL is incorrect.
          </p>
          <div className="errorActions">
            <Link to={"/adminReports"}><button className="backBtn">
              Go Back
            </button></Link>
            {/*<Link to="/adminReports" state={{ activeTab: "payroll" }} className="reportBtn">
              View Payroll Reports
            </Link>*/}
          </div>
        </div>
      </div>
    </div>
    </Sidebar>
  </div>
);

  return (
    <div className="home payslipPage">
      <Sidebar>
      <div className="homeContainer">
        <div className="payslipWrapper">
          <div className="headerActions">
            <div className="titleWithBack">
              <Link to="/adminReports" state={{ activeTab: previousTab }} className="backLink">
                <ChevronLeft className="backIcon h-6 w-6" />
              </Link>
              <h1>Payslip Preview</h1>
            </div>
            <button className="downloadBtn" onClick={handleDownloadPDF}>
              <PrintIcon /> Export to PDF
            </button>
          </div>

          {/* This section is captured by html2canvas */}
          <div className="payslipScrollArea">
            <div className="payslipCard" ref={payslipRef}>
            <div className="companyHeader">
              <h2>MAC-J INT'L., FORWARDING LTD., CO.</h2>
              <p>Unit 201, 2nd Floor, Ma. Natividad Bldg., 1007 M.H. Del Pilar St., Ermita, Manila</p>
            </div>

            <div className="employeeInfo">
              <div className="row">
                <div className="label">Employee name</div><div className="dots">:</div><div className="val">{payroll.user_FirstName} {payroll.user_LastName}</div>
              </div>
              <div className="row">
                <div className="label">Payroll period</div><div className="dots">:</div><div className="val">{new Date(payroll.period_Start).toLocaleDateString('en-US', { month: 'long', day: '2-digit' }).toUpperCase()} - {new Date(payroll.period_End).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }).toUpperCase()}</div>
              </div>
              <div className="row">
                <div className="label">Account Number</div><div className="dots">:</div><div className="val">{payroll.accountNo || "—"}</div>
              </div>
              <div className="row">
                <div className="label">Number of Days</div><div className="dots">:</div><div className="val">{payroll.NoDays_Worked}</div>
              </div>
            </div>

            <table className="payslipTable">
              <thead>
                <tr>
                  <th>EARNINGS</th><th>Hrs</th><th>Amount</th>
                  <th>DEDUCTIONS</th><th>Hrs/Mins</th><th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Pay this period</td><td>{payroll.NoHrs_Worked}</td><td>{formatMoney(payroll.basicPay)}</td>
                  <td>Absences</td><td>{payroll.absence_Hrs || "0"}</td><td>{formatMoney(payroll.absence_Amnt)}</td>
                </tr>
                <tr>
                  <td>Overtime pay</td><td>{payroll.OT_Hrs || "0"}</td><td>{formatMoney(payroll.OT_Amnt)}</td>
                  <td>Tardiness</td><td>{payroll.tardiness_Mins || "0"}m</td><td>{formatMoney(payroll.tardiness_Amnt)}</td>
                </tr>
                <tr>
                  <td>Restday OT</td><td>{payroll.restDay_OT_Hrs || "0"}</td><td>{formatMoney(payroll.restDay_OT_Amnt)}</td>
                  <td>SSS</td><td></td><td>{formatMoney(payroll.SSS_Ded)}</td>
                </tr>
                <tr>
                  <td>Night Differential</td><td>{payroll.nightDiff_Hrs || "0"}</td><td>{formatMoney(payroll.nightDiff_Amnt)}</td>
                  <td>Philhealth</td><td></td><td>{formatMoney(payroll.Philhealth_Ded)}</td>
                </tr>
                <tr>
                  <td>Special Holiday</td><td>{payroll.specialHol_Hrs || "0"}</td><td>{formatMoney(payroll.specialHol_Amnt)}</td>
                  <td>HDMF</td><td></td><td>{formatMoney(payroll.HDMF_Ded)}</td>
                </tr>
                <tr>
                  <td>Incentives</td><td></td><td>{formatMoney(payroll.incentives)}</td>
                  <td>Tax</td><td></td><td>{formatMoney(payroll.Tax_Ded)}</td>
                </tr>
                <tr>
                  <td>Allowance</td><td></td><td>{formatMoney(payroll.allowance)}</td>
                  <td>SSS Loan</td><td></td><td>{formatMoney(payroll.SSS_Loan)}</td>
                </tr>
                <tr>
                  <td>Bonus</td><td></td><td>{formatMoney(payroll.Bonus)}</td>
                  <td>HDMF Loan</td><td></td><td>{formatMoney(payroll.HDMF_Loan)}</td>
                </tr>
                <tr>
                  <td>Others</td><td></td><td>{formatMoney(payroll.Other_Earnings)}</td>
                  <td>Others</td><td></td><td>{formatMoney(payroll.Other_Deductions)}</td>
                </tr>
                <tr className="subtotal">
                  <td><strong>Total Pay</strong></td><td></td><td><strong>{formatMoney(payroll.totalEarnings)}</strong></td>
                  <td>Total deduction</td><td></td><td>{formatMoney(payroll.totalDeductions)}</td>
                </tr>
                <tr className="netPayRow">
                  <td colSpan="3"></td>
                  <td><strong>Net Pay</strong></td><td></td><td className="underline"><strong>{formatMoney(payroll.netPay)}</strong></td>
                </tr>
              </tbody>
            </table>

            <div className="ytdSection mt-8 border-t pt-4">
              <p className="text-[10px] font-bold mb-2">YEAR-TO-DATE (YTD) SUMMARY</p>
              <table className="w-full text-[10px] border-collapse">
                <tbody>
                  <tr>
                    <td className="border border-slate-200 p-2 w-1/2">YTD Gross Earnings</td>
                    <td className="border border-slate-200 p-2 text-right font-bold">{formatMoney(payroll.ytdGross)}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 p-2 w-1/2">YTD Total Non-Taxable</td>
                    <td className="border border-slate-200 p-2 text-right font-bold">{formatMoney(payroll.ytdNonTaxable)}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 p-2 w-1/2">YTD Total Deductions</td>
                    <td className="border border-slate-200 p-2 text-right font-bold">({formatMoney(payroll.ytdDeductions)})</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 p-2 w-1/2">YTD BIR (Withholding Tax)</td>
                    <td className="border border-slate-200 p-2 text-right font-bold">({formatMoney(payroll.ytdBIR)})</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="signatureSection mt-8">
              <p>RECEIVED BY:</p>
              <div className="signatureLine"></div>
              <p className="employeeName">{payroll.user_FirstName} {payroll.user_LastName}</p>
            </div>
          </div>
          </div>
        </div>
      </div>
      </Sidebar>
    </div>
  );
};

export default Payslip;