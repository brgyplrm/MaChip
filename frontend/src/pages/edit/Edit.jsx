import "./editUser.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

const Edit = ({ inputs, title }) => {
  const [file, setFile] = useState("");
  const [formData, setFormData] = useState({});
  
  // 1. Get the ID from the URL (e.g., /users/1143155/edit)
  const { userId } = useParams();

  // 2. Simulate fetching the existing user data when the page loads
  useEffect(() => {
    const fetchUserData = () => {
      // In a real app, you would fetch data from your database here
      // For now, we simulate pre-filling the Machip ID for this user
      setFormData({
        1: "jsmith_dev",        // Username
        2: "Kathleen Smith",   // Full Name
        7: "MACHIP-OLD123"     // Existing Machip ID
      });
    };
    fetchUserData();
  }, [userId]);

  const handleInput = (e) => {
    const id = e.target.id;
    const value = e.target.value;
    setFormData({ ...formData, [id]: value });
  };

  const handleScanRFID = () => {
    console.log("Initializing RFID Scanner for re-assignment...");
    
    // Generate a new random UID for the PUPChip system
    const randomUID = "MACHIP-" + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    // Update the state for the Machip ID field
    setFormData({ ...formData, 7: randomUID });
    
    alert(`New Machip Scanned! ID Updated to: ${randomUID}`);
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
          <h1>{title} (ID: {userId})</h1>
        </div>
        <div className="bottom">
          <div className="left">
            <img
              src={
                file
                  ? URL.createObjectURL(file)
                  : "https://icon-library.com/images/no-image-icon/no-image-icon-0.jpg"
              }
              alt=""
            />
          </div>
          <div className="right">
            <form onSubmit={handleUpdate}>
              <div className="formInput">
                <label htmlFor="file">
                  Update Image: <DriveFolderUploadOutlinedIcon className="icon" />
                </label>
                <input
                  type="file"
                  id="file"
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ display: "none" }}
                />
              </div>

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
                    />
                    {input.label === "Machip ID" && (
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