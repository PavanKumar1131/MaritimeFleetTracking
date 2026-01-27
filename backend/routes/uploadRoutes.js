// uploadRoutes.js
// API endpoints for file uploads (CSV/JSON)

const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { verifyToken, isAdmin, isOperatorOrAdmin } = require('../middleware/authMiddleware');

// Simple file upload middleware using multer
const multer = require('multer');

// Configure multer for memory storage (no disk writes)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
    },
    fileFilter: (req, file, cb) => {
        // Only allow CSV and JSON files
        const allowedTypes = ['.csv', '.json'];
        const ext = '.' + file.originalname.split('.').pop().toLowerCase();
        
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV and JSON files are allowed'), false);
        }
    }
});

// All routes require authentication
router.use(verifyToken);

// Upload vessels (admin only)
router.post('/vessels', isAdmin, upload.single('file'), uploadController.uploadVessels);

// Upload routes (admin only)
router.post('/routes', isAdmin, upload.single('file'), uploadController.uploadRoutes);

// Upload waypoints for a specific route (operator or admin)
router.post('/routes/:routeId/waypoints', isOperatorOrAdmin, upload.single('file'), uploadController.uploadWaypoints);

// Export data (any authenticated user)
router.get('/export/vessels', uploadController.exportVessels);
router.get('/export/routes', uploadController.exportRoutes);

// Get CSV templates
router.get('/templates/vessel', uploadController.getVesselTemplate);
router.get('/templates/route', uploadController.getRouteTemplate);

module.exports = router;
