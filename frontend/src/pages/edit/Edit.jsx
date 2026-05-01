import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useParams, useNavigate } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Edit = ({ inputs, title }) => {
  const [formData, setFormData] = useState({});
  const navigate = useNavigate();
  
  // 1. Get the ID from the URL (e.g., /users/1143155/edit)
  const { userId } = useParams();

  // 2. Simulate fetching the existing user data when the page loads
  useEffect(() => {
    const fetchUserData = () => {
      // In a real app, you would fetch data from your database here
      // For now, we simulate pre-filling the data for this user
      setFormData({
        user_Id: userId,
        user_Username: "jsmith_dev",
        user_FirstName: "Kathleen",
        user_LastName: "Smith",
        user_MachipId: "MACHIP-OLD123"
      });
    };
    if (userId) fetchUserData();
  }, [userId]);

  const handleInput = (e) => {
    const id = e.target.id;
    const value = e.target.value;
    setFormData({ ...formData, [id]: value });
  };

  const handleScanRFID = async () => {
    console.log("Initializing RFID Scanner for re-assignment...");
    
    try {
      const response = await fetchWithAuth("/api/users/generateRfid");
      if (response.ok) {
        const data = await response.json();
        const generatedRFID = data.rfid;
        
        // Update the state for the Machip ID field
        setFormData(prev => ({ ...prev, user_MachipId: generatedRFID }));
        alert(`New Machip Scanned! ID Updated to: ${generatedRFID}`);
      } else {
        alert("Failed to scan RFID.");
      }
    } catch (err) {
      console.error("Error scanning RFID:", err);
      alert("An error occurred while scanning.");
    }
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    console.log("Updating User ID:", userId, "Data:", formData);
    alert("User profile updated successfully!");
    // navigate("/users"); // Optional: redirect after success
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar />
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
                  const isReadOnly = input.label === "User ID" || input.label === "MaChip ID";
                  
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
                  className="bg-[#2A174E] hover:bg-[#1a0e30] text-white w-full sm:w-auto"
                >
                  Update Profile
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Edit;