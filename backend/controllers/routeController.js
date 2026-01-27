// routeController.js
// handles all the route endpoints

const db = require('../config/db');

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
