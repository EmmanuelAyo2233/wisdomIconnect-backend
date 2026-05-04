require("dotenv").config();
const { db } = require("./models");
const Notification = require("./models/notification");

async function syncNotifications() {
  try {
    await db.sequelize.authenticate();
    console.log("Connected to database...");

    console.log("Dropping and recreating Notification table to apply new schema...");
    await Notification.sync({ force: true });
    
    console.log("Notification table synced successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error syncing Notification table:", error);
    process.exit(1);
  }
}

syncNotifications();

syncNotifications();
