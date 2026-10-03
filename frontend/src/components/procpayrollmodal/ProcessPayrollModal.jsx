import React from "react";
import "./processPayrollModal.scss";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import GroupIcon from "@mui/icons-material/Group";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";

const ProcessPayrollModal = ({
  isOpen,
  onClose,
  onConfirm,
  employeeCount = 15,
  mode = "release",
  periodLabel = "",
  isOverdue = false,
  loading = false,
}) => {
  if (!isOpen) return null;

  const isRelease = mode === "release";

  return (
    <div className="modalOverlay">
      <div className="confirmCard">
        <div className="warningHeader">
          <div className={`warningCircle ${isRelease ? "warningCircle--release" : "warningCircle--draft"}`}>
            {isRelease ? (
              isOverdue ? <WarningAmberIcon /> : <LockOutlinedIcon />
            ) : (
              <CalculateOutlinedIcon />
            )}
          </div>
          <h2>
            {isRelease
              ? isOverdue
                ? "Release Overdue Payroll Batch"
                : "Confirm Payroll Release & Lock"
              : "Verify Batch Calculations (Draft)"}
          </h2>
        </div>

        <div className="confirmContent">
          <div className="infoBox">
            <GroupIcon className="icon" />
            <span>
              {isRelease ? "Releasing payroll for " : "Calculating draft for "}
              <strong>{employeeCount} employees</strong>
              {periodLabel ? ` (${periodLabel})` : ""}.
            </span>
          </div>
          <p className="warningText">
            {isRelease ? (
              <>
                This action will perform a <strong>fresh recalculation and lock payroll calculations</strong>, generate encrypted PDF payslips and DTR archives, and dispatch employee notifications. Records become immutable snapshots for audit integrity.
              </>
            ) : (
              <>
                This will compute hours worked, overtime, night differential, and deductions. Records will remain in <strong>Draft status</strong> for administrator verification before payday release.
              </>
            )}
          </p>
        </div>

        <div className="actionButtons">
          <button className="cancelBtn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className={`processBtn ${isRelease && isOverdue ? "processBtn--overdue" : ""}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : isRelease
              ? isOverdue
                ? "Release & Lock Overdue Batch"
                : "Release & Lock Payroll"
              : "Generate Draft Batch"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProcessPayrollModal;