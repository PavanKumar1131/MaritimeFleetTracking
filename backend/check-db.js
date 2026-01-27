const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

db.connect(err => {
    if (err) {
        console.error('Connection error:', err);
        return;
    }
    
    console.log('✅ Connected to database\n');
    
    // Check users
    db.query('SELECT id, name, email, role FROM users', (err, results) => {
        if (err) {
            console.error('Query error:', err);
        } else {
            console.log('Users in database:');
            console.table(results);
        }
        
        // Check vessels
        db.query('SELECT COUNT(*) as count FROM vessels', (err, results) => {
            if (err) console.error(err);
            else console.log(`\nVessels: ${results[0].count}`);
            
            // Check routes
            db.query('SELECT COUNT(*) as count FROM routes', (err, results) => {
                if (err) console.error(err);
                else console.log(`Routes: ${results[0].count}`);
                db.end();
            });
        });
    });
});
