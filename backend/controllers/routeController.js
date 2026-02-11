// routeController.js
// handles all the route endpoints

const db = require('../config/db');

// Major shipping ports and waypoints for realistic sea routes
const MAJOR_PORTS = {
    // Atlantic Ocean Ports
    newYork: { lat: 40.6892, lng: -74.0445, name: 'New York' },
    miami: { lat: 25.7617, lng: -80.1918, name: 'Miami' },
    houston: { lat: 29.7604, lng: -95.3698, name: 'Houston' },
    rotterdam: { lat: 51.9244, lng: 4.4777, name: 'Rotterdam' },
    hamburg: { lat: 53.5511, lng: 9.9937, name: 'Hamburg' },
    southampton: { lat: 50.9097, lng: -1.4044, name: 'Southampton' },
    lisbon: { lat: 38.7223, lng: -9.1393, name: 'Lisbon' },
    barcelona: { lat: 41.3851, lng: 2.1734, name: 'Barcelona' },
    santos: { lat: -23.9608, lng: -46.3336, name: 'Santos' },
    buenosAires: { lat: -34.6037, lng: -58.3816, name: 'Buenos Aires' },
    capeTown: { lat: -33.918, lng: 18.4233, name: 'Cape Town' },
    lagos: { lat: 6.4541, lng: 3.3947, name: 'Lagos' },
    // Pacific Ocean Ports
    losAngeles: { lat: 33.7392, lng: -118.2623, name: 'Los Angeles' },
    sanFrancisco: { lat: 37.8044, lng: -122.2712, name: 'San Francisco' },
    seattle: { lat: 47.6062, lng: -122.3321, name: 'Seattle' },
    vancouver: { lat: 49.2827, lng: -123.1207, name: 'Vancouver' },
    tokyo: { lat: 35.6532, lng: 139.8394, name: 'Tokyo' },
    shanghai: { lat: 31.2304, lng: 121.4737, name: 'Shanghai' },
    singapore: { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
    hongKong: { lat: 22.3193, lng: 114.1694, name: 'Hong Kong' },
    sydney: { lat: -33.8568, lng: 151.2153, name: 'Sydney' },
    // Indian Ocean
    mumbai: { lat: 18.9388, lng: 72.8354, name: 'Mumbai' },
    dubai: { lat: 25.2048, lng: 55.2708, name: 'Dubai' },
    // Mediterranean
    alexandria: { lat: 31.2001, lng: 29.9187, name: 'Alexandria' },
    genoa: { lat: 44.4056, lng: 8.9463, name: 'Genoa' },
    marseille: { lat: 43.2965, lng: 5.3698, name: 'Marseille' },
    piraeus: { lat: 37.9422, lng: 23.6464, name: 'Piraeus' }
};

// Ocean waypoints for routing around continents
const OCEAN_WAYPOINTS = {
    // Atlantic crossing northern route
    midAtlanticNorth: { lat: 45.0, lng: -30.0 },
    midAtlanticSouth: { lat: 5.0, lng: -25.0 },
    
    // Pacific crossing
    midPacificNorth: { lat: 40.0, lng: -160.0 },
    midPacificSouth: { lat: -10.0, lng: -160.0 },
    
    // Around Cape of Good Hope
    capeApproachWest: { lat: -34.0, lng: 10.0 },
    capeApproachEast: { lat: -34.0, lng: 30.0 },
    
    // Around Cape Horn
    capeHornApproach: { lat: -56.0, lng: -67.0 },
    
    // Suez Canal approach
    suezNorth: { lat: 31.5, lng: 32.3 },
    suezSouth: { lat: 29.95, lng: 32.56 },
    
    // Panama Canal approach
    panamaAtlantic: { lat: 9.38, lng: -79.92 },
    panamaPacific: { lat: 8.95, lng: -79.55 },
    
    // Strait of Malacca
    malaccaWest: { lat: 4.5, lng: 98.0 },
    malaccaEast: { lat: 1.4, lng: 104.0 },
    
    // Indian Ocean waypoints
    indianOceanCentral: { lat: -5.0, lng: 70.0 },
    arabianSea: { lat: 15.0, lng: 65.0 },
    
    // Mediterranean waypoints
    medWest: { lat: 36.0, lng: -5.5 }, // Gibraltar approach
    medCentral: { lat: 37.0, lng: 15.0 }
};

// Generate realistic sea waypoints between two points
function generateSeaRoute(startLat, startLng, endLat, endLng) {
    const waypoints = [];
    waypoints.push({ lat: startLat, lng: endLng === startLng ? startLng : startLng });
    waypoints[0] = { lat: startLat, lng: startLng };
    
    // Calculate distance and direction
    const latDiff = endLat - startLat;
    const lngDiff = endLng - startLng;
    const totalDistance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
    
    // Determine if we need to route around continents
    const crossesPanama = (startLng < -70 && endLng > -70) || (startLng > -70 && endLng < -70);
    const crossesAfrica = (startLng < 20 && endLng > 40) || (startLng > 40 && endLng < 20);
    const crossesPacific = Math.abs(lngDiff) > 100;
    
    // For short routes, just create curved ocean paths
    if (totalDistance < 30) {
        // Add intermediate points with slight curve to simulate sea navigation
        const numPoints = Math.max(3, Math.floor(totalDistance / 5));
        for (let i = 1; i < numPoints; i++) {
            const t = i / numPoints;
            // Add slight curve offset to avoid straight lines
            const curveOffset = Math.sin(t * Math.PI) * (totalDistance / 15);
            const perpLat = -lngDiff / totalDistance;
            const perpLng = latDiff / totalDistance;
            
            waypoints.push({
                lat: startLat + latDiff * t + perpLat * curveOffset,
                lng: startLng + lngDiff * t + perpLng * curveOffset
            });
        }
    } else {
        // For longer routes, use ocean-based waypoints
        const numSegments = Math.max(5, Math.floor(totalDistance / 10));
        
        // Create curved path that simulates great circle route with ocean avoidance
        for (let i = 1; i < numSegments; i++) {
            const t = i / numSegments;
            
            // Base interpolation
            let lat = startLat + latDiff * t;
            let lng = startLng + lngDiff * t;
            
            // Add curve to simulate great circle and ocean routing
            const curveIntensity = Math.sin(t * Math.PI) * Math.min(10, totalDistance / 8);
            
            // Offset toward ocean areas (generally away from continental centers)
            // Push routes toward open ocean
            if (lat > 0 && lat < 60) {
                // Northern hemisphere - curve slightly south for Atlantic, north for Pacific
                lat -= curveIntensity * 0.3;
            } else if (lat < 0 && lat > -60) {
                // Southern hemisphere - curve slightly north
                lat += curveIntensity * 0.2;
            }
            
            // Avoid land masses by adjusting longitude
            // Africa avoidance
            if (lng > -20 && lng < 50 && lat > -35 && lat < 35) {
                if (lat > 0) {
                    lat = Math.max(lat, 35 + curveIntensity); // Go north of Africa
                } else {
                    lat = Math.min(lat, -35 - curveIntensity * 0.5); // Go south of Africa
                }
            }
            
            // South America avoidance  
            if (lng > -80 && lng < -35 && lat > -55 && lat < 10) {
                if (startLng < endLng) {
                    lng = Math.max(lng, -30 + curveIntensity); // Route east
                } else {
                    lng = Math.min(lng, -85 - curveIntensity); // Route west
                }
            }
            
            // Australia avoidance
            if (lng > 110 && lng < 155 && lat > -45 && lat < -10) {
                lat = Math.min(lat, -45 - curveIntensity * 0.5);
            }
            
            waypoints.push({ lat, lng });
        }
    }
    
    waypoints.push({ lat: endLat, lng: endLng });
    
    // Smooth the path
    return smoothPath(waypoints);
}

// Smooth a path by averaging nearby points
function smoothPath(waypoints) {
    if (waypoints.length < 3) return waypoints;
    
    const smoothed = [waypoints[0]];
    
    for (let i = 1; i < waypoints.length - 1; i++) {
        const prev = waypoints[i - 1];
        const curr = waypoints[i];
        const next = waypoints[i + 1];
        
        smoothed.push({
            lat: (prev.lat + curr.lat * 2 + next.lat) / 4,
            lng: (prev.lng + curr.lng * 2 + next.lng) / 4
        });
    }
    
    smoothed.push(waypoints[waypoints.length - 1]);
    return smoothed;
}

// Find nearest port to coordinates
function findNearestPort(lat, lng) {
    let nearest = null;
    let minDist = Infinity;
    
    for (const [key, port] of Object.entries(MAJOR_PORTS)) {
        const dist = Math.sqrt(
            Math.pow(port.lat - lat, 2) + 
            Math.pow(port.lng - lng, 2)
        );
        if (dist < minDist) {
            minDist = dist;
            nearest = { key, ...port };
        }
    }
    
    return nearest;
}

// API endpoint to generate sea route between two points
exports.generateSeaRoute = (req, res) => {
    const { startLat, startLng, endLat, endLng } = req.body;
    
    if (startLat == null || startLng == null || endLat == null || endLng == null) {
        return res.status(400).json({ error: 'Start and end coordinates are required' });
    }
    
    try {
        const waypoints = generateSeaRoute(
            parseFloat(startLat),
            parseFloat(startLng),
            parseFloat(endLat),
            parseFloat(endLng)
        );
        
        const startPort = findNearestPort(startLat, startLng);
        const endPort = findNearestPort(endLat, endLng);
        
        // Calculate approximate distance (simplified)
        let totalDistance = 0;
        for (let i = 1; i < waypoints.length; i++) {
            const dLat = waypoints[i].lat - waypoints[i-1].lat;
            const dLng = waypoints[i].lng - waypoints[i-1].lng;
            totalDistance += Math.sqrt(dLat * dLat + dLng * dLng) * 111; // Rough km conversion
        }
        
        res.json({
            waypoints,
            startPort: startPort?.name || 'Unknown',
            endPort: endPort?.name || 'Unknown',
            estimatedDistanceKm: Math.round(totalDistance),
            waypointCount: waypoints.length
        });
    } catch (error) {
        console.error('Error generating sea route:', error);
        res.status(500).json({ error: 'Failed to generate sea route' });
    }
};

// Export the function for internal use
exports.generateSeaRouteInternal = generateSeaRoute;

// get all routes with their waypoints
exports.getAllRoutes = (req, res) => {
    const query = `
        SELECT 
            r.route_id as id,
            r.route_name,
            r.vessel_id,
            r.risk_level,
            r.description,
            r.status,
            r.created_at,
            v.name as vessel_name,
            v.type as vessel_type
        FROM routes r
        LEFT JOIN vessels v ON r.vessel_id = v.vessel_id
        ORDER BY r.created_at DESC
    `;
    
    db.query(query, (err, routes) => {
        if (err) {
            console.error('Error fetching routes:', err);
            return res.status(500).json({ error: err.message });
        }
        
        // need to get waypoints separately
        const routeIds = routes.map(r => r.id);
        if (routeIds.length === 0) {
            return res.json([]);
        }
        
        const waypointsQuery = `
            SELECT route_id, latitude as lat, longitude as lng, order_index
            FROM route_waypoints
            WHERE route_id IN (?)
            ORDER BY route_id, order_index
        `;
        
        db.query(waypointsQuery, [routeIds], (err, waypoints) => {
            if (err) {
                console.error('Error fetching waypoints:', err);
                return res.json(routes.map(r => ({ ...r, waypoints: [] })));
            }
            
            // group waypoints by their route
            const waypointsByRoute = {};
            waypoints.forEach(wp => {
                if (!waypointsByRoute[wp.route_id]) {
                    waypointsByRoute[wp.route_id] = [];
                }
                waypointsByRoute[wp.route_id].push({ lat: wp.lat, lng: wp.lng });
            });
            
            // combine routes with their waypoints
            const result = routes.map(route => ({
                ...route,
                waypoints: waypointsByRoute[route.id] || []
            }));
            
            res.json(result);
        });
    });
};

// get one route by id
exports.getRouteById = (req, res) => {
    const { id } = req.params;
    
    const query = `
        SELECT 
            r.route_id as id,
            r.route_name,
            r.vessel_id,
            r.risk_level,
            r.description,
            r.status,
            r.created_at,
            v.name as vessel_name,
            v.type as vessel_type
        FROM routes r
        LEFT JOIN vessels v ON r.vessel_id = v.vessel_id
        WHERE r.route_id = ?
    `;
    
    db.query(query, [id], (err, routes) => {
        if (err) return res.status(500).json({ error: err.message });
        if (routes.length === 0) {
            return res.status(404).json({ error: 'Route not found' });
        }
        
        const route = routes[0];
        
        // also get waypoints
        const waypointsQuery = `
            SELECT latitude as lat, longitude as lng
            FROM route_waypoints
            WHERE route_id = ?
            ORDER BY order_index
        `;
        
        db.query(waypointsQuery, [id], (err, waypoints) => {
            if (err) {
                route.waypoints = [];
            } else {
                route.waypoints = waypoints;
            }
            res.json(route);
        });
    });
};

// add new route
exports.addRoute = (req, res) => {
    const { route_name, risk_level, vessel_id, status, description, waypoints } = req.body;

    // route name is required
    if (!route_name) {
        return res.status(400).json({ error: 'Route name is required' });
    }

    const query = `
        INSERT INTO routes (route_name, vessel_id, risk_level, status, description) 
        VALUES (?, ?, ?, ?, ?)
    `;
    
    db.query(query, [
        route_name,
        vessel_id || null,
        risk_level || 'low',
        status || 'planned',
        description || null
    ], (err, result) => {
        if (err) {
            console.error('Error adding route:', err);
            return res.status(500).json({ error: err.message });
        }
        
        const routeId = result.insertId;
        
        // add waypoints if we got any
        if (waypoints && waypoints.length > 0) {
            const waypointValues = waypoints.map((wp, index) => [
                routeId,
                wp.lat || wp.latitude,
                wp.lng || wp.longitude,
                index + 1
            ]);
            
            const waypointsQuery = `
                INSERT INTO route_waypoints (route_id, latitude, longitude, order_index)
                VALUES ?
            `;
            
            db.query(waypointsQuery, [waypointValues], (err) => {
                if (err) console.error('Error adding waypoints:', err);
            });
        }
        
        res.status(201).json({ 
            message: 'Route added successfully', 
            id: routeId 
        });
    });
};

// update existing route
exports.updateRoute = (req, res) => {
    const { id } = req.params;
    const { route_name, risk_level, vessel_id, status, description, waypoints } = req.body;
    
    const query = `
        UPDATE routes 
        SET route_name = ?, vessel_id = ?, risk_level = ?, status = ?, description = ?
        WHERE route_id = ?
    `;
    
    db.query(query, [
        route_name,
        vessel_id || null,
        risk_level || 'low',
        status || 'planned',
        description || null,
        id
    ], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Route not found' });
        }
        
        // if new waypoints provided, replace old ones
        if (waypoints && waypoints.length > 0) {
            // first delete the old waypoints
            db.query('DELETE FROM route_waypoints WHERE route_id = ?', [id], (err) => {
                if (err) {
                    console.error('Error deleting old waypoints:', err);
                    return;
                }
                
                // then insert the new ones
                const waypointValues = waypoints.map((wp, index) => [
                    id,
                    wp.lat || wp.latitude,
                    wp.lng || wp.longitude,
                    index + 1
                ]);
                
                const waypointsQuery = `
                    INSERT INTO route_waypoints (route_id, latitude, longitude, order_index)
                    VALUES ?
                `;
                
                db.query(waypointsQuery, [waypointValues], (err) => {
                    if (err) console.error('Error updating waypoints:', err);
                });
            });
        }
        
        res.json({ message: 'Route updated successfully' });
    });
};

// delete a route
exports.deleteRoute = (req, res) => {
    const { id } = req.params;
    
    db.query('DELETE FROM routes WHERE route_id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Route not found' });
        }
        res.json({ message: 'Route deleted successfully' });
    });
};

// get route stats for dashboard
exports.getRouteStats = (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as total_routes,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_routes,
            COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as low_risk,
            COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium_risk,
            COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_risk
        FROM routes
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0]);
    });
};
