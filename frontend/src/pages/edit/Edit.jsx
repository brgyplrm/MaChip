import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import { useParams, useNavigate } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import RfidScanModal from "../../components/rfidScanModal/RfidScanModal";
import Toast from "../../components/toast/Toast";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Edit = ({ inputs, title }) => {
  const navigate = useNavigate();
  const { userId } = useParams();

  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const [showRfidModal, setShowRfidModal] = useState(false);
  const [rfidError, setRfidError] = useState("");
  const [localScannedId, setLocalScannedId] = useState("");

  const [showFingerprintModal, setShowFingerprintModal] = useState(false);
  const [fingerprintError, setFingerprintError] = useState("");
  const [localFingerprintId, setLocalFingerprintId] = useState("");

  const dismissToast = useCallback(() => setToast({ message: "", type: "success" }), []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetchWithAuth(`/api/users/view/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setFormData(data);
        } else {
          setToast({ message: "Failed to fetch user data.", type: "error" });
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        setToast({ message: "An error occurred while fetching user data.", type: "error" });
      }
    };
    if (userId) fetchUserData();
  }, [userId]);

  const handleInput = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleScanRFID = async () => {
    setShowRfidModal(true);
    setLocalScannedId("");
    setRfidError("");

    try {
      // Start session FIRST to tell ESP32 we are in enrollment mode
      await fetchWithAuth("/api/system/reg-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId, type: 'RFID' })
      });

      const response = await fetchWithAuth("/api/users/generateRfid");
      const data = await response.json();

      if (response.ok) {
        // Check for duplicates
        const checkResponse = await fetchWithAuth(`/api/users/check-machip/${data.rfid}`);
        const checkData = await checkResponse.json();

        if (checkResponse.ok && checkData.exists && checkData.user_Id !== parseInt(userId)) {
          setRfidError("This MaChip ID is already assigned to another user.");
          setLocalScannedId(data.rfid);
        } else {
          setLocalScannedId(data.rfid);
        }
      } else {
        setRfidError(data.error || "Failed to scan RFID. Please try again.");
        if (data.rfid) setLocalScannedId(data.rfid);
      }
    } catch (err) {
      console.error("RFID Scan Error:", err);
      setRfidError("An error occurred while scanning.");
    }
  };

  const handleScanFingerprint = async () => {
    setShowFingerprintModal(true);
    setLocalFingerprintId("");
    setFingerprintError("");

    try {
      // Start session FIRST to tell ESP32 we are in enrollment mode
      await fetchWithAuth("/api/system/reg-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId, type: 'FP' })
      });

      const response = await fetchWithAuth(`/api/users/generateFingerprint?userId=${userId}`);
      const data = await response.json();

      if (response.ok) {
        setLocalFingerprintId(data.fingerprintId);
        if (data.template) {
           setFormData(prev => ({ ...prev, user_FingerprintTemplate: data.template }));
        }
      } else {
        setFingerprintError(data.error || "Failed to scan fingerprint.");
      }
    } catch (err) {
      console.error("FP Scan Error:", err);
      setFingerprintError("An error occurred during scanning.");
    }
  };

  const closeRfidModal = () => {
    setShowRfidModal(false);
    fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
  };

  const closeFingerprintModal = () => {
    setShowFingerprintModal(false);
    fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
    fetchWithAuth("/api/users/clear-fingerprint-session", { method: "DELETE" }).catch(() => {});
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/users/update/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setToast({ message: "User profile updated successfully!", type: "success" });
        setTimeout(() => navigate("/users"), 1500);
      } else {
        const errData = await response.json();
        setToast({ message: errData.error || "Failed to update profile.", type: "error" });
      }
    } catch (err) {
      console.error("Update Error:", err);
      setToast({ message: "Something went wrong.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      <div className="flex-1 p-4 md:p-8 w-full max-w-4xl mx-auto overflow-x-hidden min-w-0">
        
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">
            {title} <span className="text-slate-500 font-medium text-xl md:text-2xl ml-2">(ID: {formatUserId(userId)})</span>
          </h1>
        </div>

        <Card className="shadow-sm border-0 bg-white">
          <CardHeader className="border-b border-slate-50 pb-4 mb-6">
            <CardTitle className="text-lg text-slate-800">Update Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {inputs && inputs.map((input) => {
                  const isReadOnly = input.label === "User ID" || input.label === "MaChip ID" || input.label === "Fingerprint ID";
                  
                  return (
                    <div className="space-y-2" key={input.id}>
                      <Label htmlFor={input.id} className="text-slate-600 font-semibold">
                        {input.label}
                      </Label>
                      
                      <div className="flex gap-2">
                        <Input
                          id={input.id}
                          type={input.type}
                          placeholder={input.placeholder}
                          value={formData[input.id] || ""}
                          onChange={handleInput}
                          readOnly={isReadOnly}
                          className={`flex-1 ${isReadOnly ? "bg-slate-100 text-slate-500 cursor-not-allowed focus-visible:ring-0" : "bg-white focus-visible:ring-[#2A174E]"}`}
                        />
                        
                        {input.label === "MaChip ID" && (
                          <Button 
                            type="button" 
                            variant="secondary"
                            onClick={handleScanRFID}
                            className="shrink-0 bg-[#2A174E] text-white hover:bg-[#1a0e30] transition-colors"
                          >
                            RE-SCAN
                          </Button>
                        )}

                        {input.label === "Fingerprint ID" && (
                          <Button 
                            type="button" 
                            variant="secondary"
                            onClick={handleScanFingerprint}
                            className="shrink-0 bg-[#2A174E] text-white hover:bg-[#1a0e30] transition-colors"
                          >
                            RE-SCAN
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end gap-3 mt-8">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate(-1)}
                  className="border-slate-300 text-slate-700 w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="bg-[#2A174E] hover:bg-[#1a0e30] text-white w-full sm:w-auto"
                >
                  {loading ? "Updating..." : "Update Profile"}
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>

      </div>
      </Sidebar>

      <RfidScanModal 
          isOpen={showRfidModal} 
          onClose={closeRfidModal}
          onRescan={handleScanRFID}
          onConfirm={() => {
            setFormData(prev => ({ ...prev, user_MachipId: localScannedId }));
            setShowRfidModal(false);
            setToast({ message: `MaChip ID Updated: ${localScannedId}`, type: "success" });
            fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
          }}
          scannedId={localScannedId} 
          error={rfidError}
        />

        <RfidScanModal 
          isOpen={showFingerprintModal} 
          onClose={closeFingerprintModal}
          onRescan={handleScanFingerprint}
          onConfirm={() => {
            setFormData(prev => ({ ...prev, user_FingerprintId: localFingerprintId }));
            setShowFingerprintModal(false);
            setToast({ message: `Fingerprint Slot Updated: ${localFingerprintId}`, type: "success" });
            fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
            fetchWithAuth("/api/users/clear-fingerprint-session", { method: "DELETE" }).catch(() => {});
          }}
          scannedId={localFingerprintId} 
          error={fingerprintError}
          title="Fingerprint Scanner" 
        />
    </div>
  );
};

export default Edit;
