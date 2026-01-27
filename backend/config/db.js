// db.js - mysql database connection
// uses env variables or defaults

const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'railway',
    port: process.env.DB_PORT || 3306
});

// try to connect
db.connect(err => {
    if (err) {
        console.error('❌ MySQL connection failed:', err.message);
        return;
    }
    console.log('✅ MySQL Database Connected');
});

module.exports = db;
