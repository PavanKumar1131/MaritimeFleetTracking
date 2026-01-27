// Admin Dashboard Module
import { checkAuth, logout, fetchWithAuth, API_URL } from './auth.js';

// Make logout available globally
window.logout = logout;

// Initialize dashboard
(async () => {
  const user = await checkAuth();
  if (!user) return;

  document.getElementById('userName').textContent = user.name || user.email;
  document.getElementById('userRole').textContent = user.role.toUpperCase();
  document.getElementById('welcomeUser').textContent = user.name || user.email;
  document.getElementById('userAvatar').textContent = (user.name || user.email).substring(0, 2).toUpperCase();
  
  // Show admin panel link if admin
  if (user.role === 'admin') {
    const adminLink = document.getElementById('adminPanelLink');
    if (adminLink) adminLink.style.display = 'flex';
  }

  await loadDashboard();
})();

// Load dashboard data
async function loadDashboard() {
  try {
    // Fetch vessels
    const vesselsRes = await fetchWithAuth(`${API_URL}/vessels`);
    const vessels = await vesselsRes.json();

    // Fetch vessel stats
    const statsRes = await fetchWithAuth(`${API_URL}/vessels/stats`);
    const stats = await statsRes.json();

    // Fetch route stats
    const routeStatsRes = await fetchWithAuth(`${API_URL}/routes/stats`);
    const routeStats = await routeStatsRes.json();

    // Update stats cards
    document.getElementById('totalVessels').textContent = stats.total_vessels || vessels.length || 0;
    document.getElementById('activeVessels').textContent = stats.active_vessels || 0;
    document.getElementById('avgSpeed').textContent = (parseFloat(stats.avg_speed) || 0).toFixed(1) + ' kn';
    document.getElementById('avgHealth').textContent = Math.round(stats.avg_engine_health || 0) + '%';

    // Update route risk
    const lowRiskEl = document.getElementById('lowRisk');
    const mediumRiskEl = document.getElementById('mediumRisk');
    const highRiskEl = document.getElementById('highRisk');
    if (lowRiskEl) lowRiskEl.textContent = (routeStats.low_risk || routeStats.low || 0) + ' routes';
    if (mediumRiskEl) mediumRiskEl.textContent = (routeStats.medium_risk || routeStats.medium || 0) + ' routes';
    if (highRiskEl) highRiskEl.textContent = (routeStats.high_risk || routeStats.high || 0) + ' routes';

    // Populate vessel table (show first 5 only)
    const tableBody = document.getElementById('vesselTable');
    if (tableBody) {
      tableBody.innerHTML = vessels.slice(0, 5).map(vessel => {
        const weatherBadge = getWeatherBadge(vessel.weather_status);
        const typeBadge = getTypeBadge(vessel.type);
        
        return `
          <tr>
            <td><strong>${vessel.name}</strong></td>
            <td>${typeBadge}</td>
            <td>${vessel.speed || 0} kn</td>
            <td>
              <div class="progress-bar" style="width: 100px;">
                <div class="progress-fill" style="width: ${vessel.engine_health}%; background: ${vessel.engine_health >= 80 ? '#10b981' : vessel.engine_health >= 50 ? '#f59e0b' : '#ef4444'};"></div>
              </div>
              <span style="font-size: 12px; color: #94a3b8;">${vessel.engine_health}%</span>
            </td>
            <td>${weatherBadge}</td>
          </tr>
        `;
      }).join('');
    }

    // Populate vessels table body if exists
    const tbody = document.getElementById('vesselsTableBody');
    if (tbody) {
      if (vessels.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:#64748b;">No vessels found</td></tr>';
      } else {
        tbody.innerHTML = vessels.map(v => `
          <tr>
            <td>${v.id}</td>
            <td><strong>${v.name}</strong></td>
            <td>${getTypeBadge(v.type)}</td>
            <td>${v.speed || 0} kn</td>
            <td style="font-size: 11px;">${v.latitude ? v.latitude.toFixed(4) : 'N/A'}, ${v.longitude ? v.longitude.toFixed(4) : 'N/A'}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="flex: 1; background: #1e293b; border-radius: 4px; height: 8px; overflow: hidden;">
                  <div style="background: ${v.engine_health >= 80 ? '#10b981' : v.engine_health >= 50 ? '#f59e0b' : '#ef4444'}; height: 100%; width: ${v.engine_health}%;"></div>
                </div>
                <span style="font-size: 12px; min-width: 35px;">${v.engine_health}%</span>
              </div>
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="flex: 1; background: #1e293b; border-radius: 4px; height: 8px; overflow: hidden;">
                  <div style="background: ${(v.fuel_level || 0) >= 50 ? '#10b981' : (v.fuel_level || 0) >= 20 ? '#f59e0b' : '#ef4444'}; height: 100%; width: ${v.fuel_level || 0}%;"></div>
                </div>
                <span style="font-size: 12px; min-width: 35px;">${v.fuel_level || 0}%</span>
              </div>
            </td>
            <td><span class="badge badge-${v.status.toLowerCase()}">${v.status}</span></td>
          </tr>
        `).join('');
      }
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

function getWeatherBadge(weather) {
  const weatherMap = {
    'Clear': '<span class="badge badge-success">Clear</span>',
    'Foggy': '<span class="badge badge-warning">Foggy</span>',
    'Rainy': '<span class="badge badge-warning">Rainy</span>',
    'Stormy': '<span class="badge badge-danger">Stormy</span>',
    'N/A': '<span class="badge badge-info">N/A</span>'
  };
  return weatherMap[weather] || `<span class="badge badge-info">${weather || 'N/A'}</span>`;
}

function getTypeBadge(type) {
  const typeMap = {
    'Cargo': '<span class="badge badge-info">Cargo</span>',
    'Naval': '<span class="badge badge-success">Naval</span>',
    'Tanker': '<span class="badge badge-warning">Tanker</span>',
    'Submarine': '<span class="badge badge-info">Submarine</span>'
  };
  return typeMap[type] || `<span class="badge">${type}</span>`;
}

// Listen for updates from other pages
window.addEventListener('storage', (e) => {
  if (e.key === 'vesselUpdate') {
    loadDashboard();
  }
});

