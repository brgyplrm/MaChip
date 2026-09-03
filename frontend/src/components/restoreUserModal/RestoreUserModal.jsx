import React from "react";
import "./restoreUserModal.scss";
import CloseIcon from "@mui/icons-material/Close";
import RestoreIcon from "@mui/icons-material/Restore";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

const RestoreUserModal = ({ isOpen, onClose, onConfirm, itemName, userId, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="restoreModalOverlay">
      <div className="restoreModalContainer">
        <div className="restoreModalHeader">
          <div className="iconTitle">
            <div className="restoreCircle">
              <RestoreIcon className="restoreIcon" />
            </div>
            <h2>Restore Account</h2>
          </div>
          <button className="closeBtn" onClick={onClose} disabled={loading}>
            <CloseIcon />
          </button>
        </div>

        <div className="restoreModalBody">
          <p className="mainPrompt">
            Are you sure you want to restore <strong>{itemName}</strong>{userId ? ` (${userId})` : ""}?
          </p>

          <div className="restoreNoticeBox">
            <div className="boxHeader">
              <CheckCircleOutlineIcon className="smallNoticeIcon" />
              <h3>Reactivation Details</h3>
            </div>
            <ul>
              <li>User profile will be returned to active employee listings</li>
              <li>The employee will regain access to login and system requests</li>
              <li>Existing payroll, attendance, and biometric records remain intact</li>
            </ul>
          </div>
        </div>

        <div className="restoreModalActions">
          <button className="cancelBtn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="restoreBtn" onClick={onConfirm} disabled={loading}>
            {loading ? "Restoring..." : "Yes, Restore Account"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestoreUserModal;
