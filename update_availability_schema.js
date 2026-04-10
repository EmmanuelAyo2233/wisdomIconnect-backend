const sequelize = require('./config/db');
async function updateDB() {
    try { await sequelize.query("ALTER TABLE availability ADD COLUMN session_type VARCHAR(20) DEFAULT 'fixed'"); console.log('Added session_type'); } catch(e) { console.log(e.message); }
    try { await sequelize.query("ALTER TABLE availability ADD COLUMN session_title VARCHAR(255)"); console.log('Added session_title'); } catch(e) { console.log(e.message); }
    try { await sequelize.query("ALTER TABLE availability ADD COLUMN topic_name VARCHAR(255)"); console.log('Added topic_name'); } catch(e) { console.log(e.message); }
    process.exit(0);
}
updateDB();
