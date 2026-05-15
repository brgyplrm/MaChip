import React, { useState } from "react";
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
    /* Modal Overlay */
    <div className="fixed inset-0 w-screen h-screen bg-black/40 z-[3000] flex items-center justify-center backdrop-blur-sm">
      
      {/* Modal Content */}
      <div className="bg-white w-[400px] p-[30px] rounded-2xl shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button 
          className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-slate-400 hover:text-[#2A174E] transition-colors" 
          onClick={onClose}
        >
          <CloseIcon />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Logo" className="w-[150px] mx-auto mb-4" />
          <h2 className="text-[#2A174E] text-xl font-bold m-0">Reset Password</h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Provide your email address to receive a link to reset your password.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleResetRequest} className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Email Address:</label>
            <input
              type="email"
              placeholder="employee@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#2A174E] focus:ring-1 focus:ring-[#2A174E] transition-all"
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full py-3 px-5 bg-[#2A174E] text-white border-none rounded-lg font-bold text-sm cursor-pointer hover:bg-[#1a0e30] hover:-translate-y-0.5 transition-all shadow-md active:scale-95"
          >
            Send Reset Password
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;