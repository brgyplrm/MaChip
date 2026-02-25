import "./login.scss";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    // Add your authentication logic here
    console.log("Logging in with:", username);
    navigate("/");
  };

  return (
    <div className="loginPage">
      <div className="loginContainer">
        <div className="top">
          {/* Replace with your actual logo path */}
          <img src="/assets/logo.png" alt="MAC-J Logo" className="logo" />
          <h1>Admin Login</h1>
          <hr />
        </div>
        <form onSubmit={handleLogin}>
          <div className="inputItem">
            <label>Username:</label>
            <input 
              type="text" 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="inputItem">
            <label>Password:</label>
            <input 
              type="password" 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login;