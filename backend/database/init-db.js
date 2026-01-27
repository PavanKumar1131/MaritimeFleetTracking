const bcrypt = require('bcrypt');
const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    multipleStatements: true
});

async function initDatabase() {
    console.log('🔧 Initializing Maritime Fleet Database with 8 Tables...\n');

    try {
        // Create database
        await db.promise().query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
        console.log('✅ Database created/verified');

        await db.promise().query(`USE ${process.env.DB_NAME}`);

        // Drop existing tables to recreate with correct schema
        await db.promise().query(`
            SET FOREIGN_KEY_CHECKS = 0;
            DROP TABLE IF EXISTS alerts;
            DROP TABLE IF EXISTS submarine_depth_logs;
            DROP TABLE IF EXISTS engine_logs;
            DROP TABLE IF EXISTS route_waypoints;
            DROP TABLE IF EXISTS routes;
            DROP TABLE IF EXISTS vessel_locations;
            DROP TABLE IF EXISTS vessels;
            DROP TABLE IF EXISTS users;
            DROP TABLE IF EXISTS sea_routes;
            DROP TABLE IF EXISTS analytics_logs;
            SET FOREIGN_KEY_CHECKS = 1;
        `);
        console.log('✅ Cleaned old tables');

        // ============ TABLE 1: users ============
        await db.promise().query(`
            CREATE TABLE users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'operator', 'viewer') DEFAULT 'viewer',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table 1/8: users');

        // ============ TABLE 2: vessels ============
        await db.promise().query(`
            CREATE TABLE vessels (
                vessel_id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(150) NOT NULL,
                type ENUM('Cargo', 'Naval', 'Submarine', 'Tanker', 'Passenger') NOT NULL,
                imo_number VARCHAR(20),
                engine_health INT DEFAULT 100,
                weather_status VARCHAR(50) DEFAULT 'Clear',
                status ENUM('Active', 'Docked', 'Maintenance') DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table 2/8: vessels');

        // ============ TABLE 3: vessel_locations ============
        await db.promise().query(`
            CREATE TABLE vessel_locations (
                id INT PRIMARY KEY AUTO_INCREMENT,
                vessel_id INT NOT NULL,
                latitude DECIMAL(10, 7) NOT NULL,
                longitude DECIMAL(10, 7) NOT NULL,
                speed DECIMAL(5, 2) DEFAULT 0,
                direction DECIMAL(5, 2) DEFAULT 0,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vessel_id) REFERENCES vessels(vessel_id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table 3/8: vessel_locations');

        // ============ TABLE 4: routes ============
        await db.promise().query(`
            CREATE TABLE routes (
                route_id INT PRIMARY KEY AUTO_INCREMENT,
                route_name VARCHAR(150) NOT NULL,
                risk_level ENUM('low', 'medium', 'high') DEFAULT 'low',
                vessel_id INT,
                status ENUM('planned', 'active', 'completed') DEFAULT 'planned',
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vessel_id) REFERENCES vessels(vessel_id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Table 4/8: routes');

        // ============ TABLE 5: route_waypoints ============
        await db.promise().query(`
            CREATE TABLE route_waypoints (
                id INT PRIMARY KEY AUTO_INCREMENT,
                route_id INT NOT NULL,
                latitude DECIMAL(10, 7) NOT NULL,
                longitude DECIMAL(10, 7) NOT NULL,
                order_index INT NOT NULL,
                FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table 5/8: route_waypoints');

        // ============ TABLE 6: engine_logs ============
        await db.promise().query(`
            CREATE TABLE engine_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                vessel_id INT NOT NULL,
                engine_health INT NOT NULL,
                fuel_level INT DEFAULT 100,
                logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vessel_id) REFERENCES vessels(vessel_id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table 6/8: engine_logs');

        // ============ TABLE 7: submarine_depth_logs ============
        await db.promise().query(`
            CREATE TABLE submarine_depth_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                vessel_id INT NOT NULL,
                depth INT NOT NULL,
                pressure DECIMAL(10, 2),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vessel_id) REFERENCES vessels(vessel_id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table 7/8: submarine_depth_logs');

        // ============ TABLE 8: alerts ============
        await db.promise().query(`
            CREATE TABLE alerts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                alert_type VARCHAR(50) NOT NULL,
                severity ENUM('info', 'warning', 'critical') DEFAULT 'info',
                vessel_id INT,
                message TEXT NOT NULL,
                is_resolved BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vessel_id) REFERENCES vessels(vessel_id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table 8/8: alerts');

        console.log('\n📊 All 8 tables created successfully!\n');

        // ============ INSERT DEMO DATA ============
        console.log('📦 Inserting demo data...\n');

        // Users
        const adminHash = await bcrypt.hash('admin123', 10);
        const operatorHash = await bcrypt.hash('operator123', 10);
        const viewerHash = await bcrypt.hash('viewer123', 10);

        await db.promise().query(`
            INSERT INTO users (name, email, password, role) VALUES
            ('Captain Admin', 'admin@maritime.com', '${adminHash}', 'admin'),
            ('Officer Smith', 'operator@maritime.com', '${operatorHash}', 'operator'),
            ('Crew Johnson', 'viewer@maritime.com', '${viewerHash}', 'viewer')
        `);
        console.log('✅ Users inserted');

        // Vessels
        await db.promise().query(`
            INSERT INTO vessels (vessel_id, name, type, engine_health, weather_status, status) VALUES
            (1, 'MV Atlantic Voyager', 'Cargo', 92, 'Clear', 'Active'),
            (2, 'USS Defender', 'Naval', 98, 'Clear', 'Active'),
            (3, 'SS Black Gold', 'Tanker', 65, 'Stormy', 'Active'),
            (4, 'Neptune Deep', 'Submarine', 88, 'N/A', 'Active'),
            (5, 'Pacific Trader', 'Cargo', 78, 'Foggy', 'Active'),
            (6, 'Gulf Pioneer', 'Tanker', 55, 'Rainy', 'Maintenance'),
            (7, 'HMS Royal Guard', 'Naval', 95, 'Clear', 'Active'),
            (8, 'Deep Explorer', 'Submarine', 90, 'N/A', 'Active')
        `);
        console.log('✅ Vessels inserted');

        // Vessel Locations (live tracking data)
        await db.promise().query(`
            INSERT INTO vessel_locations (vessel_id, latitude, longitude, speed, direction) VALUES
            (1, 40.7128, -74.0060, 12.5, 45),
            (2, 36.8508, -76.2859, 25.0, 180),
            (3, 29.7604, -95.3698, 8.0, 270),
            (4, 33.7490, -84.3880, 15.0, 90),
            (5, 34.0522, -118.2437, 10.0, 315),
            (6, 25.7617, -80.1918, 0.0, 0),
            (7, 51.5074, -0.1278, 22.0, 120),
            (8, 35.6762, 139.6503, 18.0, 200)
        `);
        console.log('✅ Vessel locations inserted');

        // Routes
        await db.promise().query(`
            INSERT INTO routes (route_id, route_name, risk_level, vessel_id, status, description) VALUES
            (1, 'Atlantic Crossing', 'medium', 1, 'active', 'New York to London transatlantic route'),
            (2, 'Gulf Patrol', 'low', 2, 'active', 'Routine patrol mission in Gulf'),
            (3, 'Oil Transport Run', 'high', 3, 'active', 'Houston to Miami oil transport'),
            (4, 'Pacific Supply Line', 'medium', 5, 'active', 'LA to Tokyo supply route'),
            (5, 'Mediterranean Circuit', 'low', 7, 'planned', 'European naval exercise route'),
            (6, 'Deep Sea Research', 'high', 4, 'active', 'Atlantic deep research mission')
        `);
        console.log('✅ Routes inserted');

        // Route Waypoints
        await db.promise().query(`
            INSERT INTO route_waypoints (route_id, latitude, longitude, order_index) VALUES
            (1, 40.7128, -74.0060, 1), (1, 42.3601, -50.0000, 2), (1, 48.8566, -2.3522, 3), (1, 51.5074, -0.1278, 4),
            (2, 36.8508, -76.2859, 1), (2, 30.0000, -85.0000, 2), (2, 25.7617, -80.1918, 3),
            (3, 29.7604, -95.3698, 1), (3, 27.0000, -90.0000, 2), (3, 25.7617, -80.1918, 3),
            (4, 34.0522, -118.2437, 1), (4, 21.3069, -157.8583, 2), (4, 35.6762, 139.6503, 3),
            (5, 51.5074, -0.1278, 1), (5, 43.2965, 5.3698, 2), (5, 41.9028, 12.4964, 3),
            (6, 33.7490, -84.3880, 1), (6, 30.0000, -70.0000, 2), (6, 25.0000, -60.0000, 3)
        `);
        console.log('✅ Route waypoints inserted');

        // Engine Logs (historical data)
        await db.promise().query(`
            INSERT INTO engine_logs (vessel_id, engine_health, fuel_level, logged_at) VALUES
            (1, 95, 80, NOW() - INTERVAL 7 DAY),
            (1, 94, 70, NOW() - INTERVAL 5 DAY),
            (1, 92, 60, NOW() - INTERVAL 2 DAY),
            (1, 92, 55, NOW()),
            (2, 98, 90, NOW() - INTERVAL 3 DAY),
            (2, 98, 85, NOW()),
            (3, 70, 40, NOW() - INTERVAL 5 DAY),
            (3, 68, 35, NOW() - INTERVAL 3 DAY),
            (3, 65, 30, NOW()),
            (4, 90, 95, NOW() - INTERVAL 2 DAY),
            (4, 88, 90, NOW()),
            (5, 80, 65, NOW() - INTERVAL 4 DAY),
            (5, 78, 55, NOW()),
            (6, 60, 20, NOW() - INTERVAL 1 DAY),
            (6, 55, 15, NOW())
        `);
        console.log('✅ Engine logs inserted');

        // Submarine Depth Logs
        await db.promise().query(`
            INSERT INTO submarine_depth_logs (vessel_id, depth, pressure, timestamp) VALUES
            (4, 150, 15.5, NOW() - INTERVAL 6 HOUR),
            (4, 200, 20.5, NOW() - INTERVAL 4 HOUR),
            (4, 350, 35.8, NOW() - INTERVAL 2 HOUR),
            (4, 300, 30.9, NOW()),
            (8, 100, 10.3, NOW() - INTERVAL 5 HOUR),
            (8, 250, 25.7, NOW() - INTERVAL 3 HOUR),
            (8, 400, 41.2, NOW() - INTERVAL 1 HOUR),
            (8, 380, 39.1, NOW())
        `);
        console.log('✅ Submarine depth logs inserted');

        // Alerts
        await db.promise().query(`
            INSERT INTO alerts (alert_type, severity, vessel_id, message, is_resolved) VALUES
            ('engine_failure', 'critical', 3, 'Engine health critical - 65%. Immediate maintenance required.', FALSE),
            ('low_fuel', 'critical', 6, 'Fuel level critically low - 15%. Refueling needed.', FALSE),
            ('weather_warning', 'warning', 3, 'Stormy weather detected on current route.', FALSE),
            ('maintenance_due', 'warning', 6, 'Engine health below threshold - 55%.', FALSE),
            ('route_deviation', 'info', 8, 'Approaching maximum safe depth - 400m.', FALSE),
            ('weather_warning', 'info', 5, 'Foggy conditions affecting visibility.', TRUE),
            ('collision_risk', 'critical', 3, 'High risk route - exercise caution.', FALSE)
        `);
        console.log('✅ Alerts inserted');

        console.log('\n🎉 DATABASE INITIALIZATION COMPLETE!\n');
        console.log('📋 Summary:');
        console.log('   • 8 Tables created');
        console.log('   • 3 Users');
        console.log('   • 8 Vessels');
        console.log('   • 6 Routes with waypoints');
        console.log('   • Engine & depth logs');
        console.log('   • Active alerts\n');
        console.log('🔐 Demo Credentials:');
        console.log('   Admin:    admin@maritime.com / admin123');
        console.log('   Operator: operator@maritime.com / operator123');
        console.log('   Viewer:   viewer@maritime.com / viewer123\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        db.end();
    }
}

initDatabase();
