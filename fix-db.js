const { sequelize, Mentor } = require("./models");

(async () => {
    try {
        console.log("Adding column certificateUrl...");
        await sequelize.query("ALTER TABLE mentors ADD COLUMN certificateUrl VARCHAR(255);");
        console.log("Added successfully to mentors");
    } catch(e) {
        console.log("Error lower:", e.message);
        try {
            await sequelize.query("ALTER TABLE Mentors ADD COLUMN certificateUrl VARCHAR(255);");
            console.log("Added successfully to Mentors");
        } catch(e2) {
            console.log("Error upper:", e2.message);
        }
    }
    process.exit(0);
})();
