import React from "react";
import "./rfidScanModal.scss";
import CloseIcon from "@mui/icons-material/Close";
import SensorsIcon from '@mui/icons-material/Sensors';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const RfidScanModal = ({ isOpen, onClose, onRescan, onConfirm, scannedId, error, currentId, title }) => {
  if (!isOpen) return null;

  const isFingerprint = title?.toLowerCase().includes("fingerprint");
  const modalTitle = title || (error ? "Scan Error" : scannedId ? "MaChip Detected!" : "Ready to Scan");

  return (
    <div className="rfidModalOverlay">
      <div className="rfidModalContainer">
        <button className="closeBtn" onClick={onClose}>
          <CloseIcon />
        </button>

        <div className="rfidModalContent">
          {/* Animated Scan Icon */}
          <div className={`scanIconWrapper ${error ? "error" : scannedId ? "success" : "animating"}`}>
            {error ? (
              <ErrorOutlineIcon className="mainIcon error" />
            ) : scannedId ? (
              <CheckCircleIcon className="mainIcon success" />
            ) : isFingerprint ? (
              <FingerprintIcon className="mainIcon pulse" />
            ) : (
              <SensorsIcon className="mainIcon pulse" />
            )}
            <div className="ripple"></div>
          </div>

          <h2>{modalTitle}</h2>
          <p>
            {error 
              ? error 
              : scannedId 
                ? (isFingerprint ? "The fingerprint has been successfully enrolled." : "The RFID card has been successfully linked.") 
                : isFingerprint 
                  ? "Please place the employee's finger on the sensor to begin enrollment."
                  : "Please tap the employee's MaChip on the FRONT (Clock In) reader to continue."}
          </p>

          <div className="idResultContainer">
            {/* Current ID Box (If applicable) */}
            {currentId && (
              <div className="idResultBox current">
                <label>{isFingerprint ? "Current Slot ID" : "Current MaChip ID"}</label>
                <div className="idValue">{currentId}</div>
              </div>
            )}

            {/* ID Display Box */}
            <div className={`idResultBox ${error ? "error" : scannedId ? "visible" : ""}`}>
              <label>
                {error 
                  ? "Conflict detected" 
                  : scannedId 
                    ? (isFingerprint ? "Assigned Slot ID" : "New MaChip ID") 
                    : (isFingerprint ? "Waiting for sensor..." : "Detected MaChip ID")}
              </label>
              <div className="idValue">{error ? scannedId : (scannedId || "Waiting for signal...")}</div>
            </div>
          </div>
        </div>

        <div className="rfidModalActions">
          {scannedId || error ? (
            <>
              {/* Rescan Button */}
              <button className="rescanBtn" onClick={onRescan}>
                {error ? "Try Again" : "Scan Again"}
              </button>
              {!error && (
                <button className="confirmBtn" onClick={onConfirm || onClose}>
                  Confirm
                </button>
              )}
            </>
          ) : (
            <button className="cancelBtn" onClick={onClose}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RfidScanModal;