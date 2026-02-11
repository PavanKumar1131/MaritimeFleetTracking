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

// start the server
app.listen(PORT, () => {
    console.log('🚢 Maritime Fleet Tracking System');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`📁 Frontend served at http://localhost:${PORT}`);
    console.log(`🔐 Login at http://localhost:${PORT}/pages/login.html`);
    console.log(`📋 API docs at http://localhost:${PORT}/api`);
});
