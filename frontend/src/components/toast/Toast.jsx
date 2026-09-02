import { useEffect } from "react";
import "./toast.scss";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Toast Component
 *
 * Props:
 *  - message  : string  — the text to display
 *  - type     : "success" | "error" | "warning" | "info"
 *  - onClose  : () => void  — called when the toast is dismissed
 *  - duration : number (ms, default 4000) — auto-dismiss after this delay
 */
const Toast = ({ message, type = "success", onClose, duration = 4000 }) => {
  // Auto-dismiss
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className={`toast toast--${type}`}>
      <span className="toast__icon">
        {type === "success" && <CheckCircleOutlineIcon fontSize="small" />}
        {type === "error" && <ErrorOutlineIcon fontSize="small" />}
        {type === "warning" && <WarningAmberIcon fontSize="small" />}
        {type === "info" && <InfoOutlinedIcon fontSize="small" />}
      </span>
      <span className="toast__message">{message}</span>
      <button className="toast__close" onClick={onClose} aria-label="Dismiss">
        <CloseIcon fontSize="small" />
      </button>
    </div>
  );
};

export default Toast;
