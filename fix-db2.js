const { db, Mentor } = require("./models");
const sequelize = db.sequelize;

(async () => {
    try {
        console.log("Adding column certificateUrl...");
        // Fallback or explicit
        await sequelize.query("ALTER TABLE mentor ADD COLUMN certificateUrl VARCHAR(255);");
        console.log("Added successfully to mentor");
    } catch(e) {
        console.log("Error lower:", e.message);
        try {
            await sequelize.query("ALTER TABLE Mentor ADD COLUMN certificateUrl VARCHAR(255);");
            console.log("Added successfully to Mentor");
        } catch(e2) {
            console.log("Error upper:", e2.message);
        }
    }
    process.exit(0);
})();
