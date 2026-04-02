// src/pages/login/ForgotPasswordModal.jsx
import React, { useState } from "react";
import "./forgotPasswordModal.scss";
import CloseIcon from "@mui/icons-material/Close";

const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState("");

  if (!isOpen) return null;

  const handleResetRequest = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/users/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        onClose();
      } else {
        alert(data.error || "Failed to send reset request.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    }
  };

  return (
    <div className="modalOverlay">
      <div className="modalContent forgotModal">
        <button className="closeBtn" onClick={onClose}>
          <CloseIcon />
        </button>
        <div className="modalHeader">
          <img src="/logo.png" alt="Logo" className="logo" />
          <h2>Reset Password</h2>
          <p>
            Provide your email address to receive a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleResetRequest}>
          <div className="inputItem">
            <label>Email Address:</label>
            <input
              type="email"
              placeholder="employee@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="confirmBtn">
            Send Reset Password
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
