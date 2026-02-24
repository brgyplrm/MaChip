
import "./new.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import { useEffect, useState } from "react";

const New = ({ inputs, title }) => {
  const [file, setFile] = useState("");
  // State to store form values, using the input IDs as keys
  const [formData, setFormData] = useState({
    user_Id: '',
    user_Username: '',
    user_FirstName: '',
    user_LastName: '',
    user_MiddleName: '',
    user_Email: '',
    user_Password: '',
    user_MachipId: '',
    user_Role: 'Employee'
  });

  useEffect(() => {
    const fetchNextId = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/users/nextId");  
        if (response.ok) {
          const data = await response.json();
          setFormData(prev => ({ ...prev, user_Id: data.nextId }));
        }
      } catch (err) {
        console.error("Failed to fetch next ID:", err);
      }
    };
    fetchNextId();
  }, []);

  const hanleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:4000/api/users/registerUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        alert("User added successfully!");
        // Optionally reset form or navigate away
      } else {
        const errorData = await response.json();
        alert("Failed to add user: " + (errorData.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Error submitting form:", err);
      alert("An error occurred while adding the user.");
    }
  };

  const handleInput = (e) => {
    const id = e.target.id;
    const value = e.target.value;
    setFormData({ ...formData, [id]: value });
  };

  const handleScanRFID = async () => {
    // 1. Simulate the hardware trigger for the Machip system
    console.log("Initializing RFID Scanner...");
    
    try {
      // 2. Fetch generated RFID from the backend
      const response = await fetch("http://localhost:4000/api/users/generateRfid");
      if (response.ok) {
        const data = await response.json();
        const generatedRFID = data.rfid;
        
        // 3. Update the state for the Machip ID field
        setFormData(prev => ({ ...prev, user_MachipId: generatedRFID }));
        alert(`Machip Scanned Successfully! ID: ${generatedRFID}`);
      } else {
        alert("Failed to scan RFID.");
      }
    } catch (err) {
      console.error("Error scanning RFID:", err);
      alert("An error occurred while scanning.");
    }
  };

  return (
    <div className="new">
      <Sidebar />
      <div className="newContainer">
        <Navbar />
        <div className="top">
          <h1>{title}</h1>
        </div>
        <div className="bottom">
          
          <div className="right">
            <form onSubmit={hanleSubmit}>
              {inputs.map((input) => (
                <div className="formInput" key={input.id}>
                  <label>{input.label}</label>
                  <div className="inputActionWrapper">
                                        <input
                                          id={input.id}
                                          type={input.type}
                                          placeholder={input.placeholder}
                                          value={formData[input.id] || ""}
                                          onChange={(e) => setFormData({ ...formData, [input.id]: e.target.value })}
                                          readOnly={input.label === "User ID" || input.label === "MaChip ID"} 
                                        />                    {/* Only show the Scan button for the MaChip ID field */}
                    {input.label === "MaChip ID" && (
                      <button 
                        type="button" 
                        className="scanButton"
                        onClick={handleScanRFID}
                      >
                        SCAN
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button className="submitButton" type="submit">Add</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default New;