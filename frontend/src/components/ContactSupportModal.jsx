import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ContactSupportModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    employeeId: "",
    subject: "",
    message: ""
  });

  // Try to pre-fill Employee ID if available in localStorage
  useEffect(() => {
    if (isOpen) {
      const userData = JSON.parse(localStorage.getItem("userData"));
      if (userData && userData.user_Id) {
        setFormData(prev => ({ ...prev, employeeId: userData.user_Id }));
      }
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Support Form Submitted:", formData);
    // In a real application, you would make an API call here.
    // fetchWithAuth("/api/support/contact", { method: "POST", body: JSON.stringify(formData) })
    
    // Simulate success
    alert("Support request sent successfully!");
    onClose();
    // Reset form (except ID which might be pre-filled)
    setFormData(prev => ({ ...prev, subject: "", message: "" }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-brand-primary text-xl font-bold">Contact Support</DialogTitle>
          <DialogDescription className="text-slate-500">
            Send us a message and we'll get back to you as soon as possible.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="employeeId" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Employee ID
            </Label>
            <Input
              id="employeeId"
              name="employeeId"
              value={formData.employeeId}
              readOnly
              disabled
              className="bg-slate-100 border-slate-200 cursor-not-allowed opacity-80"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Subject
            </Label>
            <Input
              id="subject"
              name="subject"
              placeholder="What can we help you with?"
              value={formData.subject}
              onChange={handleChange}
              required
              className="focus-visible:ring-brand-primary border-slate-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              How can we help?
            </Label>
            <Textarea
              id="message"
              name="message"
              placeholder="Please describe your concern in detail..."
              value={formData.message}
              onChange={handleChange}
              rows={5}
              required
              className="focus-visible:ring-brand-primary border-slate-200 resize-none"
            />
          </div>
          <DialogFooter className="pt-4 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="w-full border-slate-200 text-slate-600">
              Cancel
            </Button>
            <Button type="submit" className="bg-brand-primary hover:bg-brand-primary-hover w-full text-white">
              Send Message
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactSupportModal;
