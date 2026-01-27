// trackingRoutes.js
// API endpoints for live tracking and submarine depth

const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { verifyToken, isOperatorOrAdmin } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Live tracking - get all active vessels
router.get('/live', trackingController.getLiveTracking);

// Fleet overview for dashboard
router.get('/overview', trackingController.getFleetOverview);

// Submarine specific endpoints
router.get('/submarines', trackingController.getAllSubmarines);
router.get('/submarines/:vesselId/depth', trackingController.getSubmarineDepth);
router.post('/submarines/:vesselId/depth', isOperatorOrAdmin, trackingController.updateSubmarineDepth);

// Vessel location history (for trail/path visualization)
router.get('/history/:vesselId', trackingController.getVesselHistory);

module.exports = router;
