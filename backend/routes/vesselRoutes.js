// vesselRoutes.js - all vessel api endpoints

const express = require('express');
const router = express.Router();
const vesselController = require('../controllers/vesselController');
const { verifyToken, isOperatorOrAdmin, isAdmin } = require('../middleware/authMiddleware');

// need to be logged in for all routes
router.use(verifyToken);

// anyone logged in can view vessels
router.get('/', vesselController.getAllVessels);
router.get('/stats', vesselController.getVesselStats);
router.get('/:id', vesselController.getVesselById);

// operators and admins can update metrics
router.patch('/:id/metrics', isOperatorOrAdmin, vesselController.updateVesselMetrics);

// only admins can add or delete vessels
router.post('/', isAdmin, vesselController.addVessel);
router.put('/:id', isAdmin, vesselController.updateVessel);
router.delete('/:id', isAdmin, vesselController.deleteVessel);

// operators can update location for tracking
router.post('/:id/location', isOperatorOrAdmin, vesselController.updateVesselLocation);

module.exports = router;
