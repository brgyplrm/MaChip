import React, { useRef, useState, useEffect } from "react";
import "./payslip.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import PrintIcon from "@mui/icons-material/Print";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useParams, Link, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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

  if (loading) return (
    <div className="home payslipPage">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="payslipWrapper">
          <p>Loading payslip...</p>
        </div>
      </div>
    </div>
  );

  if (!payroll) return (
    <div className="home payslipPage">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="payslipWrapper">
          <p>Payslip not found.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="home payslipPage">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="payslipWrapper">
          <div className="headerActions">
            <div className="titleWithBack">
              <Link to="/adminReports" state={{ activeTab: previousTab }} className="backLink">
                <ArrowBackIcon className="backIcon" />
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
                  <td>Pay this period</td><td>{payroll.NoHrs_Worked}</td><td>{parseFloat(payroll.basicPay).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td>Absences</td><td>{payroll.absence_Hrs || "0"}</td><td>{parseFloat(payroll.absence_Amnt || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr>
                  <td>Overtime pay</td><td>{payroll.OT_Hrs || "0"}</td><td>{parseFloat(payroll.OT_Amnt || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td>Tardiness</td><td>{payroll.tardiness_Mins || "0"}m</td><td>{parseFloat(payroll.tardiness_Amnt || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr>
                  <td>Restday OT</td><td>{payroll.restDay_OT_Hrs || "0"}</td><td>{parseFloat(payroll.restDay_OT_Amnt || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td>SSS</td><td></td><td>{parseFloat(payroll.SSS_Ded || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr>
                  <td>Night Differential</td><td>{payroll.nightDiff_Hrs || "0"}</td><td>{parseFloat(payroll.nightDiff_Amnt || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td>Philhealth</td><td></td><td>{parseFloat(payroll.Philhealth_Ded || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr>
                  <td>Special Holiday</td><td>{payroll.specialHol_Hrs || "0"}</td><td>{parseFloat(payroll.specialHol_Amnt || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td>HDMF</td><td></td><td>{parseFloat(payroll.HDMF_Ded || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr>
                  <td>Incentives</td><td></td><td>{parseFloat(payroll.incentives || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td>Tax</td><td></td><td>{parseFloat(payroll.Tax_Ded || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr>
                  <td>Allowance</td><td></td><td>{parseFloat(payroll.allowance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td>SSS Loan</td><td></td><td>{parseFloat(payroll.SSS_Loan || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr>
                  <td>Bonus</td><td></td><td>{parseFloat(payroll.Bonus || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td>HDMF Loan</td><td></td><td>{parseFloat(payroll.HDMF_Loan || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr>
                  <td>Others</td><td></td><td>{parseFloat(payroll.Other_Earnings || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td>Others</td><td></td><td>{parseFloat(payroll.Other_Deductions || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr className="subtotal">
                  <td><strong>Total Pay</strong></td><td></td><td><strong>{parseFloat(payroll.totalEarnings).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></td>
                  <td>Total deduction</td><td></td><td>{parseFloat(payroll.totalDeductions).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr className="netPayRow">
                  <td colSpan="3"></td>
                  <td><strong>Net Pay</strong></td><td></td><td className="underline"><strong>{parseFloat(payroll.netPay).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></td>
                </tr>
              </tbody>
            </table>

            <div className="signatureSection">
              <p>RECEIVED BY:</p>
              <div className="signatureLine"></div>
              <p className="employeeName">{payroll.user_FirstName} {payroll.user_LastName}</p>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payslip;