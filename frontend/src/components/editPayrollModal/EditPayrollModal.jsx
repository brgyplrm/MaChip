import React, { useState, useEffect } from "react";
import "./editPayrollModal.scss";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import { fetchWithAuth } from "../../utils/api";

const EditPayrollModal = ({ isOpen, onClose, data, onSave, isMasterlist = false }) => {
  const [formData, setFormData] = useState({
    dailyRate: "",
    SSS_Ded: "",
    Philhealth_Ded: "",
    HDMF_Ded: "",
    Tax_Ded: "",
    healthCard_Amnt: "",
    SSS_Loan: "",
    HDMF_Loan: "",
    calamityLoan_Amnt: "",
    advances_Amnt: "",
    globe_Deduction: "",
    eastwest_Loan: "",
    multiPurposeSavings: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data) {
      setFormData({
        ...data,
        dailyRate: data.dailyRate ?? "",
        SSS_Ded: data.SSS_Ded ?? data.sss_Share ?? "",
        Philhealth_Ded: data.Philhealth_Ded ?? data.philhealth_Share ?? "",
        HDMF_Ded: data.HDMF_Ded ?? data.hdmf_Share ?? "",
        Tax_Ded: data.Tax_Ded ?? data.tax_Share ?? "",
        healthCard_Amnt: data.healthCard_Amnt ?? "",
        SSS_Loan: data.SSS_Loan ?? "",
        HDMF_Loan: data.HDMF_Loan ?? "",
        calamityLoan_Amnt: data.calamityLoan_Amnt ?? "",
        advances_Amnt: data.advances_Amnt ?? "",
        globe_Deduction: data.globe_Deduction ?? "",
        eastwest_Loan: data.eastwest_Loan ?? "",
        multiPurposeSavings: data.multiPurposeSavings ?? "",
      });
    }
  }, [data]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Only dailyRate can be modified by user
    if (name === "dailyRate") {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // ── Automatic Calculation for Govt Deductions based on daily rate ──────────
  useEffect(() => {
    const rate = parseFloat(sanitize(formData.dailyRate));
    if (!isNaN(rate) && rate > 0) {
      if (!loading) {
        const timer = setTimeout(() => {
          handleCalculateGovt();
        }, 1000); // Debounce to avoid excessive requests
        return () => clearTimeout(timer);
      }
    }
  }, [formData.dailyRate]);

  const sanitize = (val) => {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val.replace(/,/g, "");
    return val;
  };

  const formatAmount = (val) => {
    if (val === null || val === undefined || val === "") return "0.00";
    const num = parseFloat(String(val).replace(/,/g, ""));
    return isNaN(num) ? "0.00" : num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleCalculateGovt = async () => {
    setLoading(true);
    try {
      const gross = sanitize(formData.totalEarnings) || (parseFloat(sanitize(formData.dailyRate)) * 26);
      const userId = formData.user_Id;
      
      const response = await fetchWithAuth(`/api/payroll/govt-deductions-preview?grossPay=${gross}&user_Id=${userId}`);
      const result = await response.json();
      if (response.ok) {
        setFormData((prev) => ({
          ...prev,
          SSS_Ded: result.SSS_Ded,
          Philhealth_Ded: result.Philhealth_Ded,
          HDMF_Ded: result.HDMF_Ded,
          Tax_Ded: result.Tax_Ded,
        }));
      }
    } catch (error) {
      console.error("Calculation error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Sanitize numeric fields before sending
    const sanitized = {};
    Object.keys(formData).forEach((key) => {
      sanitized[key] = sanitize(formData[key]);
    });
    onSave(sanitized);
  };

  if (!isOpen) return null;

  const totalLoans =
    (parseFloat(formData.SSS_Loan) || 0) +
    (parseFloat(formData.HDMF_Loan) || 0) +
    (parseFloat(formData.calamityLoan_Amnt) || 0) +
    (parseFloat(formData.advances_Amnt) || 0) +
    (parseFloat(formData.eastwest_Loan) || 0) +
    (parseFloat(formData.globe_Deduction) || 0) +
    (parseFloat(formData.multiPurposeSavings) || 0) +
    (parseFloat(formData.healthCard_Amnt) || 0);

  const formatUserId = (id) => "MACJ-" + String(id || "").padStart(3, "0");

  return (
    <div className="editPayrollModalOverlay">
      <div className="editPayrollModal">
        <div className="modalHeader">
          <div>
            <h2>Edit Employee Compensation</h2>
            {data && (
              <div className="employeeSubtitle">
                <span className="empName">{data.user_FirstName} {data.user_LastName}</span>
                <span className="empDivider">•</span>
                <span className="empId">{formatUserId(data.user_Id)}</span>
                {(data.positionTitle || data.position || data.department) && (
                  <>
                    <span className="empDivider">•</span>
                    <span className="empRole">{data.positionTitle || data.position || data.department}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <button className="closeBtn" onClick={onClose} type="button">
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modalBody">
            {/* ── DAILY RATE (EDITABLE) ── */}
            <section className="modalSection">
              <div className="sectionTitle">
                <span className="dot"></span>
                <h3>DAILY RATE</h3>
                <span className="badge editable">Editable</span>
              </div>
              <div className="inputGroup row">
                <div className="field">
                  <label>New Daily Rate</label>
                  <div className="inputWrap">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="dailyRate" 
                      value={formData.dailyRate} 
                      onChange={handleChange} 
                      placeholder="0.00"
                      autoFocus
                      required
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Old Daily Rate</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      value={formatAmount(data?.dailyRate)} 
                      disabled 
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ── GOVT DEDUCTIONS (DISPLAY ONLY / AUTO-COMPUTED) ── */}
            <section className="modalSection">
              <div className="sectionTitle">
                <span className="dot blue"></span>
                <h3>GOVT DEDUCTIONS</h3>
                <span className="badge auto">Auto-Computed</span>
              </div>
              <div className="inputGrid">
                <div className="field">
                  <label>SSS</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="SSS_Ded" 
                      value={formatAmount(formData.SSS_Ded)} 
                      disabled 
                      title="Calculated automatically based on monthly formula"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>PhilHealth</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="Philhealth_Ded" 
                      value={formatAmount(formData.Philhealth_Ded)} 
                      disabled 
                      title="Calculated automatically based on monthly formula"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>HDMF (Pag-IBIG)</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="HDMF_Ded" 
                      value={formatAmount(formData.HDMF_Ded)} 
                      disabled 
                      title="Calculated automatically based on system rules"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ── ACTIVE LOANS & COMPANY DEDUCTIONS (DISPLAY ONLY) ── */}
            <section className="modalSection">
              <div className="sectionTitle">
                <span className="dot orange"></span>
                <h3>ACTIVE LOANS & COMPANY DEDUCTIONS</h3>
                <span className="badge readonly">Display Only</span>
              </div>

              {/* Total Active Loans Banner */}
              <div className="loanSummaryBanner">
                <div className="summaryInfo">
                  <span className="summaryLabel">Total Active Deductions (Per Cutoff):</span>
                  <span className="summaryValue">
                    ₱{totalLoans.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <span className={`statusBadge ${totalLoans > 0 ? "hasLoans" : "noLoans"}`}>
                  {totalLoans > 0 ? "Active Deductions" : "No Active Deductions"}
                </span>
              </div>

              {/* Active Loans Detail Cards Breakdown */}
              {data?.activeLoansList && data.activeLoansList.length > 0 && (
                <div className="activeLoansListContainer">
                  <span className="activeLoansListTitle">Active Loan Breakdown:</span>
                  <div className="activeLoansList">
                    {data.activeLoansList.map((loan, idx) => (
                      <div key={idx} className="activeLoanCard">
                        <div className="loanCardTop">
                          <span className="loanCardTitle">{loan.notes || loan.deductionType}</span>
                          <span className="loanCardBadge">{loan.status?.toUpperCase()}</span>
                        </div>
                        <div className="loanCardDetails">
                          <div className="detailRow">
                            <span className="detailLabel">Per Cutoff:</span>
                            <span className="detailVal text-purple-700">₱{formatAmount(loan.deductionPerCutoff)}</span>
                          </div>
                          <div className="detailRow">
                            <span className="detailLabel">Remaining:</span>
                            <span className="detailVal">₱{formatAmount(loan.remainingBalance)}</span>
                          </div>
                          <div className="detailRow">
                            <span className="detailLabel">Total Principal:</span>
                            <span className="detailVal">₱{formatAmount(loan.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="inputGrid">
                <div className="field highlightField">
                  <label>Withholding Tax</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="Tax_Ded" 
                      value={formatAmount(formData.Tax_Ded)} 
                      disabled 
                      title="Calculated automatically based on taxable compensation"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Health Card (HMO)</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="healthCard_Amnt" 
                      value={formatAmount(formData.healthCard_Amnt)} 
                      disabled 
                      title="Managed in the Maxicare HMO module"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>SSS Loan</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="SSS_Loan" 
                      value={formatAmount(formData.SSS_Loan)} 
                      disabled 
                      title="Active SSS Loan Amortization (Display Only)"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>HDMF (Pag-IBIG) Loan</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="HDMF_Loan" 
                      value={formatAmount(formData.HDMF_Loan)} 
                      disabled 
                      title="Active Pag-IBIG Loan Amortization (Display Only)"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Calamity Loan</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="calamityLoan_Amnt" 
                      value={formatAmount(formData.calamityLoan_Amnt)} 
                      disabled 
                      title="Active Calamity Loan Amortization (Display Only)"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Cash Advances</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="advances_Amnt" 
                      value={formatAmount(formData.advances_Amnt)} 
                      disabled 
                      title="Active Cash Advance Deduction (Display Only)"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>EastWest Loan</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="eastwest_Loan" 
                      value={formatAmount(formData.eastwest_Loan)} 
                      disabled 
                      title="Active EastWest Loan Amortization (Display Only)"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Globe Plan</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="globe_Deduction" 
                      value={formatAmount(formData.globe_Deduction)} 
                      disabled 
                      title="Active Globe Telecom Deduction (Display Only)"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Multi-Purpose</label>
                  <div className="inputWrap disabled">
                    <span className="prefix">₱</span>
                    <input 
                      type="text" 
                      name="multiPurposeSavings" 
                      value={formatAmount(formData.multiPurposeSavings)} 
                      disabled 
                      title="Active Multi-Purpose Loan Amortization (Display Only)"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="modalFooter">
            <button type="button" className="cancelBtn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="saveBtn">
              <CheckIcon fontSize="small" /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPayrollModal;
