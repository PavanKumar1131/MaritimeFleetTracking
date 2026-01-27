// authController.js
// handles user login/registration/management

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// register a new user - only admins can do this
exports.register = async (req, res) => {
    const { name, email, password, role } = req.body;

    // check required fields
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        // see if email already taken
        db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length > 0) {
                return res.status(400).json({ error: 'User already exists' });
            }

            // hash the password before saving
            const hashedPassword = await bcrypt.hash(password, 10);

            // add user to db
            const query = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
            db.query(query, [name, email, hashedPassword, role || 'viewer'], (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// login user and return jwt token
exports.login = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = results[0];

        try {
            // check if password matches
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // make role lowercase for consistency
            const normalizedRole = user.role.toLowerCase();

            // create jwt token
            const token = jwt.sign(
                { id: user.id, email: user.email, role: normalizedRole },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: normalizedRole
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login processing error' });
        }
    });
};

// get list of all users (admin only)
exports.getAllUsers = (req, res) => {
    db.query('SELECT id, name, email, role, created_at FROM users', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// delete a user (admin only)
exports.deleteUser = (req, res) => {
    const { id } = req.params;
    
    db.query('DELETE FROM users WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    });
};

// update user info (admin only)
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, role, password } = req.body;
    
    try {
        let query, params;
        
        // if password provided, hash it and include in update
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query = 'UPDATE users SET name = ?, email = ?, role = ?, password = ? WHERE id = ?';
            params = [name, email, role, hashedPassword, id];
        } else {
            query = 'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?';
            params = [name, email, role, id];
        }
        
        db.query(query, params, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({ message: 'User updated successfully' });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
