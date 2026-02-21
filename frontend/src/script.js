const API_URL = 'http://localhost:4000/api/users';

// Register User
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userData = {
        user_Id: document.getElementById('user_Id').value,
        user_FirstName: document.getElementById('user_FirstName').value,
        user_LastName: document.getElementById('user_LastName').value,
        user_MiddleName: document.getElementById('user_MiddleName').value,
        user_MachipId: document.getElementById('user_MachipId').value,
        user_Role: document.getElementById('user_Role').value
    };

    try {
        const response = await fetch(`${API_URL}/registerUser`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (response.ok) {
            alert("User Registered!");
            if (document.getElementById('allUsersContainer').style.display !== 'none') fetchAllUsers();
        } else {
            alert("Error: " + data.error);
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
});

// Search User to Update
async function searchUser() {
    const userId = document.getElementById('search_userId').value;
    const updateFields = document.getElementById('updateFields');

    try {
        const response = await fetch(`${API_URL}/${userId}`);
        const data = await response.json();

        if (response.ok) {
            alert("User Found!");
            document.getElementById('display_userId').innerText = data.user_Id;
            document.getElementById('upd_firstName').value = data.user_FirstName;
            document.getElementById('upd_lastName').value = data.user_LastName;
            document.getElementById('upd_middleName').value = data.user_MiddleName || '';
            document.getElementById('upd_machipId').value = data.user_MachipId;
            document.getElementById('upd_role').value = data.user_Role;
            updateFields.style.display = 'block';
        } else {
            alert("Error: " + data.error);
            updateFields.style.display = 'none';
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}

// Update User
async function updateUser() {
    const userId = document.getElementById('display_userId').innerText;
    const userData = {
        user_FirstName: document.getElementById('upd_firstName').value,
        user_LastName: document.getElementById('upd_lastName').value,
        user_MiddleName: document.getElementById('upd_middleName').value,
        user_MachipId: document.getElementById('upd_machipId').value,
        user_Role: document.getElementById('upd_role').value
    };

    try {
        const response = await fetch(`${API_URL}/updateUser/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (response.ok) {
            alert("User Updated Successfully!");
            cancelUpdate();
            if (document.getElementById('allUsersContainer').style.display !== 'none') fetchAllUsers();
        } else {
            alert("Error: " + (data.error || data.message || "Unknown error"));
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}

function cancelUpdate() {
    document.getElementById('updateFields').style.display = 'none';
    document.getElementById('search_userId').value = '';
}

// Remove User
document.getElementById('removeUserBtn').addEventListener('click', async () => {
    const userId = document.getElementById('removeUserId').value;

    try {
        const response = await fetch(`${API_URL}/deleteUser/${userId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (response.ok) {
            alert("User Deleted!");
            if (document.getElementById('allUsersContainer').style.display !== 'none') fetchAllUsers();
        } else {
            alert("Error: " + (data.error || data.message || "Unknown error"));
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
});

// View Specific User
async function viewSpecificUser() {
    const userId = document.getElementById('view_userId').value;
    const viewSection = document.getElementById('singleUserView');
    const detailEl = document.getElementById('view_details');

    if (!userId) {
        alert("Error: Please enter a User ID to view.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${userId}`);
        const data = await response.json();

        if (response.ok) {
            alert("User Found!");
            detailEl.innerHTML = `
                <b>User ID:</b> ${data.user_Id}<br>
                <b>Name:</b> ${data.user_FirstName} ${data.user_MiddleName || ''} ${data.user_LastName}<br>
                <b>MaChip ID:</b> ${data.user_MachipId}<br>
                <b>Role:</b> ${data.user_Role}
            `;
            viewSection.style.display = 'block';
        } else {
            alert("Error: " + data.error);
            viewSection.style.display = 'none';
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}

// View All Users in Table
async function fetchAllUsers() {
    const tbody = document.getElementById('userTableBody');
    const container = document.getElementById('allUsersContainer');
    try {
        const response = await fetch(`${API_URL}/all`);
        const users = await response.json();
        
        if (response.ok) {
            tbody.innerHTML = ''; // Clear current table
            users.forEach(user => {
                const row = `<tr>
                    <td style="padding: 8px;">${user.user_Id}</td>
                    <td style="padding: 8px;">${user.user_FirstName}</td>
                    <td style="padding: 8px;">${user.user_LastName}</td>
                    <td style="padding: 8px;">${user.user_MiddleName || '-'}</td>
                    <td style="padding: 8px;">${user.user_MachipId}</td>
                    <td style="padding: 8px;">${user.user_Role}</td>
                </tr>`;
                tbody.innerHTML += row;
            });
            container.style.display = 'block';
        } else {
            alert("Error: Could not fetch users.");
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}
