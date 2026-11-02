import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Image as ImageIcon, X, AlertCircle, Loader2 } from "lucide-react";
import { fetchWithAuth } from "../utils/api";

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const ContactSupportModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    subject: "",
    message: ""
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const fileInputRef = useRef(null);

  // Reset modal state on open or close
  const resetForm = () => {
    setFormData({ subject: "", message: "" });
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    setErrorMessage(null);
    setIsSubmitting(false);
    setIsSubmitted(false);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    } else {
      resetForm();
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPG, JPEG, WEBP, or GIF).");
      return;
    }

    // Validate size (5MB max)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMessage(`Image is too large. Maximum file size is ${MAX_IMAGE_SIZE_MB}MB.`);
      return;
    }

    setErrorMessage(null);
    setSelectedImage(file);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.subject.trim()) {
      setErrorMessage("Please enter an inquiry subject.");
      return;
    }

    if (!formData.message.trim()) {
      setErrorMessage("Please enter how we can help you.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = new FormData();
      payload.append("subject", formData.subject.trim());
      payload.append("message", formData.message.trim());
      if (selectedImage) {
        payload.append("image", selectedImage);
      }

      const res = await fetchWithAuth("/api/system/contact-support", {
        method: "POST",
        body: payload
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch support request.");
      }

      setIsSubmitted(true);
      setTimeout(() => {
        onClose();
        resetForm();
      }, 2500);
    } catch (err) {
      console.error("[CONTACT SUPPORT SUBMIT ERROR]:", err);
      setErrorMessage(err.message || "Failed to send message. Please check your internet connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        {isSubmitted ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 animate-in zoom-in-95 duration-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-800">Support Request Sent</DialogTitle>
            <DialogDescription className="text-slate-500 max-w-xs text-sm">
              Your message and details have been forwarded to <strong>machipcaps67@gmail.com</strong>. Our team will get back to you shortly.
            </DialogDescription>
            <Button
              size="sm"
              onClick={() => {
                onClose();
                resetForm();
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
                Send us an inquiry and our administration team will get back to you as soon as possible.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2.5 rounded-lg text-xs flex items-center gap-2 mt-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  rows={4}
                  required
                  className="focus-visible:ring-brand-primary border-slate-200 resize-none"
                />
              </div>

              {/* Optional Image Upload Field */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Attachment (Optional)</span>
                  <span className="text-[10px] font-normal text-slate-400 lowercase">png, jpg, webp up to 5MB</span>
                </Label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
                  className="hidden"
                  disabled={isSubmitting}
                />

                {!selectedImage ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="w-full border-2 border-dashed border-slate-200 hover:border-brand-primary/50 hover:bg-purple-50/30 rounded-xl p-3 flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-brand-primary transition-all cursor-pointer group"
                  >
                    <ImageIcon className="w-4 h-4 text-slate-400 group-hover:text-brand-primary transition-colors" />
                    <span className="font-medium">Attach screenshot or error photo</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {imagePreview && (
                        <img
                          src={imagePreview}
                          alt="Attachment preview"
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate max-w-[220px]">
                          {selectedImage.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(selectedImage.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveImage}
                      disabled={isSubmitting}
                      className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-3 grid grid-cols-2 gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose} 
                  disabled={isSubmitting}
                  className="w-full border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-brand-primary hover:bg-[#7A52B5] w-full text-white flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send Message</span>
                  )}
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
