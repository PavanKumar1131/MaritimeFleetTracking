// weatherController.js
// handles weather data fetching for vessel locations
// uses OpenWeatherMap API (free tier available)

const db = require('../config/db');

// OpenWeatherMap API - you can get a free API key at https://openweathermap.org/api
// For demo purposes, we'll use mock data if no API key is set
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || '';
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather';

// Weather condition mappings for maritime context
const weatherConditions = {
    'Clear': { icon: '☀️', severity: 'low', description: 'Clear skies, good visibility' },
    'Clouds': { icon: '☁️', severity: 'low', description: 'Cloudy conditions' },
    'Rain': { icon: '🌧️', severity: 'medium', description: 'Rainy, reduced visibility' },
    'Drizzle': { icon: '🌦️', severity: 'low', description: 'Light rain, minor impact' },
    'Thunderstorm': { icon: '⛈️', severity: 'high', description: 'Storm warning - exercise caution' },
    'Snow': { icon: '❄️', severity: 'medium', description: 'Snow conditions, cold temperatures' },
    'Mist': { icon: '🌫️', severity: 'medium', description: 'Misty, reduced visibility' },
    'Fog': { icon: '🌫️', severity: 'high', description: 'Dense fog - navigation hazard' },
    'Haze': { icon: '🌫️', severity: 'low', description: 'Hazy conditions' },
    'Stormy': { icon: '🌊', severity: 'high', description: 'Stormy seas - high risk' }
};

// Get weather for specific coordinates
exports.getWeatherByCoords = async (req, res) => {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    try {
        const weatherData = await fetchWeatherData(parseFloat(lat), parseFloat(lon));
        res.json(weatherData);
    } catch (error) {
        console.error('Weather API error:', error);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
};

// Get weather for a specific vessel
exports.getVesselWeather = async (req, res) => {
    const { vesselId } = req.params;
    
    try {
        // Get vessel's current location
        const locationQuery = `
            SELECT latitude, longitude 
            FROM vessel_locations 
            WHERE vessel_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 1
        `;
        
        db.query(locationQuery, [vesselId], async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0) {
                return res.status(404).json({ error: 'Vessel location not found' });
            }
            
            const { latitude, longitude } = results[0];
            const weatherData = await fetchWeatherData(latitude, longitude);
            
            // Update vessel's weather status in database
            const updateQuery = 'UPDATE vessels SET weather_status = ? WHERE vessel_id = ?';
            db.query(updateQuery, [weatherData.condition, vesselId]);
            
            res.json(weatherData);
        });
    } catch (error) {
        console.error('Weather fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch weather' });
    }
};

// Bulk update weather for all active vessels
exports.updateAllVesselsWeather = async (req, res) => {
    try {
        // Get all active vessels with their locations
        const query = `
            SELECT v.vessel_id, vl.latitude, vl.longitude
            FROM vessels v
            INNER JOIN (
                SELECT vessel_id, latitude, longitude
                FROM vessel_locations vl1
                WHERE timestamp = (
                    SELECT MAX(timestamp) 
                    FROM vessel_locations vl2 
                    WHERE vl2.vessel_id = vl1.vessel_id
                )
            ) vl ON v.vessel_id = vl.vessel_id
            WHERE v.status = 'Active' AND v.type != 'Submarine'
        `;
        
        db.query(query, async (err, vessels) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const weatherUpdates = [];
            
            for (const vessel of vessels) {
                try {
                    const weather = await fetchWeatherData(vessel.latitude, vessel.longitude);
                    weatherUpdates.push({
                        vessel_id: vessel.vessel_id,
                        weather: weather
                    });
                    
                    // Update vessel weather status
                    db.query(
                        'UPDATE vessels SET weather_status = ? WHERE vessel_id = ?',
                        [weather.condition, vessel.vessel_id]
                    );
                } catch (e) {
                    console.error(`Failed to get weather for vessel ${vessel.vessel_id}`);
                }
            }
            
            res.json({
                message: 'Weather updated for all vessels',
                updated: weatherUpdates.length,
                data: weatherUpdates
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update weather' });
    }
};

// Get weather forecast along a route
exports.getRouteWeather = async (req, res) => {
    const { routeId } = req.params;
    
    try {
        const query = `
            SELECT latitude, longitude, order_index
            FROM route_waypoints
            WHERE route_id = ?
            ORDER BY order_index
        `;
        
        db.query(query, [routeId], async (err, waypoints) => {
            if (err) return res.status(500).json({ error: err.message });
            if (waypoints.length === 0) {
                return res.status(404).json({ error: 'Route not found or has no waypoints' });
            }
            
            const weatherAlongRoute = [];
            
            // Get weather for each waypoint
            for (const wp of waypoints) {
                const weather = await fetchWeatherData(wp.latitude, wp.longitude);
                weatherAlongRoute.push({
                    waypoint: wp.order_index,
                    lat: wp.latitude,
                    lng: wp.longitude,
                    weather: weather
                });
            }
            
            // Calculate overall route weather severity
            const severities = weatherAlongRoute.map(w => w.weather.severity);
            const overallSeverity = severities.includes('high') ? 'high' 
                : severities.includes('medium') ? 'medium' : 'low';
            
            res.json({
                route_id: routeId,
                overall_severity: overallSeverity,
                waypoint_weather: weatherAlongRoute
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch route weather' });
    }
};

// Helper function to fetch weather data
async function fetchWeatherData(lat, lon) {
    // If we have an API key, use real weather data
    if (WEATHER_API_KEY) {
        try {
            const response = await fetch(
                `${WEATHER_API_URL}?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric`
            );
            
            if (!response.ok) throw new Error('Weather API request failed');
            
            const data = await response.json();
            const condition = data.weather[0].main;
            const conditionInfo = weatherConditions[condition] || weatherConditions['Clear'];
            
            return {
                condition: condition,
                icon: conditionInfo.icon,
                severity: conditionInfo.severity,
                description: conditionInfo.description,
                temperature: Math.round(data.main.temp),
                humidity: data.main.humidity,
                wind_speed: Math.round(data.wind.speed * 1.944), // Convert m/s to knots
                wind_direction: data.wind.deg,
                visibility: data.visibility ? Math.round(data.visibility / 1000) : 10, // km
                pressure: data.main.pressure,
                feels_like: Math.round(data.main.feels_like),
                clouds: data.clouds.all,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Real weather API failed, using mock data:', error);
            return generateMockWeather(lat, lon);
        }
    }
    
    // Use mock weather data for demo purposes
    return generateMockWeather(lat, lon);
}

// Generate realistic mock weather based on location
function generateMockWeather(lat, lon) {
    // Simulate weather patterns based on latitude
    const absLat = Math.abs(lat);
    let conditions = ['Clear', 'Clouds'];
    
    // Tropical regions have more rain
    if (absLat < 23.5) {
        conditions = ['Clear', 'Clouds', 'Rain', 'Thunderstorm'];
    }
    // Temperate regions
    else if (absLat < 45) {
        conditions = ['Clear', 'Clouds', 'Rain', 'Fog', 'Mist'];
    }
    // Higher latitudes - more extreme weather
    else {
        conditions = ['Clear', 'Clouds', 'Snow', 'Fog', 'Stormy'];
    }
    
    // Add some randomness based on longitude too
    const seed = Math.abs(lat * lon) % 100;
    const conditionIndex = Math.floor(seed % conditions.length);
    const condition = conditions[conditionIndex];
    const conditionInfo = weatherConditions[condition] || weatherConditions['Clear'];
    
    // Generate realistic temperature based on latitude
    const baseTemp = 30 - (absLat * 0.5);
    const temp = Math.round(baseTemp + (Math.random() * 10 - 5));
    
    return {
        condition: condition,
        icon: conditionInfo.icon,
        severity: conditionInfo.severity,
        description: conditionInfo.description,
        temperature: temp,
        humidity: Math.round(50 + Math.random() * 40),
        wind_speed: Math.round(5 + Math.random() * 25), // knots
        wind_direction: Math.round(Math.random() * 360),
        visibility: condition === 'Fog' ? 1 : Math.round(5 + Math.random() * 15),
        pressure: Math.round(1000 + Math.random() * 30),
        feels_like: temp - Math.round(Math.random() * 3),
        clouds: condition === 'Clear' ? Math.round(Math.random() * 20) : Math.round(50 + Math.random() * 50),
        wave_height: Math.round((2 + Math.random() * 4) * 10) / 10, // meters
        sea_state: getSeaState(condition),
        timestamp: new Date().toISOString()
    };
}

// Get sea state description based on weather
function getSeaState(condition) {
    const seaStates = {
        'Clear': 'Calm (0-1m waves)',
        'Clouds': 'Slight (1-2m waves)',
        'Rain': 'Moderate (2-3m waves)',
        'Drizzle': 'Slight (1-2m waves)',
        'Thunderstorm': 'Rough (4-6m waves)',
        'Snow': 'Moderate (2-3m waves)',
        'Mist': 'Slight (1-2m waves)',
        'Fog': 'Slight (1-2m waves)',
        'Haze': 'Calm (0-1m waves)',
        'Stormy': 'Very Rough (6-9m waves)'
    };
    return seaStates[condition] || 'Moderate';
}

module.exports = exports;
