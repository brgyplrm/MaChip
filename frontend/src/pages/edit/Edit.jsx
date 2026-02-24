import "./editUser.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

const Edit = ({ inputs, title }) => {
  const [formData, setFormData] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  
  // 1. Get the ID from the URL (e.g., /users/1143155/edit)
  const { userId } = useParams();

  // 2. Simulate fetching the existing user data when the page loads
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Simulate an API call to fetch user data by ID
        const response = await fetch(`http://localhost:4000/api/users/${userId}`);
        if (response.ok) {
          const data = await response.json();
          // Remove password from fetched data so it stays empty in the form
          const { user_Password, ...otherData } = data;
          setFormData(otherData); 
        } else {
          console.error("Failed to fetch user data");
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
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

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:4000/api/users/updateUser/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert("User profile updated successfully!");
      } else {
        const errorData = await response.json();
        alert(`Failed to update: ${errorData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error updating user:", err);
      alert("An error occurred during update.");
    }
  };

  return (
    <div className="new">
      <Sidebar />
      <div className="newContainer">
        <Navbar />
        <div className="top">
          <h1>{title} (ID: {userId})</h1>
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
                      type={input.id === "user_Password" && showPassword ? "text" : input.type}
                      placeholder={input.placeholder}
                      value={formData[input.id] || ""}
                      onChange={handleInput}
                      readOnly={input.label === "User ID" || input.label === "MaChip ID"}
                    />
                    {input.id === "user_Password" && (
                      <button 
                        type="button" 
                        className="visibilityToggle"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", marginLeft: "-35px", color: "gray" }}
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </button>
                    )}
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