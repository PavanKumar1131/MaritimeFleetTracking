// Seed script to add vessels and routes with realistic sea paths
const mysql = require('mysql2/promise');
require('dotenv').config();

const vessels = [
  {
    name: 'MV Indian Pride',
    type: 'Cargo',
    engine_health: 92,
    fuel_level: 78,
    weather_status: 'Clear',
    status: 'Active',
    // Mumbai Port coordinates
    latitude: 18.9498,
    longitude: 72.8355,
    speed: 14.5,
    route: {
      name: 'Mumbai to Dubai Express',
      risk_level: 'low',
      destination: { lat: 25.0657, lng: 55.1713 } // Dubai - Jebel Ali
    }
  },
  {
    name: 'SS Bay Navigator',
    type: 'Tanker',
    engine_health: 85,
    fuel_level: 65,
    weather_status: 'Moderate',
    status: 'Active',
    // Chennai Port coordinates
    latitude: 13.0827,
    longitude: 80.2707,
    speed: 12.8,
    route: {
      name: 'Chennai to Singapore Route',
      risk_level: 'medium',
      destination: { lat: 1.2644, lng: 103.8200 } // Singapore
    }
  },
  {
    name: 'USS Atlantic Voyager',
    type: 'Naval',
    engine_health: 67,
    fuel_level: 45,
    weather_status: 'Stormy',
    status: 'Active',
    // New York Port coordinates
    latitude: 40.6840,
    longitude: -74.0062,
    speed: 18.2,
    route: {
      name: 'Transatlantic NYC to London',
      risk_level: 'high',
      destination: { lat: 51.5074, lng: 0.1278 } // London
    }
  }
];

// Generate realistic sea route waypoints
function generateSeaRoute(startLat, startLng, endLat, endLng) {
  const waypoints = [];
  const latDiff = endLat - startLat;
  const lngDiff = endLng - startLng;
  const totalDistance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  const numPoints = Math.max(8, Math.min(15, Math.floor(totalDistance / 5)));
  
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    let lat = startLat + latDiff * t;
    let lng = startLng + lngDiff * t;
    
    // Add curve to simulate realistic sea navigation
    const curveIntensity = Math.sin(t * Math.PI) * Math.min(5, totalDistance / 15);
    const perpLat = -lngDiff / (totalDistance || 1);
    const perpLng = latDiff / (totalDistance || 1);
    
    lat += perpLat * curveIntensity * 0.4;
    lng += perpLng * curveIntensity * 0.3;
    
    // Arabian Sea route adjustment (Mumbai to Dubai)
    if (startLng > 70 && endLng < 60 && lat > 15 && lat < 28) {
      // Curve south through Arabian Sea
      lat -= curveIntensity * 0.3;
    }
    
    // Bay of Bengal to Singapore - go through Malacca Strait
    if (startLng > 78 && startLng < 82 && endLng > 100) {
      if (t > 0.3 && t < 0.7) {
        // Route through Andaman Sea and Malacca Strait
        lat = Math.max(lat, 4); // Stay in shipping lane
      }
    }
    
    waypoints.push({ lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) });
  }
  
  return waypoints;
}

async function seedData() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    
    console.log('🔗 Connected to database\n');
    
    for (const vessel of vessels) {
      console.log(`\n🚢 Adding vessel: ${vessel.name}`);
      
      // Insert vessel
      const [vesselResult] = await connection.execute(
        `INSERT INTO vessels (name, type, engine_health, weather_status, status) VALUES (?, ?, ?, ?, ?)`,
        [vessel.name, vessel.type, vessel.engine_health, vessel.weather_status, vessel.status]
      );
      
      const vesselId = vesselResult.insertId;
      console.log(`   ✅ Vessel created with ID: ${vesselId}`);
      
      // Insert vessel location
      await connection.execute(
        `INSERT INTO vessel_locations (vessel_id, latitude, longitude, speed, direction) VALUES (?, ?, ?, ?, ?)`,
        [vesselId, vessel.latitude, vessel.longitude, vessel.speed, 0]
      );
      console.log(`   📍 Location set: ${vessel.latitude}, ${vessel.longitude}`);
      
      // Insert engine log with fuel level
      await connection.execute(
        `INSERT INTO engine_logs (vessel_id, engine_health, fuel_level) VALUES (?, ?, ?)`,
        [vesselId, vessel.engine_health, vessel.fuel_level]
      );
      console.log(`   🔧 Engine health: ${vessel.engine_health}%, Fuel: ${vessel.fuel_level}%`);
      
      // Create route
      const [routeResult] = await connection.execute(
        `INSERT INTO routes (route_name, vessel_id, risk_level, status, description) VALUES (?, ?, ?, ?, ?)`,
        [
          vessel.route.name, 
          vesselId, 
          vessel.route.risk_level, 
          'active',
          `Route from vessel starting position to destination`
        ]
      );
      
      const routeId = routeResult.insertId;
      console.log(`   🧭 Route created: ${vessel.route.name} (${vessel.route.risk_level} risk)`);
      
      // Generate and insert waypoints
      const waypoints = generateSeaRoute(
        vessel.latitude, 
        vessel.longitude, 
        vessel.route.destination.lat, 
        vessel.route.destination.lng
      );
      
      for (let i = 0; i < waypoints.length; i++) {
        await connection.execute(
          `INSERT INTO route_waypoints (route_id, latitude, longitude, order_index) VALUES (?, ?, ?, ?)`,
          [routeId, waypoints[i].lat, waypoints[i].lng, i + 1]
        );
      }
      console.log(`   📊 Added ${waypoints.length} waypoints for sea route`);
      
      // Create alert based on vessel condition
      if (vessel.engine_health < 70) {
        await connection.execute(
          `INSERT INTO alerts (alert_type, severity, vessel_id, message) VALUES (?, ?, ?, ?)`,
          ['Engine Warning', 'warning', vesselId, `${vessel.name} engine health is at ${vessel.engine_health}% - maintenance recommended`]
        );
        console.log(`   ⚠️ Engine warning alert created`);
      }
      
      if (vessel.fuel_level < 50) {
        await connection.execute(
          `INSERT INTO alerts (alert_type, severity, vessel_id, message) VALUES (?, ?, ?, ?)`,
          ['Low Fuel', 'warning', vesselId, `${vessel.name} fuel level is at ${vessel.fuel_level}% - refueling needed`]
        );
        console.log(`   ⛽ Low fuel alert created`);
      }
      
      if (vessel.weather_status === 'Stormy') {
        await connection.execute(
          `INSERT INTO alerts (alert_type, severity, vessel_id, message) VALUES (?, ?, ?, ?)`,
          ['Weather Alert', 'critical', vesselId, `${vessel.name} is navigating through stormy conditions on ${vessel.route.name}`]
        );
        console.log(`   🌧️ Weather alert created`);
      }
      
      if (vessel.route.risk_level === 'high') {
        await connection.execute(
          `INSERT INTO alerts (alert_type, severity, vessel_id, message) VALUES (?, ?, ?, ?)`,
          ['Route Risk', 'critical', vesselId, `${vessel.name} is on high-risk route: ${vessel.route.name}`]
        );
        console.log(`   🚨 High risk route alert created`);
      }
    }
    
    console.log('\n✅ All vessels and routes seeded successfully!\n');
    
    // Summary
    console.log('📋 SUMMARY:');
    console.log('─────────────────────────────────────────');
    console.log('1. MV Indian Pride - Mumbai → Dubai (Low Risk)');
    console.log('   • Cargo vessel, Good condition');
    console.log('');
    console.log('2. SS Bay Navigator - Chennai → Singapore (Medium Risk)');
    console.log('   • Tanker, Moderate weather');
    console.log('');
    console.log('3. USS Atlantic Voyager - New York → London (High Risk)');
    console.log('   • Naval vessel, Stormy weather, Low fuel, Engine issues');
    console.log('─────────────────────────────────────────');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

seedData();
