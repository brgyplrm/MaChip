import "./new.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import { useState } from "react";

const New = ({ inputs, title }) => {
  const [file, setFile] = useState("");
  // State to store form values, using the input IDs as keys
  const [formData, setFormData] = useState({});

  const handleInput = (e) => {
    const id = e.target.id;
    const value = e.target.value;
    setFormData({ ...formData, [id]: value });
  };

  const handleScanRFID = () => {
    // 1. Simulate the hardware trigger for the Machip system
    console.log("Initializing RFID Scanner...");
    
    // 2. Generate a random UID (Simulating a successful chip read)
    const randomUID = "MACHIP-" + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    // 3. Update the state for the Machip ID field (ID 7 in your userInputs)
    // This allows the input to "auto-fill"
    setFormData({ ...formData, 7: randomUID });
    
    alert(`Machip Scanned Successfully! ID: ${randomUID}`);
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
            <form>

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
                    {/* Only show the Scan button for the Machip ID field */}
                    {input.label === "Machip ID" && (
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