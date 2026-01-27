const db = require('../config/db');

// Get all alerts
exports.getAllAlerts = (req, res) => {
    const query = `
        SELECT 
            a.id,
            a.alert_type,
            a.severity,
            a.vessel_id,
            a.message,
            CASE WHEN a.is_resolved THEN 'resolved' ELSE 'active' END as status,
            a.created_at,
            NULL as resolved_at,
            v.name as vessel_name,
            v.type as vessel_type
        FROM alerts a
        LEFT JOIN vessels v ON a.vessel_id = v.vessel_id
        ORDER BY 
            CASE WHEN a.is_resolved THEN 1 ELSE 0 END,
            CASE a.severity 
                WHEN 'critical' THEN 1 
                WHEN 'high' THEN 2 
                WHEN 'medium' THEN 3 
                ELSE 4 
            END,
            a.created_at DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Get active (unresolved) alerts
exports.getActiveAlerts = (req, res) => {
    const query = `
        SELECT 
            a.id,
            a.alert_type,
            a.severity,
            a.vessel_id,
            a.message,
            'active' as status,
            a.created_at,
            v.name as vessel_name,
            v.type as vessel_type
        FROM alerts a
        LEFT JOIN vessels v ON a.vessel_id = v.vessel_id
        WHERE a.is_resolved = FALSE
        ORDER BY 
            CASE a.severity 
                WHEN 'critical' THEN 1 
                WHEN 'high' THEN 2 
                WHEN 'medium' THEN 3 
                ELSE 4 
            END,
            a.created_at DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Get alerts for a specific vessel
exports.getVesselAlerts = (req, res) => {
    const { vesselId } = req.params;
    
    const query = `
        SELECT * FROM alerts 
        WHERE vessel_id = ? 
        ORDER BY created_at DESC
    `;
    
    db.query(query, [vesselId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Create new alert
exports.createAlert = (req, res) => {
    const { alert_type, severity, vessel_id, message } = req.body;
    
    if (!alert_type || !message) {
        return res.status(400).json({ error: 'Alert type and message are required' });
    }
    
    const query = `INSERT INTO alerts (alert_type, severity, vessel_id, message) VALUES (?, ?, ?, ?)`;
    
    db.query(query, [alert_type, severity || 'low', vessel_id || null, message], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ 
            message: 'Alert created', 
            alert_id: result.insertId 
        });
    });
};

// Resolve alert
exports.resolveAlert = (req, res) => {
    const { id } = req.params;
    
    const query = `UPDATE alerts SET is_resolved = TRUE WHERE id = ?`;
    
    db.query(query, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }
        res.json({ message: 'Alert resolved' });
    });
};

// Delete alert
exports.deleteAlert = (req, res) => {
    const { id } = req.params;
    
    db.query('DELETE FROM alerts WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }
        res.json({ message: 'Alert deleted' });
    });
};

// Get alert statistics
exports.getAlertStats = (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as total_alerts,
            COUNT(CASE WHEN is_resolved = FALSE THEN 1 END) as active_alerts,
            COUNT(CASE WHEN severity = 'critical' AND is_resolved = FALSE THEN 1 END) as critical_count,
            COUNT(CASE WHEN severity = 'high' AND is_resolved = FALSE THEN 1 END) as high_count,
            COUNT(CASE WHEN severity = 'medium' AND is_resolved = FALSE THEN 1 END) as medium_count,
            COUNT(CASE WHEN severity = 'low' AND is_resolved = FALSE THEN 1 END) as low_count,
            COUNT(CASE WHEN alert_type = 'engine' AND is_resolved = FALSE THEN 1 END) as engine_alerts,
            COUNT(CASE WHEN alert_type = 'weather' AND is_resolved = FALSE THEN 1 END) as weather_alerts,
            COUNT(CASE WHEN alert_type = 'fuel' AND is_resolved = FALSE THEN 1 END) as fuel_alerts
        FROM alerts
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0]);
    });
};
