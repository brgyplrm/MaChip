import React from "react";
import "./processPayrollModal.scss";
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import GroupIcon from '@mui/icons-material/Group';

const ProcessPayrollModal = ({ isOpen, onClose, onConfirm, employeeCount = 15 }) => {
  if (!isOpen) return null;

  return (
    <div className="modalOverlay">
      <div className="confirmCard">
        <div className="warningHeader">
          <div className="warningCircle">
            <WarningAmberIcon />
          </div>
          <h2>Confirm Payroll Processing</h2>
        </div>

        <div className="confirmContent">
          <div className="infoBox">
            <GroupIcon className="icon" />
            <span>You are about to process payroll for <strong>{employeeCount} employees</strong>.</span>
          </div>
          <p className="warningText">
            This action <strong>cannot be undone</strong>. Once processed, all calculations for this period will be finalized and the record will be locked.
          </p>
        </div>

        <div className="actionButtons">
          <button className="cancelBtn" onClick={onClose}>Cancel</button>
          <button className="processBtn" onClick={onConfirm}>Process Batch</button>
        </div>
      </div>
    </div>
  );
};

export default ProcessPayrollModal;