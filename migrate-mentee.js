const db = require('./config/db');

async function migrate() {
    try {
        await db.authenticate();
        console.log("Connected to database...");
        await db.query('ALTER TABLE mentee ADD COLUMN education JSON;');
        console.log("Migration successful: added education column to mentee table");
    } catch (err) {
        if (err.message && err.message.includes("Duplicate column name")) {
             console.log("Column already exists, ignoring...");
        } else {
             console.error("Migration error:", err);
        }
    } finally {
        process.exit();
    }
}

migrate();
