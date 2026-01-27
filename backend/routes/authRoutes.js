// authRoutes.js - routes for login and user management

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// anyone can login
router.post('/login', authController.login);

// these are admin only routes
router.post('/register', verifyToken, isAdmin, authController.register);
router.get('/users', verifyToken, isAdmin, authController.getAllUsers);
router.put('/users/:id', verifyToken, isAdmin, authController.updateUser);
router.delete('/users/:id', verifyToken, isAdmin, authController.deleteUser);

module.exports = router;
