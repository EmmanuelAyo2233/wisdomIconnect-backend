const sequelize = require('./config/db');
const { DataTypes } = require('sequelize');

async function addColumns() {
  try {
    await sequelize.query("ALTER TABLE mentee ADD COLUMN notif_prefs JSON;");
    console.log("notif_prefs added.");
  } catch (e) {
    console.log("notif_prefs might already exist or error:", e.message);
  }
  try {
    await sequelize.query("ALTER TABLE mentee ADD COLUMN privacy_settings JSON;");
    console.log("privacy_settings added.");
  } catch (e) {
    console.log("privacy_settings might already exist or error:", e.message);
  }
}

addColumns().then(() => process.exit());
