// routeRoutes.js - api routes for routes (confusing name lol)

const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// all need auth
router.use(verifyToken);

// viewing is for everyone
router.get('/', routeController.getAllRoutes);
router.get('/stats', routeController.getRouteStats);
router.get('/:id', routeController.getRouteById);

// editing routes is admin only
router.post('/', isAdmin, routeController.addRoute);
router.put('/:id', isAdmin, routeController.updateRoute);
router.delete('/:id', isAdmin, routeController.deleteRoute);

module.exports = router;
