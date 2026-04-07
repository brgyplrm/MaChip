import React from "react";
import "./rfidScanModal.scss";
import CloseIcon from "@mui/icons-material/Close";
import SensorsIcon from '@mui/icons-material/Sensors'; // Radar-like icon
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const RfidScanModal = ({ isOpen, onClose, onRescan, scannedId }) => {
  if (!isOpen) return null;

  return (
    <div className="rfidModalOverlay">
      <div className="rfidModalContainer">
        <button className="closeBtn" onClick={onClose}>
          <CloseIcon />
        </button>

        <div className="rfidModalContent">
          {/* Animated Scan Icon */}
          <div className={`scanIconWrapper ${scannedId ? "success" : "animating"}`}>
            {scannedId ? (
              <CheckCircleIcon className="mainIcon success" />
            ) : (
              <SensorsIcon className="mainIcon pulse" />
            )}
            <div className="ripple"></div>
          </div>

          <h2>{scannedId ? "MaChip Detected!" : "Ready to Scan"}</h2>
          <p>
            {scannedId 
              ? "The RFID card has been successfully linked." 
              : "Please tap the employee's MaChip on the RFID reader to continue."}
          </p>

          {/* ID Display Box */}
          <div className={`idResultBox ${scannedId ? "visible" : ""}`}>
            <label>Detected MaChip ID</label>
            <div className="idValue">{scannedId || "Waiting for signal..."}</div>
          </div>
        </div>

        <div className="rfidModalActions">
          {scannedId ? (
            <>
              {/* Rescan Button */}
              <button className="rescanBtn" onClick={onRescan}>
                Scan Again
              </button>
              <button className="confirmBtn" onClick={onClose}>
                Confirm
              </button>
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