import React, { useState } from "react";
import "./forgotPassword.scss";
import { Link } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");

  const handleResetRequest = (e) => {
    e.preventDefault();
    console.log("Password reset requested for:", email);
    // Add your API call logic here
  };

  return (
    <div className="loginPage forgotPasswordPage">
      <div className="loginContainer">
        <div className="top">
          <img src="/logo.png" alt="Logo" className="logo" />
          <h1>Reset Password</h1>
          <p>Enter your email address to receive a password reset link.</p>
          <hr />
        </div>

        <form onSubmit={handleResetRequest}>
          <div className="inputItem">
            <label htmlFor="reset-email">Email Address:</label>
            <input
              id="reset-email"
              type="email"
              placeholder="e.g. employee@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit">Send Reset Link</button>
        </form>

        <div className="bottomLinks">
          <Link to="/login" className="backLink">
            <ArrowBackIcon className="icon" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;