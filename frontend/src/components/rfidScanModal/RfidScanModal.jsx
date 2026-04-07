import React from "react";
import "./rfidScanModal.scss";
import CloseIcon from "@mui/icons-material/Close";
import SensorsIcon from '@mui/icons-material/Sensors'; // Radar-like icon
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const RfidScanModal = ({ isOpen, onClose, onRescan, scannedId, error, currentId }) => {
  if (!isOpen) return null;

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
            ) : (
              <SensorsIcon className="mainIcon pulse" />
            )}
            <div className="ripple"></div>
          </div>

          <h2>{error ? "Scan Error" : scannedId ? "MaChip Detected!" : "Ready to Scan"}</h2>
          <p>
            {error 
              ? error 
              : scannedId 
                ? "The RFID card has been successfully linked." 
                : "Please tap the employee's MaChip on the RFID reader to continue."}
          </p>

          <div className="idResultContainer">
            {/* Current ID Box (If applicable) */}
            {currentId && (
              <div className="idResultBox current">
                <label>Current MaChip ID</label>
                <div className="idValue">{currentId}</div>
              </div>
            )}

            {/* ID Display Box */}
            <div className={`idResultBox ${error ? "error" : scannedId ? "visible" : ""}`}>
              <label>{error ? "Conflict detected" : scannedId ? "New MaChip ID" : "Detected MaChip ID"}</label>
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
                <button className="confirmBtn" onClick={onClose}>
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