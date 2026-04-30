import "./settings.scss";
import Sidebar from "../../components/Sidebar";
import { useState, useEffect } from "react";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import SaveIcon from "@mui/icons-material/Save";
import { Link } from "react-router-dom";
import TransactionLog from "../../components/transactionLog/TransactionLog";
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";

const Settings = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1;

  const { refreshSystemTime } = useSystemTime();
  const [realTime, setRealTime] = useState(new Date());
  const [mockEnabled, setMockEnabled] = useState(false);
  const [mockTime, setMockTime] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Update real-time clock every second
    const timer = setInterval(() => {
      setRealTime(new Date());
    }, 1000);

    // Fetch current settings
    const fetchSettings = async () => {
      try {
        const response = await fetchWithAuth("/api/system/settings");
        const data = await response.json();
        if (response.ok && data) {
          setMockEnabled(data.mockTimeEnabled);
          if (data.mockTimeValue) {
            // Format for datetime-local input (YYYY-MM-DDTHH:mm)
            const date = new Date(data.mockTimeValue);
            const formatted = date.toISOString().slice(0, 16);
            setMockTime(formatted);
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
    return () => clearInterval(timer);
  }, []);

  const handleSaveSettings = async () => {
    try {
      const response = await fetchWithAuth("/api/system/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mockTimeEnabled: mockEnabled,
          mockTimeValue: mockEnabled ? mockTime : null, // Send the string directly
        }),
      });
      if (response.ok) {
        await refreshSystemTime();
        alert("System settings updated successfully!");
      } else {
        alert("Failed to update settings.");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Error connecting to server.");
    }
  };

  return (
    <div className="settings">
      <Sidebar />
      <div className="settingsContainer">
        <div className="settingsWrapper">
          <h1 className="title">System Settings</h1>
          <div className="content">

            {/* Right Section: System Preferences */}
            <div className="item">
              <h2 className="itemTitle">MaChip Configuration</h2>
              <div className="details">
                <div className="detailItem">
                  <span className="itemKey">Authentication Mode:</span>
                  <span className="itemValue">Biometrics + Microchip</span>
                </div>
                <div className="detailItem">
                  <span className="itemKey">System Status:</span>
                  <span className="itemValue statusActive">Online</span>
                </div>
                {/* <button className="editButton">System Sync</button> */}
              </div>
            </div>

            {/* Section: System Time & Date */}
            <div className="item timeSettings">
              <h2 className="itemTitle">System Time & Date</h2>
              <div className="details">
                <div className="detailItem currentRealTime">
                  <span className="itemKey">Current Real-Time:</span>
                  <span className="itemValue">
                    <AccessTimeIcon className="icon" /> {realTime.toLocaleTimeString()}
                    <CalendarTodayIcon className="icon ml-10" /> {realTime.toLocaleDateString()}
                  </span>
                </div>

                {isAdmin && (
                  <>
                    <div className="detailItem">
                      <span className="itemKey">Mock Time Enabled:</span>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={mockEnabled}
                          onChange={(e) => setMockEnabled(e.target.checked)}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>

                    {mockEnabled && (
                      <div className="detailItem">
                        <span className="itemKey">Set Mock Date & Time:</span>
                        <input 
                          type="datetime-local" 
                          className="timeInput"
                          value={mockTime}
                          onChange={(e) => setMockTime(e.target.value)}
                        />
                      </div>
                    )}

                    <button className="saveButton" onClick={handleSaveSettings}>
                      <SaveIcon className="icon" /> Save Time Settings
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/*<div className="dangerZone">
            <h2 className="itemTitle">Danger Zone</h2>
            <p>Once you delete the system logs, there is no going back.</p>
            <button className="deleteBtn">Clear All Activity Logs</button>
          </div>*/}
        </div>
      </div>
    </div>
  );
};

export default Settings;