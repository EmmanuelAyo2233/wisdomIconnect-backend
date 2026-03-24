require('dotenv').config();
const db = require('./config/db');

async function updateChatTable() {
  try {
    await db.authenticate();
    console.log("Database connected.");
    
    // Add file sharing columns
    try { await db.query("ALTER TABLE chatmessage ADD COLUMN fileUrl VARCHAR(500) DEFAULT NULL;"); } catch(e) { console.log(e.message); }
    try { await db.query("ALTER TABLE chatmessage ADD COLUMN fileType VARCHAR(50) DEFAULT NULL;"); } catch(e) { console.log(e.message); }
    try { await db.query("ALTER TABLE chatmessage ADD COLUMN fileName VARCHAR(255) DEFAULT NULL;"); } catch(e) { console.log(e.message); }
    
    // Add status & deletion
    try { await db.query("ALTER TABLE chatmessage ADD COLUMN isRead BOOLEAN DEFAULT false;"); } catch(e) { console.log(e.message); }
    try { await db.query("ALTER TABLE chatmessage ADD COLUMN isDeleted BOOLEAN DEFAULT false;"); } catch(e) { console.log(e.message); }
    try { await db.query("ALTER TABLE chatmessage MODIFY message TEXT;"); } catch(e) { console.log(e.message); }
    
    console.log("✅ Chat table successfully updated!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating chat table:", err);
    process.exit(1);
  }
}

updateChatTable();
