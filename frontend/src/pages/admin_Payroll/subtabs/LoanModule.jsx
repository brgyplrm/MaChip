import React, { useState } from "react";
import "./loanModule.scss";
import Sidebar from "../../../components/sidebar/Sidebar";
import Navbar from "../../../components/navbar/Navbar";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';

const LoanModule = ({ type }) => {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = () => {
    if (!file) return alert("Please select a file first");
    setLoading(true);
    // Mock CSV Parsing for standard loans
    setTimeout(() => {
      const mockData = [
        { id: 1, name: "Galeon, Jenny", amount: "1,500.00", date: "2024-05-01", balance: "15,000.00" },
        { id: 2, name: "Monis, Gracel", amount: "1,000.00", date: "2024-05-01", balance: "8,500.00" },
        { id: 3, name: "Dawal, Myla", amount: "2,000.00", date: "2024-05-01", balance: "0.00" },
      ];
      setData(mockData);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="loanModule">
      <Sidebar />
      <div className="loanContainer">
        <Navbar />
        <div className="top">
          <h1>{type} Management</h1>
          <div className="upload-section">
            <input type="file" accept=".csv" onChange={handleFileChange} id="csv-upload" style={{display: 'none'}} />
            <label htmlFor="csv-upload" className="upload-btn">
              <CloudUploadIcon /> {file ? file.name : "Choose CSV File"}
            </label>
            <button className="process-btn" onClick={handleUpload} disabled={loading}>
              {loading ? "Processing..." : "Upload & Process"}
            </button>
          </div>
        </div>

        <div className="bottom">
          <div className="table-header">
            <h3>Recent {type} Records</h3>
            <div className="actions">
              <button className="save-btn"><SaveIcon /> Save to Payroll</button>
              <button className="clear-btn"><DeleteIcon /> Clear All</button>
            </div>
          </div>
          
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee Name</th>
                  <th>Deduction Amount</th>
                  <th>Deduction Date</th>
                  <th>Remaining Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.length > 0 ? data.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.name}</td>
                    <td className="amt">₱{row.amount}</td>
                    <td>{row.date}</td>
                    <td className="amt">₱{row.balance}</td>
                    <td><span className={`status ${parseFloat(row.balance) === 0 ? 'paid' : 'pending'}`}>
                      {parseFloat(row.balance) === 0 ? 'Paid Off' : 'Pending'}
                    </span></td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="empty">No data uploaded. Please upload a CSV to start.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanModule;
