import { checkAuth, fetchWithAuth, logout } from './auth.js';

const API_URL = 'http://localhost:5000/api';

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  document.getElementById('userName').textContent = user.name || user.email;
  document.getElementById('userRole').textContent = user.role.toUpperCase();
  document.getElementById('userAvatar').textContent = (user.name || user.email).substring(0, 2).toUpperCase();

  loadDashboardData();
});

async function loadDashboardData() {
  try {
    const [vesselsRes, statsRes, routeStatsRes] = await Promise.all([
      fetchWithAuth(`${API_URL}/vessels`),
      fetchWithAuth(`${API_URL}/vessels/stats`),
      fetchWithAuth(`${API_URL}/routes/stats`)
    ]);

    if (!vesselsRes.ok || !statsRes.ok || !routeStatsRes.ok) {
      throw new Error('Failed to fetch data');
    }

    const vessels = await vesselsRes.json();
    const stats = await statsRes.json();
    const routeStats = await routeStatsRes.json();

    // Update stats cards
    document.getElementById('totalVessels').textContent = stats.totalVessels;
    document.getElementById('activeVessels').textContent = stats.activeVessels;
    document.getElementById('avgSpeed').textContent = `${stats.avgSpeed.toFixed(1)} kn`;
    document.getElementById('avgFuel').textContent = `${stats.avgFuelLevel.toFixed(0)}%`;

    // Populate vessels table
    const tbody = document.getElementById('vesselsTableBody');
    tbody.innerHTML = vessels.map(vessel => {
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
        </tr>
      `;
    }).join('');

    // Update fleet composition
    const compositionData = vessels.reduce((acc, v) => {
      acc[v.type] = (acc[v.type] || 0) + 1;
      return acc;
    }, {});

    const compositionContainer = document.getElementById('fleetComposition');
    compositionContainer.innerHTML = Object.entries(compositionData).map(([type, count]) => {
      const percentage = (count / vessels.length * 100).toFixed(0);
      return `
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 13px;">${type}</span>
            <span style="font-size: 13px; color: var(--text-secondary);">${count} (${percentage}%)</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%; background: var(--primary);"></div>
          </div>
        </div>
      `;
    }).join('');

    // Update route stats
    document.getElementById('lowRisk').textContent = routeStats.low || 0;
    document.getElementById('mediumRisk').textContent = routeStats.medium || 0;
    document.getElementById('highRisk').textContent = routeStats.high || 0;

    // Update performance averages
    document.getElementById('avgEngineHealth').textContent = `${stats.avgEngineHealth.toFixed(0)}%`;
    const engineColor = stats.avgEngineHealth >= 80 ? '#10b981' : stats.avgEngineHealth >= 50 ? '#f59e0b' : '#ef4444';
    document.getElementById('avgEngineHealth').style.color = engineColor;

    document.getElementById('avgFuelLevel').textContent = `${stats.avgFuelLevel.toFixed(0)}%`;
    const fuelColor = stats.avgFuelLevel >= 50 ? '#10b981' : stats.avgFuelLevel >= 20 ? '#f59e0b' : '#ef4444';
    document.getElementById('avgFuelLevel').style.color = fuelColor;

    document.getElementById('avgSpeedKnots').textContent = `${stats.avgSpeed.toFixed(1)} kn`;

  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

// Listen for updates from other pages
window.addEventListener('storage', (e) => {
  if (e.key === 'vesselUpdate') {
    loadDashboardData();
  }
});

window.logout = logout;
