// authMiddleware.js
// middleware for checking jwt tokens and user roles

const jwt = require('jsonwebtoken');

// checks if request has valid token
exports.verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Invalid token' });
        req.user = decoded;
        next();
    });
};

// allows certain roles only
exports.allowRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};

// admin only check
exports.isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// admin or operator check
exports.isAdminOrOperator = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'operator') {
        return res.status(403).json({ error: 'Admin or Operator access required' });
    }
    next();
};

// same thing different name (kept both for compatibility)
exports.isOperatorOrAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'operator') {
        return res.status(403).json({ error: 'Admin or Operator access required' });
    }
    next();
};
