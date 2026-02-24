// trackingController.js
// handles live tracking and submarine depth operations

const db = require('../config/db');

// Get live tracking data for all vessels
exports.getLiveTracking = (req, res) => {
    const query = `
        SELECT 
            v.vessel_id as id,
            v.name,
            v.type,
            v.status,
            v.engine_health,
            v.weather_status,
            vl.latitude,
            vl.longitude,
            CASE WHEN v.status = 'Docked' THEN 0 ELSE vl.speed END as speed,
            vl.direction as heading,
            vl.timestamp as last_update,
            COALESCE(sdl.depth, 0) as depth,
            COALESCE(sdl.pressure, 0) as pressure
        FROM vessels v
        LEFT JOIN (
            SELECT vl1.* FROM vessel_locations vl1
            INNER JOIN (
                SELECT vessel_id, MAX(timestamp) as max_ts
                FROM vessel_locations GROUP BY vessel_id
            ) vl2 ON vl1.vessel_id = vl2.vessel_id AND vl1.timestamp = vl2.max_ts
        ) vl ON v.vessel_id = vl.vessel_id
        LEFT JOIN (
            SELECT sdl1.* FROM submarine_depth_logs sdl1
            INNER JOIN (
                SELECT vessel_id, MAX(timestamp) as max_ts
                FROM submarine_depth_logs GROUP BY vessel_id
            ) sdl2 ON sdl1.vessel_id = sdl2.vessel_id AND sdl1.timestamp = sdl2.max_ts
        ) sdl ON v.vessel_id = sdl.vessel_id
        WHERE v.status IN ('Active', 'Docked')
        ORDER BY v.vessel_id
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Format response with tracking metadata
        res.json({
            timestamp: new Date().toISOString(),
            vessel_count: results.length,
            vessels: results.map(v => ({
                ...v,
                is_submarine: v.type === 'Submarine',
                is_docked: v.status === 'Docked',
                position: {
                    lat: v.latitude,
                    lng: v.longitude
                }
            }))
        });
    });
};

// Get submarine depth history
exports.getSubmarineDepth = (req, res) => {
    const { vesselId } = req.params;
    const { limit = 50 } = req.query;
    
    // First verify it's a submarine
    db.query('SELECT vessel_id, type FROM vessels WHERE vessel_id = ?', [vesselId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) {
            return res.status(404).json({ error: 'Vessel not found' });
        }
        if (results[0].type !== 'Submarine') {
            return res.status(400).json({ error: 'Vessel is not a submarine' });
        }
        
        // Get depth history
        const query = `
            SELECT depth, pressure, timestamp
            FROM submarine_depth_logs
            WHERE vessel_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;
        
        db.query(query, [vesselId, parseInt(limit)], (err, logs) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Calculate depth statistics
            const depths = logs.map(l => l.depth);
            const stats = {
                current_depth: depths[0] || 0,
                max_depth: Math.max(...depths, 0),
                min_depth: Math.min(...depths.filter(d => d > 0), 0),
                avg_depth: depths.length > 0 ? Math.round(depths.reduce((a, b) => a + b, 0) / depths.length) : 0
            };
            
            res.json({
                vessel_id: vesselId,
                stats: stats,
                history: logs.reverse() // Chronological order for charts
            });
        });
    });
};

// Update submarine depth (operators can use this)
exports.updateSubmarineDepth = (req, res) => {
    const { vesselId } = req.params;
    const { depth } = req.body;
    
    if (depth == null) {
        return res.status(400).json({ error: 'Depth is required' });
    }
    
    // Verify submarine exists
    db.query('SELECT vessel_id, type FROM vessels WHERE vessel_id = ?', [vesselId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) {
            return res.status(404).json({ error: 'Vessel not found' });
        }
        if (results[0].type !== 'Submarine') {
            return res.status(400).json({ error: 'Vessel is not a submarine' });
        }
        
        // Calculate pressure (roughly 1 atm per 10 meters)
        const pressure = depth * 0.103;
        
        // Insert depth log
        const query = `
            INSERT INTO submarine_depth_logs (vessel_id, depth, pressure)
            VALUES (?, ?, ?)
        `;
        
        db.query(query, [vesselId, depth, pressure], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Check for dangerous depth and create alert if necessary
            if (depth > 400) {
                const alertQuery = `
                    INSERT INTO alerts (alert_type, severity, vessel_id, message)
                    VALUES ('depth_warning', 'critical', ?, ?)
                `;
                db.query(alertQuery, [vesselId, `Submarine at dangerous depth: ${depth}m - exceeds safe limit`]);
            } else if (depth > 300) {
                const alertQuery = `
                    INSERT INTO alerts (alert_type, severity, vessel_id, message)
                    VALUES ('depth_warning', 'warning', ?, ?)
                `;
                db.query(alertQuery, [vesselId, `Submarine approaching maximum safe depth: ${depth}m`]);
            }
            
            res.json({
                message: 'Depth updated successfully',
                depth: depth,
                pressure: pressure,
                timestamp: new Date().toISOString()
            });
        });
    });
};

// Get all submarines with depth data
exports.getAllSubmarines = (req, res) => {
    const query = `
        SELECT 
            v.vessel_id as id,
            v.name,
            v.engine_health,
            v.status,
            vl.latitude,
            vl.longitude,
            vl.speed,
            sdl.depth as current_depth,
            sdl.pressure as current_pressure,
            sdl.timestamp as depth_updated
        FROM vessels v
        LEFT JOIN (
            SELECT vl1.* FROM vessel_locations vl1
            INNER JOIN (
                SELECT vessel_id, MAX(timestamp) as max_ts
                FROM vessel_locations GROUP BY vessel_id
            ) vl2 ON vl1.vessel_id = vl2.vessel_id AND vl1.timestamp = vl2.max_ts
        ) vl ON v.vessel_id = vl.vessel_id
        LEFT JOIN (
            SELECT sdl1.* FROM submarine_depth_logs sdl1
            INNER JOIN (
                SELECT vessel_id, MAX(timestamp) as max_ts
                FROM submarine_depth_logs GROUP BY vessel_id
            ) sdl2 ON sdl1.vessel_id = sdl2.vessel_id AND sdl1.timestamp = sdl2.max_ts
        ) sdl ON v.vessel_id = sdl.vessel_id
        WHERE v.type = 'Submarine'
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Get vessel location history (for path tracking)
exports.getVesselHistory = (req, res) => {
    const { vesselId } = req.params;
    const { hours = 24 } = req.query;
    
    const query = `
        SELECT latitude, longitude, speed, direction, timestamp
        FROM vessel_locations
        WHERE vessel_id = ? AND timestamp > NOW() - INTERVAL ? HOUR
        ORDER BY timestamp ASC
    `;
    
    db.query(query, [vesselId, parseInt(hours)], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.json({
            vessel_id: vesselId,
            time_range_hours: hours,
            points: results.map(r => ({
                lat: r.latitude,
                lng: r.longitude,
                speed: r.speed,
                heading: r.direction,
                timestamp: r.timestamp
            }))
        });
    });
};

// Get fleet overview for dashboard
exports.getFleetOverview = (req, res) => {
    const queries = {
        vesselStats: `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'Active' THEN 1 END) as active,
                COUNT(CASE WHEN status = 'Docked' THEN 1 END) as docked,
                COUNT(CASE WHEN status = 'Maintenance' THEN 1 END) as maintenance,
                ROUND(AVG(engine_health), 1) as avg_health
            FROM vessels
        `,
        typeBreakdown: `
            SELECT type, COUNT(*) as count
            FROM vessels GROUP BY type
        `,
        recentAlerts: `
            SELECT COUNT(*) as count
            FROM alerts WHERE is_resolved = FALSE
        `,
        routeStats: `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active
            FROM routes
        `
    };
    
    const overview = {};
    let completedQueries = 0;
    const totalQueries = Object.keys(queries).length;
    
    Object.entries(queries).forEach(([key, query]) => {
        db.query(query, (err, results) => {
            if (!err) {
                overview[key] = results.length === 1 ? results[0] : results;
            }
            completedQueries++;
            
            if (completedQueries === totalQueries) {
                res.json({
                    timestamp: new Date().toISOString(),
                    overview: overview
                });
            }
        });
    });
};

module.exports = exports;
