import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";

const ContactSupportModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    employeeId: "",
    subject: "",
    message: ""
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Try to pre-fill Employee ID if available in localStorage
  useEffect(() => {
    if (isOpen) {
      setIsSubmitted(false);
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
    setIsSubmitted(true);
    setTimeout(() => {
      onClose();
      setIsSubmitted(false);
      setFormData(prev => ({ ...prev, subject: "", message: "" }));
    }, 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        {isSubmitted ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 animate-in zoom-in-95 duration-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-800">Support Request Sent</DialogTitle>
            <DialogDescription className="text-slate-500 max-w-xs text-sm">
              Your message has been received. Our support team will get back to you shortly.
            </DialogDescription>
            <Button
              size="sm"
              onClick={() => {
                onClose();
                setIsSubmitted(false);
                setFormData(prev => ({ ...prev, subject: "", message: "" }));
              }}
              className="mt-2 bg-brand-primary hover:bg-[#7A52B5] text-white"
            >
              Done
            </Button>
          </div>
        ) : (
          <>
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
                <Button type="submit" className="bg-brand-primary hover:bg-[#7A52B5] w-full text-white">
                  Send Message
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContactSupportModal;
