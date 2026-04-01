/* src/components/infoModal/InfoModal.jsx */
import React from "react";
import "./infoModal.scss";
import CloseIcon from "@mui/icons-material/Close";

const InfoModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="infoModalOverlay">
      <div className="infoModalContainer">
        <div className="modalHeader">
          <h2>{title}</h2>
          <CloseIcon className="closeIcon" onClick={onClose} />
        </div>
        <div className="modalContent">
          {children}
        </div>
      </div>
    </div>
  );
};

export default InfoModal;