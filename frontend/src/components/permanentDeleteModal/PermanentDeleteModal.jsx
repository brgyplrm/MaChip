import React from "react";
import "./permanentDeleteModal.scss";
import CloseIcon from "@mui/icons-material/Close";
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

const PermanentDeleteModal = ({ isOpen, onClose, onConfirm, itemName }) => {
  if (!isOpen) return null;

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
          <button className="closeBtn" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

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
        </div>

        <div className="permModalActions">
          <button className="cancelBtn" onClick={onClose}>Cancel</button>
          <button className="deleteBtn" onClick={onConfirm}>
            Yes, Permanently Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermanentDeleteModal;