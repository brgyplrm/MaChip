import "./editUser.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";

const Edit = ({ inputs, title }) => {
  const [file, setFile] = useState("");
  const [formData, setFormData] = useState({});
  
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
    fetchUserData();
  }, [userId]);

  const handleInput = (e) => {
    const id = e.target.id;
    const value = e.target.value;
    setFormData({ ...formData, [id]: value });
  };

  const handleScanRFID = async () => {
    console.log("Initializing RFID Scanner for re-assignment...");
    
    try {
      const response = await fetch("http://localhost:4000/api/users/generateRfid");
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
  };

  return (
    <div className="new">
      <Sidebar />
      <div className="newContainer">
        <Navbar />
        <div className="top">
          <h1>{title} (ID: {formatUserId(userId)})</h1>
        </div>
        <div className="bottom">
          <div className="right">
            <form onSubmit={handleUpdate}>

              {inputs.map((input) => (
                <div className="formInput" key={input.id}>
                  <label>{input.label}</label>
                  <div className="inputActionWrapper">
                    <input
                      id={input.id}
                      type={input.type}
                      placeholder={input.placeholder}
                      value={formData[input.id] || ""}
                      onChange={handleInput}
                      readOnly={input.label === "User ID" || input.label === "MaChip ID"}
                    />
                    {input.label === "MaChip ID" && (
                      <button 
                        type="button" 
                        className="scanButton"
                        onClick={handleScanRFID}
                      >
                        RE-SCAN
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button className="submitButton" type="submit">Update Profile</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Edit;