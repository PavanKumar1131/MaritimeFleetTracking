// weatherRoutes.js
// API endpoints for weather data

const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Get weather by coordinates
router.get('/coords', weatherController.getWeatherByCoords);

// Get weather for a specific vessel
router.get('/vessel/:vesselId', weatherController.getVesselWeather);

// Get weather along a route
router.get('/route/:routeId', weatherController.getRouteWeather);

// Bulk update weather for all vessels (useful for scheduled updates)
router.post('/update-all', weatherController.updateAllVesselsWeather);

module.exports = router;
