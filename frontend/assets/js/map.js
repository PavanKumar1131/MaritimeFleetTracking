import { checkAuth, fetchWithAuth, logout } from './auth.js';

const API_URL = 'http://localhost:5000/api';

let map;
let vesselsData = [];
let routesData = [];
let markerLayer;
let routeLayer;

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
  
  document.getElementById('logoutBtn').addEventListener('click', logout);
});

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
    const color = getVesselColor(vessel.type);
    
    // Create custom icon
    const icon = L.divIcon({
      className: 'vessel-marker',
      html: `<div style="
        background: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      ">${getVesselIcon(vessel.type)}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const marker = L.marker([vessel.latitude, vessel.longitude], { icon })
      .bindPopup(`
        <div style="color: #1e293b; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; color: #0ea5e9;">${vessel.name}</h3>
          <p style="margin: 4px 0;"><strong>Type:</strong> ${vessel.type}</p>
          <p style="margin: 4px 0;"><strong>Speed:</strong> ${vessel.speed || 0} kn</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> ${vessel.status}</p>
          <p style="margin: 4px 0;"><strong>Engine Health:</strong> ${vessel.engine_health}%</p>
          <p style="margin: 4px 0;"><strong>Fuel:</strong> ${vessel.fuel_level}%</p>
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
        ">${getVesselIcon(vessel.type)}</div>
        <div style="flex: 1;">
          <h4 style="margin: 0; font-size: 14px;">${vessel.name}</h4>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary);">
            ${vessel.type} • ${vessel.speed || 0} kn
          </p>
        </div>
        <div style="
          padding: 4px 8px;
          border-radius: 4px;
          background: ${vessel.status === 'Active' ? '#10b98120' : '#f59e0b20'};
          color: ${vessel.status === 'Active' ? '#10b981' : '#f59e0b'};
          font-size: 11px;
          font-weight: 600;
        ">${vessel.status}</div>
      </div>
    </div>
  `).join('');
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
