import { useState } from 'react';

function Register() {
  // This replaces all your document.getElements
  const [userData, setUserData] = useState({
    user_Id: '',
    user_FirstName: '',
    user_LastName: '',
    user_MiddleName: '',
    user_MachipId: '',
    user_Role: 'Employee'
  });

  const handleChange = (e) => {
    setUserData({ ...userData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Notice we use the relative path because of the Vite Proxy
      const response = await fetch('/api/users/registerUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      const data = await response.json();
      alert(response.ok ? "User Registered!" : "Error: " + data.error);
    } catch (err) {
      alert("Connection failed: " + err.message);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h3>Register New User (React Version)</h3>
      <form onSubmit={handleSubmit}>
        <input type="text" id="user_Id" placeholder="User ID" onChange={handleChange} required /><br/>
        <input type="text" id="user_FirstName" placeholder="First Name" onChange={handleChange} required /><br/>
        <input type="text" id="user_LastName" placeholder="Last Name" onChange={handleChange} required /><br/>
        <input type="text" id="user_MiddleName" placeholder="Middle Name" onChange={handleChange} /><br/>
        <input type="text" id="user_MachipId" placeholder="MaChip ID" onChange={handleChange} required /><br/>
        <select id="user_Role" onChange={handleChange}>
          <option value="Employee">Employee</option>
          <option value="Admin">Admin</option>
        </select><br/><br/>
        <button type="submit">Register User</button>
      </form>
    </div>
  );
}

export default Register;