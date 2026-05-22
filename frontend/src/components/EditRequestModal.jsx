import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "../utils/api";
import CloseIcon from "@mui/icons-material/Close";

const EditRequestModal = ({ isOpen, onClose, request, onUpdate }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [modificationReason, setModificationReason] = useState("");

  useEffect(() => {
    if (request) {
      // Find the existing payment status from any of the potential fields
      const initialWithPayID = request.VL_WithPayID || request.SL_WithPayID || request.EL_WithPayID || request.HD_WithPayID || request.ST_WithPayID || 1;
      
      setFormData({
        emp_reqTypeId: request.emp_reqTypeId,
        remarks: request.remarks || "",
        // OT fields
        OT_DateOf: request.OT_DateOf || "",
        HrFrom: request.HrFrom || "",
        HrTo: request.HrTo || "",
        Total_Hrs: request.Total_Hrs || 0,
        // Leave fields
        StartDate: request.VL_StartDate || request.SL_StartDate || request.ST_StartDate || request.EL_DateOfLeave || request.HD_DateOfLeave || request.DateonField || "",
        EndDate: request.VL_EndDate || request.SL_EndDate || request.ST_EndDate || "",
        NoDays: request.VL_NoDays || request.SL_NoDays || request.ST_NoDays || request.EL_NoDays || 0,
        WithPayID: String(initialWithPayID),
        // Onfield fields
        DateonField: request.DateonField || "",
        NoHrs: request.OW_NoHrs || 0,
        destination: request.destination || "",
        // Log Correction fields
        logDate: request.LC_logDate || "",
        claimedIn: request.LC_claimedIn || "",
        claimedOut: request.LC_claimedOut || "",
        correctionCategory: request.LC_correctionCategory || "",
        period: request.HD_period || "",
      });
    }
  }, [request]);

  if (!isOpen || !request) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Ensure WithPayID is sent as integer for the backend
      const payload = { 
        ...formData, 
        WithPayID: parseInt(formData.WithPayID),
        modificationReason 
      };
      
      const response = await fetchWithAuth(`/api/request/update/${request.emp_reqId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        onUpdate();
        onClose();
        setModificationReason(""); 
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update request");
      }
    } catch (err) {
      console.error("Error updating request:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-[#2A174E]">Edit Request #REQ-{request.emp_reqId}</h2>
            <p className="text-sm text-slate-500">{request.reqTypeName} for {request.userName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Conditional fields based on type */}
            {request.emp_reqTypeId === 1 && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">OT Date</label>
                  <Input type="date" name="OT_DateOf" value={formData.OT_DateOf} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Total Hours</label>
                  <Input type="number" name="Total_Hrs" value={formData.Total_Hrs} onChange={handleInputChange} step="0.01" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Time From</label>
                  <Input type="time" name="HrFrom" value={formData.HrFrom} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Time To</label>
                  <Input type="time" name="HrTo" value={formData.HrTo} onChange={handleInputChange} required />
                </div>
              </>
            )}

            {[3, 4, 6, 8, 9, 10, 11, 12].includes(request.emp_reqTypeId) && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Start Date</label>
                  <Input type="date" name="StartDate" value={formData.StartDate} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">End Date</label>
                  <Input type="date" name="EndDate" value={formData.EndDate} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Number of Days</label>
                  <Input type="number" name="NoDays" value={formData.NoDays} onChange={handleInputChange} step="0.5" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Payment Status</label>
                  <Select value={formData.WithPayID} onValueChange={(val) => handleSelectChange('WithPayID', val)}>
                    <SelectTrigger className="w-full h-10 border-slate-200">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="1">Leave with Pay</SelectItem>
                      <SelectItem value="2">Leave without Pay</SelectItem>
                      <SelectItem value="3">Considered AWOL</SelectItem>
                      <SelectItem value="4">For Suspension</SelectItem>
                      <SelectItem value="5">For Dismissal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {request.emp_reqTypeId === 5 && (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-bold text-slate-700">Log Date</label>
                  <Input type="date" name="logDate" value={formData.logDate} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Claimed In</label>
                  <Input type="time" name="claimedIn" value={formData.claimedIn} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Claimed Out</label>
                  <Input type="time" name="claimedOut" value={formData.claimedOut} onChange={handleInputChange} required />
                </div>
              </>
            )}

            {request.emp_reqTypeId === 7 && (
               <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Date</label>
                  <Input type="date" name="StartDate" value={formData.StartDate} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Period</label>
                  <Select value={formData.period} onValueChange={(val) => handleSelectChange('period', val)}>
                    <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="Morning">Morning</SelectItem>
                      <SelectItem value="Afternoon">Afternoon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Payment Status</label>
                  <Select value={formData.WithPayID} onValueChange={(val) => handleSelectChange('WithPayID', val)}>
                    <SelectTrigger className="w-full h-10 border-slate-200">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="1">Leave with Pay</SelectItem>
                      <SelectItem value="2">Leave without Pay</SelectItem>
                      <SelectItem value="3">Considered AWOL</SelectItem>
                      <SelectItem value="4">For Suspension</SelectItem>
                      <SelectItem value="5">For Dismissal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
               </>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-tight">Employee Remarks / Reason (Read Only)</label>
            <Textarea name="remarks" value={formData.remarks} readOnly className="h-20 bg-slate-50 text-slate-500 cursor-not-allowed border-slate-200 resize-none" />
          </div>

          <div className="space-y-2 p-4 bg-amber-50 rounded-xl border border-amber-100 shadow-inner">
            <label className="text-sm font-bold text-amber-800 flex items-center gap-2">
               Modification Reason (Sent to Employee)
            </label>
            <Textarea 
              value={modificationReason} 
              onChange={(e) => setModificationReason(e.target.value)} 
              placeholder="Explain why you are modifying this request..." 
              required
              className="bg-white border-amber-200 focus-visible:ring-amber-500 h-20 shadow-sm"
            />
          </div>

          <div className="pt-4 border-t flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="px-6 border-slate-300">Cancel</Button>
            <Button type="submit" className="bg-[#2A174E] text-white hover:bg-[#1a0e30] px-8 shadow-md" disabled={loading}>
              {loading ? "Updating..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRequestModal;
