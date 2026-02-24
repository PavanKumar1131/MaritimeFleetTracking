/**
 * Simulation Controller
 * 
 * API endpoints for vessel movement simulation control.
 * Handles starting, stopping, and monitoring vessel simulations.
 */

const simulationService = require('../services/vesselSimulationService');

/**
 * Start simulation for a specific vessel
 * POST /api/simulation/start/:vesselId
 */
exports.startVesselSimulation = async (req, res) => {
    try {
        const { vesselId } = req.params;
        const { speed, intervalMs } = req.body;
        
        if (!vesselId || isNaN(parseInt(vesselId))) {
            return res.status(400).json({ 
                error: 'Valid vessel ID is required' 
            });
        }
        
        const result = await simulationService.startSimulation(
            parseInt(vesselId),
            { speed, intervalMs }
        );
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
        
    } catch (error) {
        console.error('Error starting simulation:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Stop simulation for a specific vessel
 * POST /api/simulation/stop/:vesselId
 */
exports.stopVesselSimulation = (req, res) => {
    try {
        const { vesselId } = req.params;
        
        if (!vesselId || isNaN(parseInt(vesselId))) {
            return res.status(400).json({ 
                error: 'Valid vessel ID is required' 
            });
        }
        
        const result = simulationService.stopSimulation(parseInt(vesselId));
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
        
    } catch (error) {
        console.error('Error stopping simulation:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Stop all active simulations
 * POST /api/simulation/stop-all
 */
exports.stopAllSimulations = (req, res) => {
    try {
        const result = simulationService.stopAllSimulations();
        res.json(result);
    } catch (error) {
        console.error('Error stopping all simulations:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get simulation status for a specific vessel
 * GET /api/simulation/status/:vesselId
 */
exports.getVesselSimulationStatus = (req, res) => {
    try {
        const { vesselId } = req.params;
        
        if (!vesselId || isNaN(parseInt(vesselId))) {
            return res.status(400).json({ 
                error: 'Valid vessel ID is required' 
            });
        }
        
        const status = simulationService.getSimulationStatus(parseInt(vesselId));
        res.json(status);
        
    } catch (error) {
        console.error('Error getting simulation status:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all active simulations status
 * GET /api/simulation/status
 */
exports.getAllSimulationsStatus = (req, res) => {
    try {
        const statuses = simulationService.getAllSimulationsStatus();
        res.json({
            activeCount: statuses.length,
            simulations: statuses
        });
    } catch (error) {
        console.error('Error getting all simulation statuses:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reactivate a docked vessel
 * POST /api/simulation/reactivate/:vesselId
 */
exports.reactivateVessel = async (req, res) => {
    try {
        const { vesselId } = req.params;
        
        if (!vesselId || isNaN(parseInt(vesselId))) {
            return res.status(400).json({ 
                error: 'Valid vessel ID is required' 
            });
        }
        
        const result = await simulationService.reactivateVessel(parseInt(vesselId));
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
        
    } catch (error) {
        console.error('Error reactivating vessel:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Start simulations for all active vessels with routes
 * POST /api/simulation/start-all
 */
exports.startAllSimulations = async (req, res) => {
    const db = require('../config/db');
    
    try {
        // Get all active vessels with active routes
        const query = `
            SELECT DISTINCT v.vessel_id, v.name
            FROM vessels v
            INNER JOIN routes r ON v.vessel_id = r.vessel_id
            WHERE v.status = 'Active' AND r.status = 'active'
        `;
        
        db.query(query, async (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const startResults = [];
            
            for (const vessel of results) {
                const result = await simulationService.startSimulation(vessel.vessel_id);
                startResults.push({
                    vesselId: vessel.vessel_id,
                    vesselName: vessel.name,
                    ...result
                });
            }
            
            res.json({
                message: `Started simulations for ${startResults.filter(r => r.success).length} vessels`,
                results: startResults
            });
        });
        
    } catch (error) {
        console.error('Error starting all simulations:', error);
        res.status(500).json({ error: error.message });
    }
};
