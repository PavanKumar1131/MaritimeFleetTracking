// auth.js - handles login and stuff
// made this for my maritime project

const API_URL = 'http://localhost:5000/api';

// login form handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // save to localstorage so we stay logged in
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // send user to right dashboard based on their role
      const role = data.user.role;
      if (role === 'admin') {
        window.location.href = 'admin-dashboard.html';
      } else if (role === 'operator') {
        window.location.href = 'operator-dashboard.html';
      } else {
        window.location.href = 'viewer-dashboard.html';
      }
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Connection error. Please try again.');
  }
});

// checks if user is logged in, redirects to login if not
async function checkAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  // no token means not logged in
  if (!token || !userStr) {
    window.location.href = 'login.html';
    return null;
  }
  
  try {
    const user = JSON.parse(userStr);
    return user;
  } catch (error) {
    console.error('Auth error:', error);
    window.location.href = 'login.html';
    return null;
  }
}

// clears everything and sends back to login
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// wrapper for fetch that adds auth header automatically
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });
  
  // if server says unauthorized kick them out
  if (response.status === 401 || response.status === 403) {
    logout();
  }
  
  return response;
}

export { checkAuth, logout, fetchWithAuth, API_URL };
