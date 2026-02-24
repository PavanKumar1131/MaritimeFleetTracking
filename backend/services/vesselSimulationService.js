/**
 * Vessel Movement Simulation Service
 * 
 * Handles vessel movement along predefined route waypoints.
 * When a vessel reaches the final waypoint:
 * - Stops further movement
 * - Sets speed to 0
 * - Updates status to "Docked"
 * - Keeps marker visible at final location
 */

const db = require('../config/db');

// Store active simulation intervals per vessel
const activeSimulations = new Map();

// Simulation configuration - adjusted for visible slow movement
const SIMULATION_CONFIG = {
    updateIntervalMs: 3000,     // Update every 3 seconds
    defaultSpeed: 8,            // 8 knots - slower for visible movement
    speedVariation: 0.1,        // 10% speed variation for realism
    simulationSpeedMultiplier: 50  // Speed up time by 50x for demo (1 hour = 72 seconds)
};

/**
 * Get route waypoints for a vessel
 * @param {number} vesselId 
 * @returns {Promise<Array>} Array of waypoint objects with lat, lng, order_index
 */
async function getVesselRouteWaypoints(vesselId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT rw.latitude, rw.longitude, rw.order_index
            FROM route_waypoints rw
            INNER JOIN routes r ON rw.route_id = r.route_id
            WHERE r.vessel_id = ? AND r.status = 'active'
            ORDER BY rw.order_index ASC
        `;
        
        db.query(query, [vesselId], (err, results) => {
            if (err) return reject(err);
            resolve(results.map(row => ({
                lat: parseFloat(row.latitude),
                lng: parseFloat(row.longitude),
                orderIndex: row.order_index
            })));
        });
    });
}

/**
 * Get current vessel position and status
 * @param {number} vesselId 
 * @returns {Promise<Object>} Vessel data with current position
 */
async function getVesselCurrentState(vesselId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                v.vessel_id, v.name, v.status, v.type,
                vl.latitude, vl.longitude, vl.speed, vl.direction
            FROM vessels v
            LEFT JOIN (
                SELECT * FROM vessel_locations 
                WHERE vessel_id = ? 
                ORDER BY timestamp DESC LIMIT 1
            ) vl ON v.vessel_id = vl.vessel_id
            WHERE v.vessel_id = ?
        `;
        
        db.query(query, [vesselId, vesselId], (err, results) => {
            if (err) return reject(err);
            if (results.length === 0) return resolve(null);
            
            const row = results[0];
            resolve({
                vesselId: row.vessel_id,
                name: row.name,
                status: row.status,
                type: row.type,
                latitude: row.latitude ? parseFloat(row.latitude) : null,
                longitude: row.longitude ? parseFloat(row.longitude) : null,
                speed: row.speed ? parseFloat(row.speed) : 0,
                direction: row.direction ? parseFloat(row.direction) : 0
            });
        });
    });
}

/**
 * Update vessel location in database
 * @param {number} vesselId 
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {number} speed 
 * @param {number} direction 
 */
async function updateVesselLocation(vesselId, latitude, longitude, speed, direction) {
    return new Promise((resolve, reject) => {
        // Validate coordinates to prevent undefined/null values
        if (latitude == null || longitude == null || 
            isNaN(latitude) || isNaN(longitude)) {
            return reject(new Error('Invalid coordinates: latitude or longitude is undefined/null'));
        }
        
        const query = `
            INSERT INTO vessel_locations (vessel_id, latitude, longitude, speed, direction)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        db.query(query, [
            vesselId, 
            latitude.toFixed(7), 
            longitude.toFixed(7), 
            (speed || 0).toFixed(2), 
            (direction || 0).toFixed(2)
        ], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

/**
 * Update vessel status to Docked
 * @param {number} vesselId 
 */
async function dockVessel(vesselId) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE vessels 
            SET status = 'Docked' 
            WHERE vessel_id = ?
        `;
        
        db.query(query, [vesselId], (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
}

/**
 * Calculate bearing/direction between two points
 * @param {number} lat1 Start latitude
 * @param {number} lng1 Start longitude
 * @param {number} lat2 End latitude
 * @param {number} lng2 End longitude
 * @returns {number} Bearing in degrees (0-360)
 */
function calculateBearing(lat1, lng1, lat2, lng2) {
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;
    
    const dLng = toRad(lng2 - lng1);
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);
    
    const x = Math.sin(dLng) * Math.cos(lat2Rad);
    const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    let bearing = toDeg(Math.atan2(x, y));
    return (bearing + 360) % 360;
}

/**
 * Calculate distance between two points (Haversine formula)
 * @param {number} lat1 
 * @param {number} lng1 
 * @param {number} lat2 
 * @param {number} lng2 
 * @returns {number} Distance in nautical miles
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3440.065; // Earth radius in nautical miles
    const toRad = deg => deg * Math.PI / 180;
    
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) ** 2 + 
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
              Math.sin(dLng / 2) ** 2;
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Interpolate position between two waypoints
 * @param {Object} from Starting waypoint {lat, lng}
 * @param {Object} to Ending waypoint {lat, lng}
 * @param {number} progress Progress between 0 and 1
 * @returns {Object} Interpolated position {lat, lng}
 */
function interpolatePosition(from, to, progress) {
    // Clamp progress between 0 and 1
    const t = Math.max(0, Math.min(1, progress));
    
    return {
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t
    };
}

/**
 * Start simulation for a vessel
 * @param {number} vesselId 
 * @param {Object} options Simulation options
 * @returns {Object} Result with success status and message
 */
async function startSimulation(vesselId, options = {}) {
    // Check if simulation is already running for this vessel
    if (activeSimulations.has(vesselId)) {
        return { success: false, message: 'Simulation already running for this vessel' };
    }
    
    try {
        // Get vessel and route data
        const vessel = await getVesselCurrentState(vesselId);
        if (!vessel) {
            return { success: false, message: 'Vessel not found' };
        }
        
        // Don't start simulation for docked or maintenance vessels
        if (vessel.status === 'Docked' || vessel.status === 'Maintenance') {
            return { success: false, message: `Vessel is ${vessel.status}, cannot start simulation` };
        }
        
        const waypoints = await getVesselRouteWaypoints(vesselId);
        if (waypoints.length < 2) {
            return { success: false, message: 'Not enough waypoints for route simulation' };
        }
        
        // Initialize simulation state
        const state = {
            vesselId,
            vesselName: vessel.name,
            waypoints,
            currentIndex: 0,
            progress: 0, // Progress between current and next waypoint (0-1)
            speed: options.speed || SIMULATION_CONFIG.defaultSpeed,
            intervalMs: options.intervalMs || SIMULATION_CONFIG.updateIntervalMs,
            isDocked: false
        };
        
        // Find nearest waypoint to current position
        if (vessel.latitude && vessel.longitude) {
            let minDist = Infinity;
            waypoints.forEach((wp, idx) => {
                const dist = calculateDistance(vessel.latitude, vessel.longitude, wp.lat, wp.lng);
                if (dist < minDist) {
                    minDist = dist;
                    state.currentIndex = Math.max(0, idx - 1); // Start from previous waypoint
                }
            });
        }
        
        // Silent start - logs only on completion/docking
        
        // Start the simulation interval
        const intervalId = setInterval(async () => {
            await processSimulationTick(state);
        }, state.intervalMs);
        
        // Store the interval and state
        activeSimulations.set(vesselId, { intervalId, state });
        
        return { 
            success: true, 
            message: `Simulation started for vessel ${vessel.name}`,
            waypointCount: waypoints.length,
            startingIndex: state.currentIndex
        };
        
    } catch (error) {
        console.error(`Error starting simulation for vessel ${vesselId}:`, error);
        return { success: false, message: error.message };
    }
}

/**
 * Process one tick of the simulation
 * @param {Object} state Simulation state object
 */
async function processSimulationTick(state) {
    const { vesselId, waypoints, currentIndex } = state;
    
    try {
        // CRITICAL: Check if vessel has reached or passed the final waypoint
        if (currentIndex >= waypoints.length - 1) {
            await handleVesselDocking(state);
            return;
        }
        
        // Get current and next waypoint
        const currentWaypoint = waypoints[currentIndex];
        const nextWaypoint = waypoints[currentIndex + 1];
        
        // Validate waypoints exist and have valid coordinates
        if (!currentWaypoint || !nextWaypoint ||
            currentWaypoint.lat == null || currentWaypoint.lng == null ||
            nextWaypoint.lat == null || nextWaypoint.lng == null) {
            console.error(`Invalid waypoints for vessel ${vesselId}`);
            await handleVesselDocking(state);
            return;
        }
        
        // Calculate segment distance and how much we move per tick
        const segmentDistance = calculateDistance(
            currentWaypoint.lat, currentWaypoint.lng,
            nextWaypoint.lat, nextWaypoint.lng
        );
        
        // Speed in knots, interval in ms -> distance per tick in nautical miles
        // 1 knot = 1 nautical mile per hour
        // Apply simulation speed multiplier for faster demo (real time would be too slow)
        const speedVariation = 1 + (Math.random() - 0.5) * SIMULATION_CONFIG.speedVariation;
        const currentSpeed = state.speed * speedVariation;
        const realTimeHours = (state.intervalMs / 1000) / 3600; // Convert ms to hours
        const simulatedHours = realTimeHours * SIMULATION_CONFIG.simulationSpeedMultiplier;
        const distancePerTick = currentSpeed * simulatedHours; // Distance in nautical miles
        
        // Progress increment for this segment (0 to 1)
        const progressIncrement = segmentDistance > 0 ? distancePerTick / segmentDistance : 0.1;
        state.progress += progressIncrement;
        
        // Check if we've reached or passed the next waypoint
        if (state.progress >= 1) {
            state.currentIndex++;
            state.progress = 0;
            
            // CRITICAL: Check bounds AFTER incrementing
            if (state.currentIndex >= waypoints.length - 1) {
                await handleVesselDocking(state);
                return;
            }
        }
        
        // Calculate interpolated position
        const fromWaypoint = waypoints[state.currentIndex];
        const toWaypoint = waypoints[Math.min(state.currentIndex + 1, waypoints.length - 1)];
        
        // Validate waypoints before interpolation
        if (!fromWaypoint || !toWaypoint) {
            console.error(`Missing waypoint data for vessel ${vesselId}`);
            await handleVesselDocking(state);
            return;
        }
        
        const position = interpolatePosition(fromWaypoint, toWaypoint, state.progress);
        const direction = calculateBearing(
            fromWaypoint.lat, fromWaypoint.lng,
            toWaypoint.lat, toWaypoint.lng
        );
        
        // Validate calculated position
        if (position.lat == null || position.lng == null ||
            isNaN(position.lat) || isNaN(position.lng)) {
            console.error(`Invalid interpolated position for vessel ${vesselId}`);
            await handleVesselDocking(state);
            return;
        }
        
        // Update vessel location in database
        await updateVesselLocation(
            vesselId,
            position.lat,
            position.lng,
            currentSpeed,
            direction
        );
        
        // Silent operation - no console spam
        // Uncomment below for debugging:
        // console.log(`📍 Vessel ${state.vesselName}: waypoint ${state.currentIndex + 1}/${waypoints.length}, progress: ${(state.progress * 100).toFixed(1)}%`);
        
    } catch (error) {
        console.error(`Simulation tick error for vessel ${vesselId}:`, error);
    }
}

/**
 * Handle vessel reaching final waypoint - dock the vessel
 * @param {Object} state Simulation state
 */
async function handleVesselDocking(state) {
    const { vesselId, vesselName, waypoints } = state;
    
    // Prevent multiple docking operations
    if (state.isDocked) {
        return;
    }
    state.isDocked = true;
    
    try {
        // Get the final waypoint coordinates (safely)
        const finalWaypointIndex = Math.min(waypoints.length - 1, Math.max(0, waypoints.length - 1));
        const finalWaypoint = waypoints[finalWaypointIndex];
        
        if (!finalWaypoint || finalWaypoint.lat == null || finalWaypoint.lng == null) {
            console.error(`Invalid final waypoint for vessel ${vesselId}`);
            stopSimulation(vesselId);
            return;
        }
        
        // Update vessel location to final waypoint with speed = 0
        await updateVesselLocation(
            vesselId,
            finalWaypoint.lat,
            finalWaypoint.lng,
            0,  // Speed = 0 (vessel stopped)
            0   // Direction = 0 (stationary)
        );
        
        // Update vessel status to Docked
        await dockVessel(vesselId);
        
        // Update route status to completed
        await new Promise((resolve, reject) => {
            db.query(
                `UPDATE routes SET status = 'completed' WHERE vessel_id = ? AND status = 'active'`,
                [vesselId],
                (err) => err ? reject(err) : resolve()
            );
        });
        
        console.log(`⚓ ${vesselName} docked`);
        
    } catch (error) {
        console.error(`Error docking vessel ${vesselId}:`, error);
    } finally {
        // Stop the simulation interval
        stopSimulation(vesselId);
    }
}

/**
 * Stop simulation for a vessel
 * @param {number} vesselId 
 * @returns {Object} Result with success status
 */
function stopSimulation(vesselId) {
    const simulation = activeSimulations.get(vesselId);
    
    if (simulation) {
        clearInterval(simulation.intervalId);
        activeSimulations.delete(vesselId);
        return { success: true, message: `Simulation stopped for vessel ${vesselId}` };
    }
    
    return { success: false, message: 'No active simulation for this vessel' };
}

/**
 * Stop all active simulations
 */
function stopAllSimulations() {
    for (const [vesselId, simulation] of activeSimulations) {
        clearInterval(simulation.intervalId);
    }
    activeSimulations.clear();
    return { success: true, message: 'All simulations stopped' };
}

/**
 * Get simulation status for a vessel
 * @param {number} vesselId 
 * @returns {Object} Simulation status
 */
function getSimulationStatus(vesselId) {
    const simulation = activeSimulations.get(vesselId);
    
    if (!simulation) {
        return { running: false };
    }
    
    const { state } = simulation;
    return {
        running: true,
        vesselId: state.vesselId,
        vesselName: state.vesselName,
        currentWaypointIndex: state.currentIndex,
        totalWaypoints: state.waypoints.length,
        progress: state.progress,
        isDocked: state.isDocked,
        speed: state.speed
    };
}

/**
 * Get all active simulations status
 * @returns {Array} Array of simulation statuses
 */
function getAllSimulationsStatus() {
    const statuses = [];
    
    for (const [vesselId, simulation] of activeSimulations) {
        const { state } = simulation;
        statuses.push({
            vesselId: state.vesselId,
            vesselName: state.vesselName,
            currentWaypointIndex: state.currentIndex,
            totalWaypoints: state.waypoints.length,
            progress: state.progress,
            isDocked: state.isDocked
        });
    }
    
    return statuses;
}

/**
 * Reactivate a docked vessel for new simulation
 * @param {number} vesselId 
 * @returns {Promise<Object>} Result
 */
async function reactivateVessel(vesselId) {
    return new Promise((resolve, reject) => {
        db.query(
            `UPDATE vessels SET status = 'Active' WHERE vessel_id = ? AND status = 'Docked'`,
            [vesselId],
            (err, result) => {
                if (err) return reject(err);
                if (result.affectedRows === 0) {
                    return resolve({ success: false, message: 'Vessel not found or not docked' });
                }
                resolve({ success: true, message: 'Vessel reactivated' });
            }
        );
    });
}

module.exports = {
    startSimulation,
    stopSimulation,
    stopAllSimulations,
    getSimulationStatus,
    getAllSimulationsStatus,
    reactivateVessel,
    SIMULATION_CONFIG
};
