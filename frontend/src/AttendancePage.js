const API_URL = 'api/attendance';

// Mark Attendance (Login/Logout)

document.getElementById('markAttendanceBtn').addEventListener('click', async (event) => {
    event.preventDefault();
    const userId = document.getElementById('attendance_userId').value;
    const logType = document.getElementById('attendance_type').value;
    
    if (!userId) {
        alert("Error: Please enter a User ID to mark attendance.");
        return;
    }
    try {
        const response = await fetch(`${API_URL}/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_Id: userId,
                log_Type: logType 
            })
        });
        const data = await response.json();
        if (response.ok) {
            alert(data.message);
        } else {
            alert("Error: " + (data.error || data.message || "Unknown error"));
        }
    } catch (err) {
        alert("Error: " + (err.message || "Something went wrong"));
    }
});

// View All Attendance
async function viewAllattendance() {
    const container = document.getElementById('allAttendanceContainer');
    const tableBody = document.getElementById('attendanceTableBody');
    
    try {
        const response = await fetch(`${API_URL}/all`);
        const data = await response.json();
        
        console.log("Fetched Attendance Data:", data); // Check structure in browser console

        if (response.ok) {
            tableBody.innerHTML = '';
            data.forEach(log => {
                // Try to access user data through 'user' alias
                const userObj = log.user || log.User; 
                const lastname = userObj ? userObj.user_LastName : 'N/A';
                const machipId = userObj ? userObj.user_MachipId : 'N/A';

                const row = `<tr>
                    <td>${log.user_id}</td>
                    <td>${lastname}</td>
                    <td>${machipId}</td>
                    <td>${log.time_Logged_in}</td>
                    <td>${log.time_Logged_out || 'Active'}</td>
                    <td>${log.location}</td>
                </tr>`;
                tableBody.innerHTML += row;
            });
            container.style.display = 'block';
        } else {
            alert("Error: " + (data.error || "Failed to fetch attendance"));
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}
window.viewAllattendance = viewAllattendance;

// View User Logs
async function viewUserLogs() {
    const userId = document.getElementById('logs_userId').value;
    const logsSection = document.getElementById('userLogsView');
    const logsList = document.getElementById('logs_list');
    
    if (!userId) {
        alert("Error: Please enter a User ID to view logs.");
        return;
    } 
    try {
        const response = await fetch(`${API_URL}/logs/${userId}`);
        const data = await response.json();
        if (response.ok) {
            alert("Logs Retrieved!");
            logsList.innerHTML = '';
            if (data.length === 0) {
                logsList.innerHTML = '<li>No logs found for this user.</li>';
            } else {
                data.forEach(log => {
                    const logItem = document.createElement('li');
                    logItem.textContent = `${log.log_Date} - ${log.log_Type} at ${log.time_Logged_in}${log.time_Logged_out ? ' to ' + log.time_Logged_out : ''}`;
                    logsList.appendChild(logItem);
                });
            }
            logsSection.style.display = 'block';
        } else {
            alert("Error: " + (data.error || data.message || "Unknown error"));
        }
    } catch (err) {
        alert("Error: " + (err.message || "Something went wrong"));
    }
} 
window.viewUserLogs = viewUserLogs;
 