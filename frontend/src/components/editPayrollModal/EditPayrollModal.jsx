import React, { useState, useEffect } from "react";
import "./editPayrollModal.scss";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import CalculateIcon from "@mui/icons-material/Calculate";
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
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ── Automatic Calculation ──────────────────────────────────────────────────
  useEffect(() => {
    const rate = parseFloat(sanitize(formData.dailyRate));
    if (!isNaN(rate) && rate > 0) {
      if (!loading) {
        const timer = setTimeout(() => {
          handleCalculateGovt();
        }, 1000); // Debounce to avoid too many requests
        return () => clearTimeout(timer);
      }
    }
  }, [formData.dailyRate]);
  // ──────────────────────────────────────────────────────────────────────────

  const sanitize = (val) => {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val.replace(/,/g, "");
    return val;
  };

  const handleCalculateGovt = async () => {
    setLoading(true);
    try {
      const gross = sanitize(formData.totalEarnings) || (parseFloat(sanitize(formData.dailyRate)) * 26);
      const userId = formData.user_Id;
      
      const response = await fetchWithAuth(`/api/payroll/govt-deductions-preview?grossPay=${gross}&user_Id=${userId}`);
      const result = await response.json();
      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          SSS_Ded: result.SSS_Ded,
          Philhealth_Ded: result.Philhealth_Ded,
          HDMF_Ded: result.HDMF_Ded,
          Tax_Ded: result.Tax_Ded
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
    // Sanitize all numeric fields before sending
    const sanitized = {};
    Object.keys(formData).forEach(key => {
      sanitized[key] = sanitize(formData[key]);
    });
    onSave(sanitized);
  };

  if (!isOpen) return null;

  return (
    <div className="editPayrollModalOverlay">
      <div className="editPayrollModal">
        <div className="modalHeader">
          <h2>Edit Employee Compensation</h2>
          <button className="closeBtn" onClick={onClose}><CloseIcon /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modalBody">
            {/* ── DAILY RATE ── */}
            <section className="modalSection">
              <div className="sectionTitle">
                <span className="dot"></span>
                <h3>DAILY RATE</h3>
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
                      value={parseFloat(data?.dailyRate || 0).toLocaleString()} 
                      disabled 
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ── GOVT DEDUCTIONS ── */}
            <section className="modalSection">
              <div className="sectionTitle">
                <span className="dot blue"></span>
                <h3>GOVT DEDUCTIONS</h3>
                <button type="button" className="calcBtn" onClick={handleCalculateGovt} disabled={loading}>
                  <CalculateIcon sx={{ fontSize: 16 }} /> {loading ? "..." : "Auto-Compute"}
                </button>
              </div>
              <div className="inputGrid">
                <div className="field">
                  <label>SSS</label>
                  <input type="text" name="SSS_Ded" value={formData.SSS_Ded} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>PhilHealth</label>
                  <input type="text" name="Philhealth_Ded" value={formData.Philhealth_Ded} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>HDMF (Pag-IBIG)</label>
                  <input type="text" name="HDMF_Ded" value={formData.HDMF_Ded} onChange={handleChange} />
                </div>
              </div>
            </section>

            {/* ── OTHER DEDUCTIONS ── */}
            <section className="modalSection">
              <div className="sectionTitle">
                <span className="dot orange"></span>
                <h3>OTHER DEDUCTIONS</h3>
              </div>
              <div className="inputGrid">
                <div className="field highlightField">
                  <label>Withholding Tax</label>
                  <input type="text" name="Tax_Ded" value={formData.Tax_Ded} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Health Card</label>
                  <input type="text" name="healthCard_Amnt" value={formData.healthCard_Amnt} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>SSS Loan</label>
                  <input type="text" name="SSS_Loan" value={formData.SSS_Loan} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>HDMF Loan</label>
                  <input type="text" name="HDMF_Loan" value={formData.HDMF_Loan} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Calamity Loan</label>
                  <input type="text" name="calamityLoan_Amnt" value={formData.calamityLoan_Amnt} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Advances</label>
                  <input type="text" name="advances_Amnt" value={formData.advances_Amnt} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Globe</label>
                  <input type="text" name="globe_Deduction" value={formData.globe_Deduction} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Eastwest</label>
                  <input type="text" name="eastwest_Loan" value={formData.eastwest_Loan} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Multi-Purpose</label>
                  <input type="text" name="multiPurposeSavings" value={formData.multiPurposeSavings} onChange={handleChange} />
                </div>
              </div>
            </section>
          </div>

          <div className="modalFooter">
            <button type="button" className="cancelBtn" onClick={onClose}>Cancel</button>
            <button type="submit" className="saveBtn"><CheckIcon /> Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPayrollModal;
