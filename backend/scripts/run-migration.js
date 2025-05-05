const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
  let connection;
  try {
    // Create connection without database
    connection = await mysql.createConnection({
      host: process.env.MYSQLHOST || 'localhost',
      user: process.env.MYSQLUSER || 'root',
      password: process.env.MYSQLPASSWORD || '',
      multipleStatements: true
    });

    // Create database if it doesn't exist
    const dbName = process.env.MYSQLDATABASE || 'pokalbiu_sistema';
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`Database ${dbName} created or already exists`);

    // Use the database
    await connection.query(`USE ${dbName}`);

    // Read schema file to create tables
    const schemaPath = path.join(__dirname, '../src/config/schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    await connection.query(schema);
    console.log('Tables created or already exist');

    // Read migration file
    const migrationPath = path.join(__dirname, '../src/config/migrations/001_add_file_columns.sql');
    const migration = await fs.readFile(migrationPath, 'utf8');

    // Run migration
    await connection.query(migration);
    console.log('Migration completed successfully');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration(); 