import { useEffect } from "react";
import "./toast.scss";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Toast Component
 *
 * Props:
 *  - message  : string  — the text to display
 *  - type     : "success" | "error"  — controls color & icon
 *  - onClose  : () => void  — called when the toast is dismissed
 *  - duration : number (ms, default 3500) — auto-dismiss after this delay
 */
const Toast = ({ message, type = "success", onClose, duration = 3500 }) => {
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
        {type === "success" ? (
          <CheckCircleOutlineIcon fontSize="small" />
        ) : (
          <ErrorOutlineIcon fontSize="small" />
        )}
      </span>
      <span className="toast__message">{message}</span>
      <button className="toast__close" onClick={onClose} aria-label="Dismiss">
        <CloseIcon fontSize="small" />
      </button>
    </div>
  );
};

export default Toast;
