// analytics.js - analytics page with charts
// uses chart.js library for the graphs

import { checkAuth, fetchWithAuth, logout } from './auth.js';

const API_URL = 'http://localhost:5000/api';

let vesselsData = [];
let routesData = [];
let charts = {};

// page load
window.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  // setup sidebar user info
  document.getElementById('userName').textContent = user.name || user.email;
  document.getElementById('userRole').textContent = user.role.toUpperCase();
  document.getElementById('userAvatar').textContent = (user.name || user.email).substring(0, 2).toUpperCase();

  if (user.role === 'admin') {
    document.getElementById('adminLink').style.display = 'flex';
  }

  await loadAnalyticsData();
});

// fetch data and build charts
async function loadAnalyticsData() {
  try {
    const [vesselsRes, routesRes] = await Promise.all([
      fetchWithAuth(`${API_URL}/vessels`),
      fetchWithAuth(`${API_URL}/routes`)
    ]);

    if (!vesselsRes.ok || !routesRes.ok) throw new Error('Failed to fetch data');
    
    vesselsData = await vesselsRes.json();
    routesData = await routesRes.json();
    
    createCharts();
    populateMetricsTable();
  } catch (error) {
    console.error('Error loading analytics:', error);
    alert('Failed to load analytics data');
  }
}

// creates all the charts using chart.js
function createCharts() {
  // destroy old charts first so we dont have memory leaks
  Object.values(charts).forEach(chart => chart.destroy());
  charts = {};

  // pie chart showing vessel types
  const compositionData = vesselsData.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {});

  charts.composition = new Chart(document.getElementById('fleetCompositionChart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(compositionData),
      datasets: [{
        data: Object.values(compositionData),
        backgroundColor: ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { size: 12 } }
        }
      }
    }
  });

  // bar chart for route risk levels
  const riskData = routesData.reduce((acc, r) => {
    acc[r.risk_level] = (acc[r.risk_level] || 0) + 1;
    return acc;
  }, { Low: 0, Medium: 0, High: 0 });

  charts.risk = new Chart(document.getElementById('riskDistributionChart'), {
    type: 'bar',
    data: {
      labels: ['Low', 'Medium', 'High'],
      datasets: [{
        label: 'Routes',
        data: [riskData.Low, riskData.Medium, riskData.High],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 0,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#94a3b8', stepSize: 1 },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        },
        x: {
          ticks: { color: '#94a3b8' },
          grid: { display: false }
        }
      }
    }
  });

  // line chart comparing vessel speeds
  charts.speed = new Chart(document.getElementById('speedComparisonChart'), {
    type: 'line',
    data: {
      labels: vesselsData.map(v => v.name),
      datasets: [{
        label: 'Speed (knots)',
        data: vesselsData.map(v => v.speed || 0),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: '#94a3b8' } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        },
        x: {
          ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 },
          grid: { display: false }
        }
      }
    }
  });

  // radar chart for engine health
  charts.engine = new Chart(document.getElementById('engineHealthChart'), {
    type: 'radar',
    data: {
      labels: vesselsData.map(v => v.name),
      datasets: [{
        label: 'Engine Health %',
        data: vesselsData.map(v => v.engine_health),
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: '#10b981',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: '#94a3b8' } }
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { color: '#94a3b8', backdropColor: 'transparent' },
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          pointLabels: { color: '#94a3b8', font: { size: 10 } }
        }
      }
    }
  });

  // horizontal bar chart for fuel levels
  charts.fuel = new Chart(document.getElementById('fuelLevelChart'), {
    type: 'bar',
    data: {
      labels: vesselsData.map(v => v.name),
      datasets: [{
        label: 'Fuel Level %',
        data: vesselsData.map(v => v.fuel_level || 0),
        backgroundColor: vesselsData.map(v => 
          (v.fuel_level || 0) >= 50 ? '#10b981' : (v.fuel_level || 0) >= 20 ? '#f59e0b' : '#ef4444'
        ),
        borderWidth: 0,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        },
        y: {
          ticks: { color: '#94a3b8' },
          grid: { display: false }
        }
      }
    }
  });
}

// fills in the metrics table
function populateMetricsTable() {
  const tbody = document.getElementById('metricsTableBody');
  
  tbody.innerHTML = vesselsData.map(vessel => {
    // calculate efficiency based on engine, fuel and speed
    const efficiencyScore = Math.round((vessel.engine_health * 0.4) + ((vessel.fuel_level || 0) * 0.3) + (((vessel.speed || 0) / 30) * 100 * 0.3));
    const scoreColor = efficiencyScore >= 80 ? '#10b981' : efficiencyScore >= 60 ? '#f59e0b' : '#ef4444';

    return `
      <tr>
        <td><strong>${vessel.name}</strong></td>
        <td><span class="badge badge-${vessel.type.toLowerCase()}">${vessel.type}</span></td>
        <td>${vessel.speed || 0} kn</td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${vessel.engine_health}%; background: ${vessel.engine_health >= 80 ? '#10b981' : vessel.engine_health >= 50 ? '#f59e0b' : '#ef4444'};"></div>
          </div>
          <span style="font-size: 11px; color: var(--text-secondary);">${vessel.engine_health}%</span>
        </td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${vessel.fuel_level || 0}%; background: ${(vessel.fuel_level || 0) >= 50 ? '#10b981' : (vessel.fuel_level || 0) >= 20 ? '#f59e0b' : '#ef4444'};"></div>
          </div>
          <span style="font-size: 11px; color: var(--text-secondary);">${vessel.fuel_level || 0}%</span>
        </td>
        <td>
          <span style="color: ${scoreColor}; font-weight: 600;">
            ${efficiencyScore}/100
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// refresh button
window.refreshAnalytics = () => {
  loadAnalyticsData();
};

// back to dashboard
window.goToDashboard = () => {
  const role = document.getElementById('userRole').textContent.toLowerCase();
  if (role === 'admin') {
    window.location.href = 'admin-dashboard.html';
  } else if (role === 'operator') {
    window.location.href = 'operator-dashboard.html';
  } else {
    window.location.href = 'viewer-dashboard.html';
  }
};

// reload data if another tab updates vessels
window.addEventListener('storage', (e) => {
  if (e.key === 'vesselUpdate') {
    loadAnalyticsData();
  }
});

window.logout = logout;
