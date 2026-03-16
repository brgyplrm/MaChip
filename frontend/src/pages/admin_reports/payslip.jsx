import React, { useRef } from "react";
import "./payslip.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import PrintIcon from "@mui/icons-material/Print";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const Payslip = () => {
  const payslipRef = useRef();

  // PDF Export Logic
  const handleDownloadPDF = async () => {
    const element = payslipRef.current;
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("Employee_Payslip.pdf");
  };

  return (
    <div className="home payslipPage">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="payslipWrapper">
          <div className="headerActions">
            <h1>Payslip Preview</h1>
            <button className="downloadBtn" onClick={handleDownloadPDF}>
              <PrintIcon /> Export to PDF
            </button>
          </div>

          {/* This section is captured by html2canvas */}
          <div className="payslipCard" ref={payslipRef}>
            <div className="companyHeader">
              <h2>MAC-J INT'L., FORWARDING LTD., CO.</h2>
            </div>

            <div className="employeeInfo">
              <div className="row">
                <div className="label">Employee name</div><div className="dots">:</div><div className="val">Kathleen Pinto</div>
              </div>
              <div className="row">
                <div className="label">Payroll period</div><div className="dots">:</div><div className="val">JANUARY 01-15, 2026</div>
              </div>
              <div className="row">
                <div className="label">Account Number</div><div className="dots">:</div><div className="val">1234567890</div>
              </div>
              <div className="row">
                <div className="label">Number of Days</div><div className="dots">:</div><div className="val">13</div>
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
                  <td>Pay this period</td><td>104.00</td><td>10,000.00</td>
                  <td>Absences</td><td>-</td><td>-</td>
                </tr>
                <tr>
                  <td>Overtime pay</td><td>17.00</td><td>2,043.27</td>
                  <td>Tardiness</td><td>265.00</td><td>424.68</td>
                </tr>
                <tr>
                  <td>Leave Credits</td><td>-</td><td>-</td>
                  <td>SSS</td><td></td><td>1,000.00</td>
                </tr>
                <tr>
                  <td>Restday OT</td><td>-</td><td>-</td>
                  <td>Philhealth</td><td></td><td>500.00</td>
                </tr>
                <tr>
                  <td>Night Differential</td><td>-</td><td>-</td>
                  <td>HDMF</td><td></td><td>300.00</td>
                </tr>
                <tr>
                  <td>Rest day pay</td><td>-</td><td>-</td>
                  <td>HDMF saving</td><td></td><td>500.00</td>
                </tr>
                <tr>
                  <td>Special Holiday</td><td>-</td><td>-</td>
                  <td>SSS loan</td><td></td><td>922.90</td>
                </tr>
                <tr>
                  <td>Incentives</td><td>-</td><td>-</td>
                  <td>Health Card</td><td></td><td>487.72</td>
                </tr>
                <tr>
                  <td>Allowance</td><td>-</td><td>-</td>
                  <td>Advances</td><td></td><td>0.00</td>
                </tr>
                <tr className="subtotal">
                  <td><strong>Total Pay</strong></td><td></td><td><strong>12,043.27</strong></td>
                  <td>Total deduction</td><td></td><td>4,911.30</td>
                </tr>
                <tr className="netPayRow">
                  <td colSpan="3"></td>
                  <td><strong>Net Pay</strong></td><td></td><td className="underline"><strong>7,131.97</strong></td>
                </tr>
              </tbody>
            </table>

            <div className="signatureSection">
              <p>RECEIVED BY:</p>
              <div className="signatureLine"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payslip;