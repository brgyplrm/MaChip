import React, { useState, useEffect } from "react";
import "./permanentDeleteModal.scss";
import CloseIcon from "@mui/icons-material/Close";
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

const PermanentDeleteModal = ({ isOpen, onClose, onConfirm, itemName, loading, error, onClearError }) => {
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmPhrase("");
      setAdminPassword("");
      setShowPassword(false);
      if (onClearError) onClearError();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isPhraseValid = confirmPhrase.trim().toLowerCase() === "delete user";
  const canSubmit = isPhraseValid && adminPassword.trim().length > 0 && !loading;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;
    onConfirm({ password: adminPassword });
  };

  return (
    <div className="permModalOverlay">
      <div className="permModalContainer">
        <div className="permModalHeader">
          <div className="iconTitle">
            <div className="warningCircle">
              <ReportProblemIcon className="warningIcon" />
            </div>
            <h2>Permanent Deletion</h2>
          </div>
          <button className="closeBtn" onClick={onClose} disabled={loading}>
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="permModalBody">
            <p className="mainPrompt">
              Are you sure you want to permanently delete <strong>{itemName}</strong>?
            </p>

            <div className="warningNoticeBox">
              <div className="boxHeader">
                <ReportProblemIcon className="smallWarningIcon" />
                <h3>Warning: This action cannot be undone</h3>
              </div>
              <ul>
                <li>All user data will be permanently removed</li>
                <li>This record cannot be recovered or restored</li>
                <li>Associated RFID cards and access logs will remain</li>
              </ul>
            </div>

            {/* Step 1: Passphrase confirmation */}
            <div className="confirmationField">
              <label className="fieldLabel">
                To confirm, please type <span className="highlightPhrase">"Delete User"</span> below:
              </label>
              <div className="inputWrapper">
                <input
                  type="text"
                  className={`textInput ${isPhraseValid ? "validPhrase" : ""}`}
                  placeholder='Type "Delete User" to continue'
                  value={confirmPhrase}
                  onChange={(e) => {
                    setConfirmPhrase(e.target.value);
                    if (error && onClearError) onClearError();
                  }}
                  disabled={loading}
                  autoFocus
                />
                {isPhraseValid && (
                  <span className="validBadge">✓ Match</span>
                )}
              </div>
            </div>

            {/* Step 2: Admin Password Verification */}
            <div className="confirmationField">
              <label className="fieldLabel">
                Enter your Admin Password to authenticate:
              </label>
              <div className="passwordInputWrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`textInput ${error ? "errorInput" : ""}`}
                  placeholder="Enter your login password"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    if (error && onClearError) onClearError();
                  }}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="toggleVisibilityBtn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  disabled={loading}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <VisibilityOffIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <VisibilityIcon sx={{ fontSize: 18 }} />
                  )}
                </button>
              </div>
              {error && (
                <div className="errorMessage">
                  <ReportProblemIcon sx={{ fontSize: 14 }} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="permModalActions">
            <button type="button" className="cancelBtn" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="deleteBtn"
              disabled={!canSubmit}
            >
              {loading ? "Verifying & Deleting..." : "Yes, Permanently Delete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PermanentDeleteModal;
