import "./settings.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useState } from "react";

const Settings = () => {
  return (
    <div className="settings">
      <Sidebar />
      <div className="settingsContainer">
        <Navbar />
        <div className="settingsWrapper">
          <h1 className="title">System Settings</h1>
          <div className="content">
            {/* Left Section: Account/User Info */}
            <div className="item">
              <h2 className="itemTitle">Profile Settings</h2>
              <div className="details">
                <div className="detailItem">
                  <span className="itemKey">Admin Name:</span>
                  <span className="itemValue">Main Locksmith</span>
                </div>
                <div className="detailItem">
                  <span className="itemKey">Email:</span>
                  <span className="itemValue">admin@keymedia.com</span>
                </div>
                <button className="editButton">Update Profile</button>
              </div>
            </div>

            {/* Right Section: System Preferences */}
            <div className="item">
              <h2 className="itemTitle">MaChip Configuration</h2>
              <div className="details">
                <div className="detailItem">
                  <span className="itemKey">Authentication Mode:</span>
                  <span className="itemValue">Face + Microchip</span>
                </div>
                <div className="detailItem">
                  <span className="itemKey">System Status:</span>
                  <span className="itemValue statusActive">Online</span>
                </div>
                <button className="editButton">System Sync</button>
              </div>
            </div>
          </div>
          
          <div className="dangerZone">
            <h2 className="itemTitle">Danger Zone</h2>
            <p>Once you delete the system logs, there is no going back.</p>
            <button className="deleteBtn">Clear All Activity Logs</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;