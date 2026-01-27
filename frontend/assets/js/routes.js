// routes.js - route management stuff
// handles the routes page

import { checkAuth, fetchWithAuth, logout } from './auth.js';

const API_URL = 'http://localhost:5000/api';

let routesData = [];
let vesselsData = [];
let currentUser = null;

// page load
window.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkAuth();
  if (!currentUser) return;

  // sidebar user info
  document.getElementById('userName').textContent = currentUser.name || currentUser.email;
  document.getElementById('userRole').textContent = currentUser.role.toUpperCase();
  document.getElementById('userAvatar').textContent = (currentUser.name || currentUser.email).substring(0, 2).toUpperCase();

  if (currentUser.role === 'admin') {
    document.getElementById('adminLink').style.display = 'flex';
  }

  // show add button for admin/operator only
  if (currentUser.role === 'admin' || currentUser.role === 'operator') {
    document.getElementById('addRouteBtn').style.display = 'block';
  }

  await loadData();
});

// load routes and vessels at the same time
async function loadData() {
  try {
    const [routesRes, vesselsRes] = await Promise.all([
      fetchWithAuth(`${API_URL}/routes`),
      fetchWithAuth(`${API_URL}/vessels`)
    ]);

    if (!routesRes.ok || !vesselsRes.ok) throw new Error('Failed to fetch data');
    
    routesData = await routesRes.json();
    vesselsData = await vesselsRes.json();
    
    renderRoutes();
    populateVesselDropdown();
  } catch (error) {
    console.error('Error loading data:', error);
    alert('Failed to load data');
  }
}

// displays all the route cards
function renderRoutes() {
  const grid = document.getElementById('routesGrid');
  
  if (routesData.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">No routes found</p>';
    return;
  }

  grid.innerHTML = routesData.map(route => {
    const canEdit = currentUser.role === 'admin' || currentUser.role === 'operator';
    // color code by risk
    const riskColor = route.risk_level === 'Low' ? '#10b981' : route.risk_level === 'Medium' ? '#f59e0b' : '#ef4444';
    
    // parse waypoints - might be string or already array
    let waypoints;
    try {
      waypoints = typeof route.coordinates === 'string' ? JSON.parse(route.coordinates) : route.coordinates;
    } catch {
      waypoints = [];
    }

    return `
      <div class="table-container">
        <div class="table-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3>${route.route_name}</h3>
          <span style="background: ${riskColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600;">
            ${route.risk_level} Risk
          </span>
        </div>
        <div style="padding: 20px;">
          <div style="margin-bottom: 16px;">
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">ASSIGNED VESSEL</p>
            <p style="font-size: 14px; font-weight: 500;">
              ${route.vessel_name ? `🚢 ${route.vessel_name}` : '<span style="color: var(--text-tertiary);">Unassigned</span>'}
            </p>
          </div>

          <div style="margin-bottom: 16px;">
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">WAYPOINTS (${waypoints.length})</p>
            <div style="max-height: 150px; overflow-y: auto; background: var(--dark-bg); padding: 12px; border-radius: 8px; font-size: 11px; font-family: monospace;">
              ${waypoints.map((wp, i) => `<div style="margin-bottom: 4px;">${i + 1}. [${wp[0].toFixed(4)}, ${wp[1].toFixed(4)}]</div>`).join('')}
            </div>
          </div>

          ${canEdit ? `
            <div style="display: flex; gap: 8px; margin-top: 16px;">
              <button class="btn-secondary" onclick="editRoute(${route.id})" style="flex: 1;">
                ✏️ Edit
              </button>
              <button class="btn-secondary" onclick="deleteRoute(${route.id}, '${route.route_name}')" style="flex: 1; background: rgba(239, 68, 68, 0.1); color: #ef4444;">
                🗑️ Delete
              </button>
            </div>
          ` : '<p style="text-align: center; color: var(--text-tertiary); font-size: 12px; margin-top: 16px;">Read Only Access</p>'}
        </div>
      </div>
    `;
  }).join('');
}

// fills in vessel dropdown in the form
function populateVesselDropdown() {
  const select = document.getElementById('vesselId');
  select.innerHTML = '<option value="">Unassigned</option>' + 
    vesselsData.map(v => `<option value="${v.id}">${v.vessel_name}</option>`).join('');
}

// open add modal
window.openAddModal = () => {
  document.getElementById('modalTitle').textContent = 'Add Route';
  document.getElementById('routeForm').reset();
  document.getElementById('routeId').value = '';
  document.getElementById('routeModal').style.display = 'flex';
};

// open edit modal with data filled in
window.editRoute = (id) => {
  const route = routesData.find(r => r.id === id);
  if (!route) return;

  document.getElementById('modalTitle').textContent = 'Edit Route';
  document.getElementById('routeId').value = route.id;
  document.getElementById('routeName').value = route.route_name;
  document.getElementById('riskLevel').value = route.risk_level;
  document.getElementById('vesselId').value = route.vessel_id || '';
  
  const coords = typeof route.coordinates === 'string' ? route.coordinates : JSON.stringify(route.coordinates);
  document.getElementById('coordinates').value = coords;
  
  document.getElementById('routeModal').style.display = 'flex';
};

window.closeModal = () => {
  document.getElementById('routeModal').style.display = 'none';
};

// save route (add or edit)
document.getElementById('routeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const routeId = document.getElementById('routeId').value;
  
  // try to parse coordinates
  let coordinates;
  try {
    coordinates = JSON.parse(document.getElementById('coordinates').value);
  } catch (e) {
    alert('Invalid coordinates format. Please use JSON array format.');
    return;
  }

  const routeData = {
    route_name: document.getElementById('routeName').value,
    risk_level: document.getElementById('riskLevel').value,
    vessel_id: document.getElementById('vesselId').value || null,
    coordinates: coordinates
  };

  try {
    const url = routeId ? `${API_URL}/routes/${routeId}` : `${API_URL}/routes`;
    const method = routeId ? 'PUT' : 'POST';

    const res = await fetchWithAuth(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routeData)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to save route');
    }

    alert(routeId ? 'Route updated successfully' : 'Route added successfully');
    closeModal();
    loadData();
  } catch (error) {
    console.error('Error saving route:', error);
    alert(error.message);
  }
});

// delete with confirmation
window.deleteRoute = async (id, name) => {
  if (!confirm(`Are you sure you want to delete route "${name}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const res = await fetchWithAuth(`${API_URL}/routes/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to delete route');
    }

    alert('Route deleted successfully');
    loadData();
  } catch (error) {
    console.error('Error deleting route:', error);
    alert(error.message);
  }
};

window.refreshRoutes = () => {
  loadData();
};

// back to dashboard
window.goToDashboard = () => {
  const role = currentUser.role;
  if (role === 'admin') {
    window.location.href = 'admin-dashboard.html';
  } else if (role === 'operator') {
    window.location.href = 'operator-dashboard.html';
  } else {
    window.location.href = 'viewer-dashboard.html';
  }
};

window.logout = logout;