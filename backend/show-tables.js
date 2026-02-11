const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'railway',
    port: process.env.DB_PORT || 3306
});

async function showTables() {
    console.log('\n📋 DATABASE TABLES & STRUCTURE\n');
    console.log('='.repeat(60));

    try {
        // Get all tables
        const [tables] = await db.promise().query('SHOW TABLES');
        const tableKey = Object.keys(tables[0])[0];
        
        console.log(`\n📁 Found ${tables.length} tables:\n`);
        tables.forEach((t, i) => console.log(`   ${i + 1}. ${t[tableKey]}`));
        
        // Show CREATE TABLE for each table
        for (const table of tables) {
            const tableName = table[tableKey];
            console.log('\n' + '='.repeat(60));
            console.log(`\n📌 TABLE: ${tableName}\n`);
            
            const [createResult] = await db.promise().query(`SHOW CREATE TABLE ${tableName}`);
            console.log(createResult[0]['Create Table']);
            console.log();
        }
        
        db.end();
        console.log('\n✅ Done!\n');
        
    } catch (err) {
        console.error('❌ Error:', err.message);
        db.end();
    }
}

showTables();
