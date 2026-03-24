require("dotenv").config();
const { db } = require("./models");

async function fix() {
  try {
    await db.sequelize.query("ALTER TABLE chatmessage ADD COLUMN fileUrl VARCHAR(500) DEFAULT NULL;");
    console.log("fileUrl added");
  } catch(e) { console.error("fileUrl:", e.message) }
  
  try {
    await db.sequelize.query("ALTER TABLE chatmessage ADD COLUMN fileType VARCHAR(50) DEFAULT NULL;");
    console.log("fileType added");
  } catch(e) { console.error("fileType:", e.message) }

  try {
    await db.sequelize.query("ALTER TABLE chatmessage ADD COLUMN fileName VARCHAR(255) DEFAULT NULL;");
    console.log("fileName added");
  } catch(e) { console.error("fileName:", e.message) }

  try {
    await db.sequelize.query("ALTER TABLE chatmessage ADD COLUMN isRead BOOLEAN DEFAULT false;");
    console.log("isRead added");
  } catch(e) { console.error("isRead:", e.message) }

  try {
    await db.sequelize.query("ALTER TABLE chatmessage ADD COLUMN isDeleted BOOLEAN DEFAULT false;");
    console.log("isDeleted added");
  } catch(e) { console.error("isDeleted:", e.message) }

  try {
    await db.sequelize.query("ALTER TABLE chatmessage ADD COLUMN deletedForSenderId INT DEFAULT NULL;");
    console.log("deletedForSenderId added");
  } catch(e) { console.error("deletedForSenderId:", e.message) }

  console.log("Done");
  process.exit(0);
}
fix();
