import { useEffect, useRef } from "react";
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
 *  - onClick  : () => void  — optional click handler
 *  - duration : number (ms, default 4000) — auto-dismiss after this delay
 */
const Toast = ({ message, type = "success", onClose, onClick, duration = 4000 }) => {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Auto-dismiss
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      if (onCloseRef.current) {
        onCloseRef.current();
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration]);

  if (!message) return null;

  return (
    <div 
      className={`toast toast--${type} ${onClick ? 'cursor-pointer select-none hover:opacity-95' : ''}`}
      onClick={(e) => {
        if (e.target.closest('.toast__close')) return;
        if (onClick) onClick();
      }}
    >
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
