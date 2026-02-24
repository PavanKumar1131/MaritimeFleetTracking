import { checkAuth, fetchWithAuth, logout } from './auth.js';

const API_URL = 'http://localhost:5000/api';

let map;
let vesselsData = [];
let routesData = [];
let markerLayer;
let routeLayer;
let liveUpdateInterval = null;
const LIVE_UPDATE_INTERVAL_MS = 3000; // Update every 3 seconds

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  document.getElementById('userName').textContent = user.name || user.email;
  document.getElementById('userRole').textContent = user.role.toUpperCase();
  document.getElementById('userAvatar').textContent = (user.name || user.email).substring(0, 2).toUpperCase();

  if (user.role === 'admin') {
    document.getElementById('adminPanelLink')?.style.display = 'flex';
  }

  initializeMap();
  await loadMapData();
  
  // Start live position updates
  startLiveUpdates();
  
  document.getElementById('logoutBtn').addEventListener('click', logout);
});

// Start polling for live vessel position updates
function startLiveUpdates() {
  if (liveUpdateInterval) {
    clearInterval(liveUpdateInterval);
  }
  
  liveUpdateInterval = setInterval(async () => {
    await updateVesselPositions();
  }, LIVE_UPDATE_INTERVAL_MS);
  
  console.log('🔴 Live tracking started - updating every', LIVE_UPDATE_INTERVAL_MS / 1000, 'seconds');
}

// Fetch latest vessel positions and update map
async function updateVesselPositions() {
  try {
    const res = await fetchWithAuth(`${API_URL}/vessels`);
    if (!res.ok) return;
    
    const newData = await res.json();
    
    // Check for position changes
    let hasChanges = false;
    newData.forEach(newVessel => {
      const oldVessel = vesselsData.find(v => v.id === newVessel.id);
      if (oldVessel) {
        if (oldVessel.latitude !== newVessel.latitude || 
            oldVessel.longitude !== newVessel.longitude ||
            oldVessel.status !== newVessel.status) {
          hasChanges = true;
        }
      }
    });
    
    vesselsData = newData;
    
    // Only re-render if there are changes
    if (hasChanges) {
      renderVesselsOnMap();
      renderFleetList();
    }
  } catch (error) {
    console.error('Error updating vessel positions:', error);
  }
}

// Stop live updates (call when leaving page)
function stopLiveUpdates() {
  if (liveUpdateInterval) {
    clearInterval(liveUpdateInterval);
    liveUpdateInterval = null;
    console.log('⏹️ Live tracking stopped');
  }
}

// Clean up on page unload
window.addEventListener('beforeunload', stopLiveUpdates);

function initializeMap() {
  // Initialize Leaflet map
  map = L.map('map').setView([20, 0], 2);

  // Add dark tile layer
  L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',
    maxZoom: 20
  }).addTo(map);

  // Initialize marker and route layers
  markerLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
}

async function loadMapData() {
  try {
    const [vesselsRes, routesRes] = await Promise.all([
      fetchWithAuth(`${API_URL}/vessels`),
      fetchWithAuth(`${API_URL}/routes`)
    ]);

    if (!vesselsRes.ok || !routesRes.ok) throw new Error('Failed to fetch data');
    
    vesselsData = await vesselsRes.json();
    routesData = await routesRes.json();
    
    renderVesselsOnMap();
    renderRoutesOnMap();
    renderFleetList();
  } catch (error) {
    console.error('Error loading map data:', error);
    alert('Failed to load map data');
  }
}

function renderVesselsOnMap() {
  markerLayer.clearLayers();

  vesselsData.forEach(vessel => {
    // Skip vessels with invalid coordinates
    if (vessel.latitude == null || vessel.longitude == null ||
        isNaN(vessel.latitude) || isNaN(vessel.longitude)) {
      console.warn(`Skipping vessel ${vessel.name} - invalid coordinates`);
      return;
    }

    const color = getVesselColor(vessel.type);
    const isDocked = vessel.status === 'Docked';
    const displaySpeed = isDocked ? 0 : (vessel.speed || 0);
    
    // Create custom icon - docked vessels have reduced opacity
    const icon = L.divIcon({
      className: 'vessel-marker',
      html: `<div style="
        background: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid ${isDocked ? '#60a5fa' : 'white'};
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        ${isDocked ? 'opacity: 0.8;' : ''}
      ">${getVesselIcon(vessel.type)}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const marker = L.marker([vessel.latitude, vessel.longitude], { icon })
      .bindPopup(`
        <div style="color: #1e293b; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; color: #0ea5e9;">${vessel.name}</h3>
          <p style="margin: 4px 0;"><strong>Type:</strong> ${vessel.type}</p>
          <p style="margin: 4px 0;"><strong>Speed:</strong> ${displaySpeed} kn</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> 
            <span style="color: ${getStatusColor(vessel.status)}; font-weight: 600;">
              ${vessel.status}
            </span>
          </p>
          <p style="margin: 4px 0;"><strong>Engine Health:</strong> ${vessel.engine_health}%</p>
          <p style="margin: 4px 0;"><strong>Fuel:</strong> ${vessel.fuel_level}%</p>
          ${isDocked ? '<p style="margin: 8px 0 0 0; font-size: 11px; color: #60a5fa;">⚓ Vessel is docked</p>' : ''}
        </div>
      `)
      .addTo(markerLayer);

    marker.vesselId = vessel.id;
  });
}

function renderRoutesOnMap() {
  routeLayer.clearLayers();

  routesData.forEach(route => {
    if (route.waypoints && Array.isArray(route.waypoints)) {
      const color = getRiskColor(route.risk_level);
      
      const polyline = L.polyline(route.waypoints, {
        color: color,
        weight: 3,
        opacity: 0.7
      }).bindPopup(`
        <div style="color: #1e293b;">
          <h3 style="margin: 0 0 8px 0; color: #0ea5e9;">${route.route_name}</h3>
          <p style="margin: 4px 0;"><strong>Distance:</strong> ${route.distance_km} km</p>
          <p style="margin: 4px 0;"><strong>Risk:</strong> ${route.risk_level}</p>
          <p style="margin: 4px 0;"><strong>Weather:</strong> ${route.weather_condition || 'Good'}</p>
        </div>
      `).addTo(routeLayer);
    }
  });
}

function renderFleetList() {
  const fleetList = document.getElementById('fleetList');
  
  if (vesselsData.length === 0) {
    fleetList.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No vessels to display</p>';
    return;
  }

  fleetList.innerHTML = vesselsData.map(vessel => `
    <div class="fleet-item" onclick="focusVessel(${vessel.id})" style="
      padding: 12px;
      border-bottom: 1px solid #334155;
      cursor: pointer;
      transition: background 0.2s;
    " onmouseover="this.style.background='#334155'" onmouseout="this.style.background='transparent'">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${getVesselColor(vessel.type)};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          ${vessel.status === 'Docked' ? 'opacity: 0.7;' : ''}
        ">${getVesselIcon(vessel.type)}</div>
        <div style="flex: 1;">
          <h4 style="margin: 0; font-size: 14px;">${vessel.name}</h4>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary);">
            ${vessel.type} • ${vessel.status === 'Docked' ? '0' : (vessel.speed || 0)} kn
          </p>
        </div>
        <div style="
          padding: 4px 8px;
          border-radius: 4px;
          background: ${getStatusBackground(vessel.status)};
          color: ${getStatusColor(vessel.status)};
          font-size: 11px;
          font-weight: 600;
        ">${vessel.status}</div>
      </div>
    </div>
  `).join('');
}

// Get status badge background color
function getStatusBackground(status) {
  const colors = {
    'Active': '#10b98120',
    'Docked': '#60a5fa20',
    'Maintenance': '#f59e0b20'
  };
  return colors[status] || '#64748b20';
}

// Get status text color
function getStatusColor(status) {
  const colors = {
    'Active': '#10b981',
    'Docked': '#60a5fa',
    'Maintenance': '#f59e0b'
  };
  return colors[status] || '#64748b';
}
}

window.focusVessel = (id) => {
  const vessel = vesselsData.find(v => v.id === id);
  if (vessel) {
    map.setView([vessel.latitude, vessel.longitude], 6);
    
    // Find and open marker popup
    markerLayer.eachLayer(layer => {
      if (layer.vesselId === id) {
        layer.openPopup();
      }
    });
  }
};

window.refreshMap = () => {
  loadMapData();
};

function getVesselColor(type) {
  const colors = {
    'Cargo': '#0ea5e9',
    'Naval': '#10b981',
    'Tanker': '#f59e0b',
    'Submarine': '#a855f7'
  };
  return colors[type] || '#64748b';
}

function getVesselIcon(type) {
  const icons = {
    'Cargo': '🚢',
    'Naval': '⚓',
    'Tanker': '🛢️',
    'Submarine': '🌊'
  };
  return icons[type] || '🚢';
}

function getRiskColor(risk) {
  const colors = {
    'Low': '#10b981',
    'Medium': '#f59e0b',
    'High': '#ef4444'
  };
  return colors[risk] || '#64748b';
}

// Listen for updates from other pages
window.addEventListener('storage', (e) => {
  if (e.key === 'vesselUpdate') {
    loadMapData();
  }
});

window.logout = logout;
