// uploadController.js
// handles CSV and JSON file uploads for routes and vessels

const db = require('../config/db');
const path = require('path');
const fs = require('fs');

// Parse CSV content into array of objects
function parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV file must have headers and at least one data row');
    }
    
    // Get headers from first line
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            data.push(row);
        }
    }
    
    return data;
}

// Upload vessels from CSV or JSON
exports.uploadVessels = (req, res) => {
    try {
        if (!req.file && !req.body.data) {
            return res.status(400).json({ error: 'No file or data provided' });
        }
        
        let vessels = [];
        
        if (req.file) {
            const content = req.file.buffer.toString('utf-8');
            const ext = path.extname(req.file.originalname).toLowerCase();
            
            if (ext === '.json') {
                const parsed = JSON.parse(content);
                vessels = Array.isArray(parsed) ? parsed : [parsed];
            } else if (ext === '.csv') {
                vessels = parseCSV(content);
            } else {
                return res.status(400).json({ error: 'Unsupported file format. Use CSV or JSON.' });
            }
        } else if (req.body.data) {
            // Handle direct JSON data in request body
            vessels = Array.isArray(req.body.data) ? req.body.data : [req.body.data];
        }
        
        if (vessels.length === 0) {
            return res.status(400).json({ error: 'No valid vessel data found' });
        }
        
        // Validate and insert vessels
        const validTypes = ['Cargo', 'Naval', 'Submarine', 'Tanker', 'Passenger'];
        const results = { success: 0, failed: 0, errors: [] };
        
        vessels.forEach((vessel, index) => {
            // Validate required fields
            if (!vessel.name) {
                results.failed++;
                results.errors.push(`Row ${index + 1}: Missing vessel name`);
                return;
            }
            
            // Normalize type
            let type = vessel.type || 'Cargo';
            type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
            if (!validTypes.includes(type)) {
                type = 'Cargo';
            }
            
            // Insert vessel
            const vesselQuery = `
                INSERT INTO vessels (name, type, engine_health, weather_status, status)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            db.query(vesselQuery, [
                vessel.name,
                type,
                parseInt(vessel.engine_health) || 100,
                vessel.weather_status || 'Clear',
                vessel.status || 'Active'
            ], (err, result) => {
                if (err) {
                    results.failed++;
                    results.errors.push(`Row ${index + 1}: ${err.message}`);
                } else {
                    results.success++;
                    
                    // Add initial location if provided
                    if (vessel.latitude && vessel.longitude) {
                        const locationQuery = `
                            INSERT INTO vessel_locations (vessel_id, latitude, longitude, speed, direction)
                            VALUES (?, ?, ?, ?, ?)
                        `;
                        db.query(locationQuery, [
                            result.insertId,
                            parseFloat(vessel.latitude),
                            parseFloat(vessel.longitude),
                            parseFloat(vessel.speed) || 0,
                            parseFloat(vessel.direction) || 0
                        ]);
                    }
                }
            });
        });
        
        // Wait a bit for queries to complete
        setTimeout(() => {
            res.json({
                message: `Uploaded ${results.success} vessels successfully`,
                success: results.success,
                failed: results.failed,
                errors: results.errors.slice(0, 10) // Limit error messages
            });
        }, 500);
        
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to process upload: ' + error.message });
    }
};

// Upload routes from CSV or JSON
exports.uploadRoutes = (req, res) => {
    try {
        if (!req.file && !req.body.data) {
            return res.status(400).json({ error: 'No file or data provided' });
        }
        
        let routes = [];
        
        if (req.file) {
            const content = req.file.buffer.toString('utf-8');
            const ext = path.extname(req.file.originalname).toLowerCase();
            
            if (ext === '.json') {
                const parsed = JSON.parse(content);
                routes = Array.isArray(parsed) ? parsed : [parsed];
            } else if (ext === '.csv') {
                routes = parseCSV(content);
            } else {
                return res.status(400).json({ error: 'Unsupported file format. Use CSV or JSON.' });
            }
        } else if (req.body.data) {
            routes = Array.isArray(req.body.data) ? req.body.data : [req.body.data];
        }
        
        if (routes.length === 0) {
            return res.status(400).json({ error: 'No valid route data found' });
        }
        
        const results = { success: 0, failed: 0, errors: [] };
        
        routes.forEach((route, index) => {
            // Validate required fields
            if (!route.route_name && !route.name) {
                results.failed++;
                results.errors.push(`Row ${index + 1}: Missing route name`);
                return;
            }
            
            const routeName = route.route_name || route.name;
            const riskLevel = ['low', 'medium', 'high'].includes(route.risk_level?.toLowerCase()) 
                ? route.risk_level.toLowerCase() : 'low';
            
            // Insert route
            const routeQuery = `
                INSERT INTO routes (route_name, vessel_id, risk_level, status, description)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            db.query(routeQuery, [
                routeName,
                route.vessel_id ? parseInt(route.vessel_id) : null,
                riskLevel,
                route.status || 'planned',
                route.description || null
            ], (err, result) => {
                if (err) {
                    results.failed++;
                    results.errors.push(`Row ${index + 1}: ${err.message}`);
                } else {
                    results.success++;
                    
                    // Add waypoints if provided
                    let waypoints = route.waypoints;
                    
                    // Parse waypoints if it's a string (from CSV)
                    if (typeof waypoints === 'string') {
                        try {
                            waypoints = JSON.parse(waypoints);
                        } catch (e) {
                            waypoints = null;
                        }
                    }
                    
                    if (waypoints && Array.isArray(waypoints) && waypoints.length > 0) {
                        const waypointValues = waypoints.map((wp, i) => [
                            result.insertId,
                            parseFloat(wp.lat || wp.latitude),
                            parseFloat(wp.lng || wp.longitude),
                            i + 1
                        ]);
                        
                        const wpQuery = `
                            INSERT INTO route_waypoints (route_id, latitude, longitude, order_index)
                            VALUES ?
                        `;
                        db.query(wpQuery, [waypointValues]);
                    }
                }
            });
        });
        
        setTimeout(() => {
            res.json({
                message: `Uploaded ${results.success} routes successfully`,
                success: results.success,
                failed: results.failed,
                errors: results.errors.slice(0, 10)
            });
        }, 500);
        
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to process upload: ' + error.message });
    }
};

// Upload waypoints for an existing route
exports.uploadWaypoints = (req, res) => {
    const { routeId } = req.params;
    
    try {
        if (!req.file && !req.body.waypoints) {
            return res.status(400).json({ error: 'No waypoints data provided' });
        }
        
        let waypoints = [];
        
        if (req.file) {
            const content = req.file.buffer.toString('utf-8');
            const ext = path.extname(req.file.originalname).toLowerCase();
            
            if (ext === '.json') {
                waypoints = JSON.parse(content);
            } else if (ext === '.csv') {
                waypoints = parseCSV(content);
            }
        } else {
            waypoints = req.body.waypoints;
        }
        
        if (!Array.isArray(waypoints) || waypoints.length === 0) {
            return res.status(400).json({ error: 'Invalid waypoints data' });
        }
        
        // Verify route exists
        db.query('SELECT route_id FROM routes WHERE route_id = ?', [routeId], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0) {
                return res.status(404).json({ error: 'Route not found' });
            }
            
            // Delete existing waypoints
            db.query('DELETE FROM route_waypoints WHERE route_id = ?', [routeId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                
                // Insert new waypoints
                const waypointValues = waypoints.map((wp, i) => [
                    parseInt(routeId),
                    parseFloat(wp.lat || wp.latitude),
                    parseFloat(wp.lng || wp.longitude),
                    i + 1
                ]);
                
                const query = `
                    INSERT INTO route_waypoints (route_id, latitude, longitude, order_index)
                    VALUES ?
                `;
                
                db.query(query, [waypointValues], (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    res.json({
                        message: `Added ${waypointValues.length} waypoints to route`,
                        count: waypointValues.length
                    });
                });
            });
        });
        
    } catch (error) {
        console.error('Waypoint upload error:', error);
        res.status(500).json({ error: 'Failed to upload waypoints: ' + error.message });
    }
};

// Export vessels to JSON
exports.exportVessels = (req, res) => {
    const query = `
        SELECT 
            v.vessel_id as id,
            v.name,
            v.type,
            v.engine_health,
            v.weather_status,
            v.status,
            vl.latitude,
            vl.longitude,
            vl.speed,
            vl.direction
        FROM vessels v
        LEFT JOIN (
            SELECT vl1.* FROM vessel_locations vl1
            INNER JOIN (
                SELECT vessel_id, MAX(timestamp) as max_ts
                FROM vessel_locations GROUP BY vessel_id
            ) vl2 ON vl1.vessel_id = vl2.vessel_id AND vl1.timestamp = vl2.max_ts
        ) vl ON v.vessel_id = vl.vessel_id
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=vessels-export.json');
        res.json(results);
    });
};

// Export routes to JSON
exports.exportRoutes = (req, res) => {
    const query = `
        SELECT 
            r.route_id as id,
            r.route_name,
            r.vessel_id,
            r.risk_level,
            r.status,
            r.description
        FROM routes r
    `;
    
    db.query(query, (err, routes) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (routes.length === 0) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=routes-export.json');
            return res.json([]);
        }
        
        // Get waypoints for all routes
        const routeIds = routes.map(r => r.id);
        const wpQuery = `
            SELECT route_id, latitude as lat, longitude as lng, order_index
            FROM route_waypoints WHERE route_id IN (?)
            ORDER BY route_id, order_index
        `;
        
        db.query(wpQuery, [routeIds], (err, waypoints) => {
            if (err) {
                routes.forEach(r => r.waypoints = []);
            } else {
                // Group waypoints by route
                const wpByRoute = {};
                waypoints.forEach(wp => {
                    if (!wpByRoute[wp.route_id]) wpByRoute[wp.route_id] = [];
                    wpByRoute[wp.route_id].push({ lat: wp.lat, lng: wp.lng });
                });
                
                routes.forEach(r => {
                    r.waypoints = wpByRoute[r.id] || [];
                });
            }
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=routes-export.json');
            res.json(routes);
        });
    });
};

// Get sample CSV template
exports.getVesselTemplate = (req, res) => {
    const template = `name,type,latitude,longitude,speed,engine_health,weather_status,status
"Sample Vessel 1","Cargo",40.7128,-74.006,12.5,85,"Clear","Active"
"Sample Vessel 2","Tanker",34.0522,-118.2437,8.0,92,"Cloudy","Active"`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=vessel-template.csv');
    res.send(template);
};

exports.getRouteTemplate = (req, res) => {
    const template = `route_name,risk_level,status,description,waypoints
"Atlantic Crossing","medium","planned","Standard transatlantic route","[{""lat"":40.71,""lng"":-74.01},{""lat"":48.86,""lng"":-2.35}]"
"Pacific Route","low","active","LA to Tokyo","[{""lat"":34.05,""lng"":-118.24},{""lat"":35.68,""lng"":139.65}]"`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=route-template.csv');
    res.send(template);
};

module.exports = exports;
