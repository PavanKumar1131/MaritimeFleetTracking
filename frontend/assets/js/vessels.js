// vessels.js - vessel management page
// this file handles displaying and editing vessels

import { checkAuth, fetchWithAuth, logout } from './auth.js';

const API_URL = 'http://localhost:5000/api';

let vesselsData = [];
let currentUser = null;

// runs when page loads
window.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkAuth();
  if (!currentUser) return;

  // set user info in sidebar
  document.getElementById('userName').textContent = currentUser.name || currentUser.email;
  document.getElementById('userRole').textContent = currentUser.role.toUpperCase();
  document.getElementById('userAvatar').textContent = (currentUser.name || currentUser.email).substring(0, 2).toUpperCase();

  // only show admin panel link for admins
  if (currentUser.role === 'admin') {
    document.getElementById('adminLink').style.display = 'flex';
  }

  // only admins and operators can add/edit vessels
  if (currentUser.role === 'admin' || currentUser.role === 'operator') {
    document.getElementById('addVesselBtn').style.display = 'block';
  } else {
    document.getElementById('actionsHeader').style.display = 'none';
  }

  loadVessels();
});

// gets vessels from server
async function loadVessels() {
  try {
    const res = await fetchWithAuth(`${API_URL}/vessels`);
    if (!res.ok) throw new Error('Failed to fetch vessels');
    
    vesselsData = await res.json();
    renderVessels(vesselsData);
  } catch (error) {
    console.error('Error loading vessels:', error);
    alert('Failed to load vessels');
  }
}

// creates the table rows for vessels
function renderVessels(vessels) {
  const tbody = document.getElementById('vesselsTableBody');
  
  // show message if no vessels
  if (vessels.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-secondary);">No vessels found</td></tr>';
    return;
  }

  tbody.innerHTML = vessels.map(vessel => {
    const canEdit = currentUser.role === 'admin' || currentUser.role === 'operator';
    
    // pick color based on health percentage
    const engineColor = vessel.engine_health >= 80 ? '#10b981' : vessel.engine_health >= 50 ? '#f59e0b' : '#ef4444';
    const fuelColor = (vessel.fuel_level || 0) >= 50 ? '#10b981' : (vessel.fuel_level || 0) >= 20 ? '#f59e0b' : '#ef4444';

    return `
      <tr>
        <td>${vessel.id}</td>
        <td><strong>${vessel.name}</strong></td>
        <td><span class="badge badge-${vessel.type.toLowerCase()}">${vessel.type}</span></td>
        <td>${vessel.speed || 0} kn</td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${vessel.engine_health}%; background: ${engineColor};"></div>
          </div>
          <span style="font-size: 11px; color: var(--text-secondary);">${vessel.engine_health}%</span>
        </td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${vessel.fuel_level || 0}%; background: ${fuelColor};"></div>
          </div>
          <span style="font-size: 11px; color: var(--text-secondary);">${vessel.fuel_level || 0}%</span>
        </td>
        <td style="font-size: 12px; color: var(--text-tertiary);">
          ${vessel.latitude ? vessel.latitude.toFixed(2) : 'N/A'}, ${vessel.longitude ? vessel.longitude.toFixed(2) : 'N/A'}
        </td>
        <td>
          ${canEdit ? `
            <div style="display: flex; gap: 8px;">
              <button class="btn-icon" onclick="editVessel(${vessel.id})" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteVessel(${vessel.id}, '${vessel.name}')" title="Delete">🗑️</button>
            </div>
          ` : '<span style="color: var(--text-tertiary); font-size: 12px;">View Only</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

// search and filter function
window.filterVessels = () => {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const typeFilter = document.getElementById('typeFilter').value;

  const filtered = vesselsData.filter(vessel => {
    const matchesSearch = vessel.name.toLowerCase().includes(searchTerm) || 
                         vessel.type.toLowerCase().includes(searchTerm);
    const matchesType = !typeFilter || vessel.type === typeFilter;
    return matchesSearch && matchesType;
  });

  renderVessels(filtered);
};

// opens the add vessel popup
window.openAddModal = () => {
  document.getElementById('modalTitle').textContent = 'Add Vessel';
  document.getElementById('vesselForm').reset();
  document.getElementById('vesselId').value = '';
  document.getElementById('vesselModal').style.display = 'flex';
};

// opens edit popup with vessel data filled in
window.editVessel = (id) => {
  const vessel = vesselsData.find(v => v.id === id);
  if (!vessel) return;

  document.getElementById('modalTitle').textContent = 'Edit Vessel';
  document.getElementById('vesselId').value = vessel.id;
  document.getElementById('vesselName').value = vessel.name;
  document.getElementById('vesselType').value = vessel.type;
  document.getElementById('latitude').value = vessel.latitude || '';
  document.getElementById('longitude').value = vessel.longitude || '';
  document.getElementById('speed').value = vessel.speed || 0;
  document.getElementById('engineHealth').value = vessel.engine_health;
  document.getElementById('fuelLevel').value = vessel.fuel_level || 0;
  
  document.getElementById('vesselModal').style.display = 'flex';
};

// closes the popup
window.closeModal = () => {
  document.getElementById('vesselModal').style.display = 'none';
};

// handles form submit for add/edit
document.getElementById('vesselForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const vesselId = document.getElementById('vesselId').value;
  const vesselData = {
    vessel_name: document.getElementById('vesselName').value,
    vessel_type: document.getElementById('vesselType').value,
    latitude: parseFloat(document.getElementById('latitude').value),
    longitude: parseFloat(document.getElementById('longitude').value),
    speed_knots: parseFloat(document.getElementById('speed').value),
    engine_health: parseInt(document.getElementById('engineHealth').value),
    fuel_level: parseInt(document.getElementById('fuelLevel').value)
  };

  try {
    // if vesselId exists we're editing, otherwise adding new
    const url = vesselId ? `${API_URL}/vessels/${vesselId}` : `${API_URL}/vessels`;
    const method = vesselId ? 'PUT' : 'POST';

    const res = await fetchWithAuth(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vesselData)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to save vessel');
    }

    // Broadcast update to other pages (fleet map, etc.)
    localStorage.setItem('vesselUpdate', Date.now().toString());
    localStorage.setItem('fleetUpdate', Date.now().toString());

    alert(vesselId ? 'Vessel updated successfully' : 'Vessel added successfully');
    closeModal();
    loadVessels();
  } catch (error) {
    console.error('Error saving vessel:', error);
    alert(error.message);
  }
});

// deletes a vessel after confirming
window.deleteVessel = async (id, name) => {
  if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis will also remove all associated routes and tracking data. This action cannot be undone.`)) {
    return;
  }

  try {
    const res = await fetchWithAuth(`${API_URL}/vessels/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to delete vessel');
    }

    // Broadcast update to other pages (fleet map, routes, etc.)
    localStorage.setItem('vesselUpdate', Date.now().toString());
    localStorage.setItem('routeUpdate', Date.now().toString());
    localStorage.setItem('fleetUpdate', Date.now().toString());

    alert('Vessel and associated data deleted successfully');
    loadVessels();
  } catch (error) {
    console.error('Error deleting vessel:', error);
    alert(error.message);
  }
};

// refresh button handler
window.refreshVessels = () => {
  loadVessels();
};

// go back to dashboard based on role
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