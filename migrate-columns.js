const sequelize = require("./config/db");

async function run() {
    try {
        await sequelize.authenticate();
        console.log("Connected.");
        
        try {
            await sequelize.query("ALTER TABLE mentor ADD COLUMN industries JSON;");
            console.log("Added industries to mentor");
        } catch (e) { console.log(e.message); }
        
        try {
            await sequelize.query("ALTER TABLE mentee ADD COLUMN discipline JSON;");
            console.log("Added discipline to mentee");
        } catch (e) { console.log(e.message); }
        
        // Also ensure mentor discipline is JSON instead of String? Oh it was JSON already based on the comment.
    } catch(e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
