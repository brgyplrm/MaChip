const API_URL = '/api/auth';

// Login Form Submission
document.getElementById('LoginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const userId = document.getElementById('login_userId').value;
    const password = document.getElementById('login_password').value;
    
    if (!userId || !password) {
        alert("Error: Please enter both User ID and Password.");
        return;

    }
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_Id: userId, password: password })
        });
        const data = await response.json();
        
        if (response.ok) {
            alert(data.message);
            window.location.href = 'index.html';
        } else {
            alert("Error: " + (data.error || data.message || "Unknown error"));
        }
    } catch (err) {
        alert("Error: " + (err.message || "Something went wrong"));
    }
});