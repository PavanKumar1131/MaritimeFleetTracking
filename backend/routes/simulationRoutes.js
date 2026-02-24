/**
 * Simulation Routes
 * 
 * API endpoints for vessel movement simulation control.
 * Admin and operator users can control simulations.
 */

const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulationController');
const { verifyToken, isOperatorOrAdmin, isAdmin } = require('../middleware/authMiddleware');

// All simulation routes require authentication
router.use(verifyToken);

// Get status of all active simulations (any authenticated user)
router.get('/status', simulationController.getAllSimulationsStatus);

// Get status of specific vessel simulation (any authenticated user)
router.get('/status/:vesselId', simulationController.getVesselSimulationStatus);

// Start simulation for a specific vessel (operator or admin)
router.post('/start/:vesselId', isOperatorOrAdmin, simulationController.startVesselSimulation);

// Start simulations for all active vessels (admin only)
router.post('/start-all', isAdmin, simulationController.startAllSimulations);

// Stop simulation for a specific vessel (operator or admin)
router.post('/stop/:vesselId', isOperatorOrAdmin, simulationController.stopVesselSimulation);

// Stop all simulations (admin only)
router.post('/stop-all', isAdmin, simulationController.stopAllSimulations);

// Reactivate a docked vessel (admin only)
router.post('/reactivate/:vesselId', isAdmin, simulationController.reactivateVessel);

module.exports = router;
