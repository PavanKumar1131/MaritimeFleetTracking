import { checkAuth, fetchWithAuth, logout } from './auth.js';

const API_URL = 'http://localhost:5000/api';

let usersData = [];

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  // Ensure only admins can access this page
  if (user.role !== 'admin') {
    alert('Access denied. Admin privileges required.');
    window.location.href = user.role === 'operator' ? 'operator-dashboard.html' : 'viewer-dashboard.html';
    return;
  }

  document.getElementById('userName').textContent = user.name || user.email;
  document.getElementById('userRole').textContent = user.role.toUpperCase();
  document.getElementById('userAvatar').textContent = (user.name || user.email).substring(0, 2).toUpperCase();

  loadUsers();
});

async function loadUsers() {
  try {
    const res = await fetchWithAuth(`${API_URL}/auth/users`);
    if (!res.ok) throw new Error('Failed to fetch users');
    
    usersData = await res.json();
    renderUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    alert('Failed to load users');
  }
}

function renderUsers() {
  const tbody = document.getElementById('usersTableBody');
  
  tbody.innerHTML = usersData.map(user => {
    const roleColor = user.role === 'admin' ? '#ef4444' : user.role === 'operator' ? '#f59e0b' : '#10b981';
    const createdDate = new Date(user.created_at).toLocaleDateString();

    return `
      <tr>
        <td>${user.id}</td>
        <td><strong>${user.name || 'N/A'}</strong></td>
        <td>${user.email}</td>
        <td>
          <span class="badge" style="background: ${roleColor};">
            ${user.role.toUpperCase()}
          </span>
        </td>
        <td style="color: var(--text-secondary); font-size: 12px;">${createdDate}</td>
        <td>
          <button 
            class="btn-icon" 
            onclick="deleteUser(${user.id}, '${user.email}')" 
            title="Delete User"
            ${user.role === 'admin' ? 'disabled' : ''}
          >
            🗑️
          </button>
          ${user.role === 'admin' ? '<span style="font-size: 11px; color: var(--text-tertiary);">Protected</span>' : ''}
        </td>
      </tr>
    `;
  }).join('');
}

window.openAddUserModal = () => {
  document.getElementById('userForm').reset();
  document.getElementById('userModal').style.display = 'flex';
};

window.closeUserModal = () => {
  document.getElementById('userModal').style.display = 'none';
};

// Form submission
document.getElementById('userForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const userData = {
    name: document.getElementById('newUserName').value,
    email: document.getElementById('newUserEmail').value,
    password: document.getElementById('newUserPassword').value,
    role: document.getElementById('newUserRole').value
  };

  try {
    const res = await fetchWithAuth(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create user');
    }

    alert('User created successfully');
    closeUserModal();
    loadUsers();
  } catch (error) {
    console.error('Error creating user:', error);
    alert(error.message);
  }
});

window.deleteUser = async (id, email) => {
  if (!confirm(`Are you sure you want to delete user "${email}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const res = await fetchWithAuth(`${API_URL}/auth/users/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to delete user');
    }

    alert('User deleted successfully');
    loadUsers();
  } catch (error) {
    console.error('Error deleting user:', error);
    alert(error.message);
  }
};

window.refreshUsers = () => {
  loadUsers();
};

window.logout = logout;
