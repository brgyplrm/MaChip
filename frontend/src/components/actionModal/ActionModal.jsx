import React from "react";
import "./actionModal.scss";
import CloseIcon from "@mui/icons-material/Close";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

const ActionModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  // Do not render anything if the modal is not active
  if (!isOpen) return null;

  return (
    <div className="modalOverlay">
      <div className="modalContainer">
        {/* Close button for manual dismissal */}
        <button className="closeBtn" onClick={onClose}>
          <CloseIcon />
        </button>

        <div className="modalContent">
          <div className="iconWrapper">
            <HelpOutlineIcon className="mainIcon" />
          </div>
          
          <h2>{title || "Confirm Action"}</h2>
          <p>{message || "Are you sure you want to proceed with this action?"}</p>
          
          <div className="modalActions">
            <button className="cancelBtn" onClick={onClose}>
              Cancel
            </button>
            <button className="confirmBtn" onClick={onConfirm}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionModal;