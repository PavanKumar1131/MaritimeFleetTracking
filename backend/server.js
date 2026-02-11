// server.js - main entry point for the backend
// starts express server and sets up all API routes

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// import all route files
const authRoutes = require('./routes/authRoutes');
const vesselRoutes = require('./routes/vesselRoutes');
const routeRoutes = require('./routes/routeRoutes');
const alertRoutes = require('./routes/alertRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const trackingRoutes = require('./routes/trackingRoutes');

const app = express();

// middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // increased limit for file uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// serve the frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// api endpoints
app.use('/api/auth', authRoutes);
app.use('/api/vessels', vesselRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/tracking', trackingRoutes);

// health check endpoint for deployment
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// redirect root to login page
app.get('/', (req, res) => {
    res.redirect('/pages/login.html');
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'Maritime Fleet Tracking API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth - Authentication endpoints',
            vessels: '/api/vessels - Vessel management',
            routes: '/api/routes - Route management',
            alerts: '/api/alerts - Alert system',
            weather: '/api/weather - Weather data',
            upload: '/api/upload - File uploads (CSV/JSON)',
            tracking: '/api/tracking - Live tracking & submarines'
        }
    });
});

// catch errors
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// handle crashes
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

// get port from environment or default to 5000
const PORT = process.env.PORT || 5000;

// ============================================
// VESSEL MOVEMENT SIMULATION
// Moves vessels along their routes every 30 seconds
// ============================================
const db = require('./config/db');

// Store vessel progress along routes (waypoint index)
const vesselProgress = new Map();

function simulateVesselMovement() {
    // Get all active vessels with their routes and waypoints
    const query = `
        SELECT 
            v.vessel_id,
            v.name,
            v.status,
            vl.latitude as current_lat,
            vl.longitude as current_lng,
            vl.speed,
            r.route_id
        FROM vessels v
        LEFT JOIN (
            SELECT vl1.* FROM vessel_locations vl1
            INNER JOIN (
                SELECT vessel_id, MAX(timestamp) as max_ts
                FROM vessel_locations GROUP BY vessel_id
            ) vl2 ON vl1.vessel_id = vl2.vessel_id AND vl1.timestamp = vl2.max_ts
        ) vl ON v.vessel_id = vl.vessel_id
        LEFT JOIN routes r ON r.vessel_id = v.vessel_id
        WHERE v.status = 'Active'
    `;
    
    db.query(query, (err, vessels) => {
        if (err) {
            console.error('Movement sim error:', err.message);
            return;
        }
        
        if (!vessels || vessels.length === 0) return;
        
        vessels.forEach(vessel => {
            if (!vessel.route_id) return;
            
            // Get waypoints for this vessel's route
            db.query(
                `SELECT latitude as lat, longitude as lng, order_index 
                 FROM route_waypoints 
                 WHERE route_id = ? 
                 ORDER BY order_index`,
                [vessel.route_id],
                (err, waypoints) => {
                    if (err || !waypoints || waypoints.length < 2) return;
                    
                    // Get or initialize progress for this vessel
                    let progress = vesselProgress.get(vessel.vessel_id) || { 
                        waypointIndex: 0, 
                        progressBetween: 0 
                    };
                    
                    const currentWpIndex = progress.waypointIndex;
                    const nextWpIndex = currentWpIndex + 1;
                    
                    // If reached end, loop back to start
                    if (nextWpIndex >= waypoints.length) {
                        progress.waypointIndex = 0;
                        progress.progressBetween = 0;
                        vesselProgress.set(vessel.vessel_id, progress);
                        return;
                    }
                    
                    // Parse coordinates as floats (they come as strings from DB)
                    const currentWp = {
                        lat: parseFloat(waypoints[currentWpIndex].lat),
                        lng: parseFloat(waypoints[currentWpIndex].lng)
                    };
                    const nextWp = {
                        lat: parseFloat(waypoints[nextWpIndex].lat),
                        lng: parseFloat(waypoints[nextWpIndex].lng)
                    };
                    
                    // Calculate distance between waypoints
                    const latDiff = nextWp.lat - currentWp.lat;
                    const lngDiff = nextWp.lng - currentWp.lng;
                    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
                    
                    // Move ~5-15% of segment per update based on speed
                    const speedFactor = (parseFloat(vessel.speed) || 10) / 100;
                    const moveAmount = 0.05 + (speedFactor * 0.1);
                    
                    progress.progressBetween += moveAmount;
                    
                    // If reached next waypoint, move to next segment
                    if (progress.progressBetween >= 1) {
                        progress.waypointIndex++;
                        progress.progressBetween = 0;
                    }
                    
                    vesselProgress.set(vessel.vessel_id, progress);
                    
                    // Calculate new position
                    const t = Math.min(progress.progressBetween, 1);
                    const newLat = currentWp.lat + (latDiff * t);
                    const newLng = currentWp.lng + (lngDiff * t);
                    
                    // Calculate direction (heading)
                    const direction = Math.atan2(lngDiff, latDiff) * (180 / Math.PI);
                    
                    // Update vessel location (silent - no logging)
                    db.query(
                        `INSERT INTO vessel_locations (vessel_id, latitude, longitude, speed, direction)
                         VALUES (?, ?, ?, ?, ?)`,
                        [vessel.vessel_id, newLat.toFixed(6), newLng.toFixed(6), vessel.speed || 10, direction.toFixed(2)]
                    );
                }
            );
        });
    });
}

// Start vessel movement simulation (every 30 seconds)
let movementInterval;
function startVesselSimulation() {
    console.log('🌊 Vessel movement simulation started (updates every 30s)');
    movementInterval = setInterval(simulateVesselMovement, 30000);
    // Run once immediately
    setTimeout(simulateVesselMovement, 2000);
}

// start the server
app.listen(PORT, () => {
    console.log('🚢 Maritime Fleet Tracking System');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`📁 Frontend served at http://localhost:${PORT}`);
    console.log(`🔐 Login at http://localhost:${PORT}/pages/login.html`);
    console.log(`📋 API docs at http://localhost:${PORT}/api`);
    
    // Start vessel movement simulation
    startVesselSimulation();
});
