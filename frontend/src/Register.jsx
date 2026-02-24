import { useState, useEffect } from 'react';

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

  useEffect(() => {
    // Fetch the next ID when the component mounts
    const fetchNextId = async () => {
      try {
        const response = await fetch('/api/users/nextId');
        if (response.ok) {
          const data = await response.json();
          setUserData(prev => ({ ...prev, user_Id: data.nextId }));
        }
      } catch (err) {
        console.error("Failed to fetch next ID:", err);
      }
    };
    fetchNextId();
  }, []);

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
      if (response.ok) {
        alert("User Registered!");
        // Refresh the ID for the next registration
        const nextIdResponse = await fetch('/api/users/nextId');
        if (nextIdResponse.ok) {
          const nextIdData = await nextIdResponse.json();
          setUserData({
            user_Id: nextIdData.nextId,
            user_FirstName: '',
            user_LastName: '',
            user_MiddleName: '',
            user_MachipId: '',
            user_Role: 'Employee'
          });
        }
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Connection failed: " + err.message);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h3>Register New User (React Version)</h3>
      <form onSubmit={handleSubmit}>
        <label htmlFor="user_Id">User ID: </label>
        <input 
          type="text" 
          id="user_Id" 
          value={userData.user_Id} 
          readOnly 
          style={{ backgroundColor: '#f0f0f0' }} 
        /><br/>
        
        <input type="text" id="user_FirstName" placeholder="First Name" value={userData.user_FirstName} onChange={handleChange} required /><br/>
        <input type="text" id="user_LastName" placeholder="Last Name" value={userData.user_LastName} onChange={handleChange} required /><br/>
        <input type="text" id="user_MiddleName" placeholder="Middle Name" value={userData.user_MiddleName} onChange={handleChange} /><br/>
        <input type="text" id="user_MachipId" placeholder="MaChip ID" value={userData.user_MachipId} onChange={handleChange} required /><br/>
        <select id="user_Role" value={userData.user_Role} onChange={handleChange}>
          <option value="Employee">Employee</option>
          <option value="Admin">Admin</option>
        </select><br/><br/>
        <button type="submit">Register User</button>
      </form>
    </div>
  );
}

export default Register;