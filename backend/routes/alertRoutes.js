const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { verifyToken, isOperatorOrAdmin } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// GET routes (all authenticated users)
router.get('/', alertController.getAllAlerts);
router.get('/active', alertController.getActiveAlerts);
router.get('/stats', alertController.getAlertStats);
router.get('/vessel/:vesselId', alertController.getVesselAlerts);

// POST/PUT/DELETE routes (operators and admins only)
router.post('/', isOperatorOrAdmin, alertController.createAlert);
router.put('/:id/resolve', isOperatorOrAdmin, alertController.resolveAlert);
router.delete('/:id', isOperatorOrAdmin, alertController.deleteAlert);

module.exports = router;
