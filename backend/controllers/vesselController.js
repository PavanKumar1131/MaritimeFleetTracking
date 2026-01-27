// vesselController.js
// handles all the vessel api stuff

const db = require('../config/db');

// get all vessels with their latest location data
exports.getAllVessels = (req, res) => {
    // this query is kinda long but it joins multiple tables to get all the info
    const query = `
        SELECT 
            v.vessel_id as id,
            v.name,
            v.type,
            COALESCE(vl.latitude, 0) as latitude,
            COALESCE(vl.longitude, 0) as longitude,
            COALESCE(vl.speed, 0) as speed,
            COALESCE(vl.direction, 0) as heading,
            v.engine_health,
            v.weather_status,
            COALESCE(sdl.depth, 0) as depth,
            COALESCE(el.fuel_level, GREATEST(0, v.engine_health - 10 + FLOOR(RAND() * 20))) as fuel_level,
            v.status,
            v.created_at,
            vl.timestamp as updated_at
        FROM vessels v
        LEFT JOIN (
            SELECT vl1.* FROM vessel_locations vl1
            INNER JOIN (
                SELECT vessel_id, MAX(timestamp) as max_ts
                FROM vessel_locations GROUP BY vessel_id
            ) vl2 ON vl1.vessel_id = vl2.vessel_id AND vl1.timestamp = vl2.max_ts
        ) vl ON v.vessel_id = vl.vessel_id
        LEFT JOIN (
            SELECT el1.* FROM engine_logs el1
            INNER JOIN (
                SELECT vessel_id, MAX(logged_at) as max_ts
                FROM engine_logs GROUP BY vessel_id
            ) el2 ON el1.vessel_id = el2.vessel_id AND el1.logged_at = el2.max_ts
        ) el ON v.vessel_id = el.vessel_id
        LEFT JOIN (
            SELECT sdl1.* FROM submarine_depth_logs sdl1
            INNER JOIN (
                SELECT vessel_id, MAX(timestamp) as max_ts
                FROM submarine_depth_logs GROUP BY vessel_id
            ) sdl2 ON sdl1.vessel_id = sdl2.vessel_id AND sdl1.timestamp = sdl2.max_ts
        ) sdl ON v.vessel_id = sdl.vessel_id
        ORDER BY v.vessel_id
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching vessels:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
};

// get one vessel by id
exports.getVesselById = (req, res) => {
    const { id } = req.params;
    
    const query = `
        SELECT 
            v.vessel_id as id,
            v.name,
            v.type,
            COALESCE(vl.latitude, 0) as latitude,
            COALESCE(vl.longitude, 0) as longitude,
            COALESCE(vl.speed, 0) as speed,
            COALESCE(vl.direction, 0) as heading,
            v.engine_health,
            v.weather_status,
            COALESCE(sdl.depth, 0) as depth,
            COALESCE(el.fuel_level, GREATEST(0, v.engine_health - 10 + FLOOR(RAND() * 20))) as fuel_level,
            v.status,
            v.created_at,
            vl.timestamp as updated_at
        FROM vessels v
        LEFT JOIN (
            SELECT * FROM vessel_locations WHERE vessel_id = ?
            ORDER BY timestamp DESC LIMIT 1
        ) vl ON v.vessel_id = vl.vessel_id
        LEFT JOIN (
            SELECT * FROM engine_logs WHERE vessel_id = ?
            ORDER BY logged_at DESC LIMIT 1
        ) el ON v.vessel_id = el.vessel_id
        LEFT JOIN (
            SELECT * FROM submarine_depth_logs WHERE vessel_id = ?
            ORDER BY timestamp DESC LIMIT 1
        ) sdl ON v.vessel_id = sdl.vessel_id
        WHERE v.vessel_id = ?
    `;
    
    db.query(query, [id, id, id, id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) {
            return res.status(404).json({ error: 'Vessel not found' });
        }
        res.json(results[0]);
    });
};

// add new vessel
exports.addVessel = (req, res) => {
    const { name, type, latitude, longitude, speed, direction, engine_health, weather_status, status } = req.body;

    // make sure we have required fields
    if (!name || !type) {
        return res.status(400).json({ error: 'Name and type are required' });
    }

    // first insert the vessel
    const vesselQuery = `
        INSERT INTO vessels (name, type, engine_health, weather_status, status) 
        VALUES (?, ?, ?, ?, ?)
    `;
    
    db.query(vesselQuery, [
        name, 
        type, 
        engine_health || 100, 
        weather_status || 'Clear',
        status || 'Active'
    ], (err, result) => {
        if (err) {
            console.error('Error adding vessel:', err);
            return res.status(500).json({ error: err.message });
        }
        
        const vesselId = result.insertId;
        
        // then add the starting location
        const locationQuery = `
            INSERT INTO vessel_locations (vessel_id, latitude, longitude, speed, direction)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        db.query(locationQuery, [
            vesselId,
            latitude || 0,
            longitude || 0,
            speed || 0,
            direction || 0
        ], (err) => {
            if (err) {
                console.error('Error adding vessel location:', err);
            }
        });
        
        res.status(201).json({ 
            message: 'Vessel added successfully', 
            id: vesselId 
        });
    });
};

// update existing vessel
exports.updateVessel = (req, res) => {
    const { id } = req.params;
    const { name, type, latitude, longitude, speed, direction, engine_health, weather_status, status } = req.body;

    const query = `
        UPDATE vessels 
        SET name = ?, type = ?, engine_health = ?, weather_status = ?, status = ?
        WHERE vessel_id = ?
    `;
    
    db.query(query, [
        name, 
        type, 
        engine_health || 100, 
        weather_status || 'Clear',
        status || 'Active',
        id
    ], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Vessel not found' });
        }
        
        // also update location if any coords provided
        if (latitude != null || longitude != null || speed != null || direction != null) {
            const locationQuery = `
                INSERT INTO vessel_locations (vessel_id, latitude, longitude, speed, direction)
                VALUES (?, ?, ?, ?, ?)
            `;
            db.query(locationQuery, [id, latitude || 0, longitude || 0, speed || 0, direction || 0]);
        }
        
        res.json({ message: 'Vessel updated successfully' });
    });
};

// just update metrics like speed and health (for operators)
exports.updateVesselMetrics = (req, res) => {
    const { id } = req.params;
    const { speed, engine_health, weather_status, depth } = req.body;

    // update main vessel info
    const vesselQuery = `
        UPDATE vessels 
        SET engine_health = COALESCE(?, engine_health), 
            weather_status = COALESCE(?, weather_status)
        WHERE vessel_id = ?
    `;
    
    db.query(vesselQuery, [engine_health, weather_status, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Vessel not found' });
        }
        
        // add speed to location log if given
        if (speed != null) {
            const locationQuery = `
                INSERT INTO vessel_locations (vessel_id, latitude, longitude, speed, direction)
                SELECT vessel_id, latitude, longitude, ?, direction
                FROM vessel_locations WHERE vessel_id = ?
                ORDER BY timestamp DESC LIMIT 1
            `;
            db.query(locationQuery, [speed, id]);
        }
        
        // submarines have depth tracking
        if (depth != null) {
            const depthQuery = `
                INSERT INTO submarine_depth_logs (vessel_id, depth, pressure)
                VALUES (?, ?, ?)
            `;
            db.query(depthQuery, [id, depth, depth * 0.103]);
        }
        
        res.json({ message: 'Metrics updated successfully' });
    });
};

// delete a vessel
exports.deleteVessel = (req, res) => {
    const { id } = req.params;
    
    db.query('DELETE FROM vessels WHERE vessel_id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Vessel not found' });
        }
        res.json({ message: 'Vessel deleted successfully' });
    });
};

// get stats for dashboard
exports.getVesselStats = (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as total_vessels,
            COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_vessels,
            COUNT(CASE WHEN engine_health >= 80 THEN 1 END) as healthy_vessels,
            COUNT(CASE WHEN engine_health < 80 THEN 1 END) as warning_vessels,
            ROUND(AVG(engine_health), 1) as avg_engine_health,
            (SELECT ROUND(AVG(speed), 1) FROM vessel_locations vl 
             INNER JOIN (SELECT vessel_id, MAX(timestamp) as max_ts FROM vessel_locations GROUP BY vessel_id) latest 
             ON vl.vessel_id = latest.vessel_id AND vl.timestamp = latest.max_ts) as avg_speed,
            COUNT(CASE WHEN type = 'Cargo' THEN 1 END) as cargo_count,
            COUNT(CASE WHEN type = 'Naval' THEN 1 END) as naval_count,
            COUNT(CASE WHEN type = 'Tanker' THEN 1 END) as tanker_count,
            COUNT(CASE WHEN type = 'Submarine' THEN 1 END) as submarine_count
        FROM vessels
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0]);
    });
};

// update location for tracking
exports.updateVesselLocation = (req, res) => {
    const { id } = req.params;
    const { latitude, longitude, speed, direction } = req.body;
    
    // need lat and lng
    if (latitude == null || longitude == null) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    // make sure vessel exists first
    db.query('SELECT vessel_id FROM vessels WHERE vessel_id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) {
            return res.status(404).json({ error: 'Vessel not found' });
        }
        
        // add new location record
        const query = `
            INSERT INTO vessel_locations (vessel_id, latitude, longitude, speed, direction)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        db.query(query, [id, latitude, longitude, speed || 0, direction || 0], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Location updated successfully' });
        });
    });
};
