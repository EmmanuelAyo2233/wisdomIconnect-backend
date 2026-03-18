const sequelize = require('./config/db');
const { DataTypes } = require('sequelize');

async function up() {
    try {
        console.log("Adding title and price columns to availability table...");
        await sequelize.query('ALTER TABLE availability ADD COLUMN title VARCHAR(255) DEFAULT "Mentorship Session"');
        await sequelize.query('ALTER TABLE availability ADD COLUMN price DECIMAL(10, 2) DEFAULT 0.00');
        console.log("Migration successful.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

up();
