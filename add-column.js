const sequelize = require('./config/db');

async function run() {
    try {
        await sequelize.query("ALTER TABLE appointment ADD COLUMN meetingId VARCHAR(255);");
        console.log("Column meetingId added to appointment table.");
    } catch (e) {
        console.error("Error altering table:", e.message);
    }
    process.exit();
}
run();
