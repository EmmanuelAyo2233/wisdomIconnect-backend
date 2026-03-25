const { sequelize, Playbook } = require("./models");

(async () => {
    try {
        console.log("Synchronizing Playbook model to database...");
        await Playbook.sync({ alter: true });
        console.log("Playbooks table created/updated successfully.");
    } catch (e) {
        console.error("Error creating playbooks table:", e.message);
    }
    process.exit(0);
})();
