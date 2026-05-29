const { db } = require("./models");

async function fixColumns() {
  try {
    console.log("⏳ Adding missing columns to database...");
    
    // Add columns to review table
    try {
      await db.sequelize.query("ALTER TABLE `review` ADD COLUMN `isFlagged` TINYINT(1) DEFAULT 0;");
      console.log("✅ Column `isFlagged` added to `review` table");
    } catch (e) {
      console.log("ℹ️ review.isFlagged column might already exist:", e.message);
    }

    try {
      await db.sequelize.query("ALTER TABLE `review` ADD COLUMN `isHidden` TINYINT(1) DEFAULT 0;");
      console.log("✅ Column `isHidden` added to `review` table");
    } catch (e) {
      console.log("ℹ️ review.isHidden column might already exist:", e.message);
    }

    // Add columns to mentor_commendation table
    try {
      await db.sequelize.query("ALTER TABLE `mentor_commendation` ADD COLUMN `isFlagged` TINYINT(1) DEFAULT 0;");
      console.log("✅ Column `isFlagged` added to `mentor_commendation` table");
    } catch (e) {
      console.log("ℹ️ mentor_commendation.isFlagged column might already exist:", e.message);
    }

    try {
      await db.sequelize.query("ALTER TABLE `mentor_commendation` ADD COLUMN `isHidden` TINYINT(1) DEFAULT 0;");
      console.log("✅ Column `isHidden` added to `mentor_commendation` table");
    } catch (e) {
      console.log("ℹ️ mentor_commendation.isHidden column might already exist:", e.message);
    }

    console.log("🎉 Database fix complete!");
  } catch (error) {
    console.error("❌ Fix columns failed:", error);
  } finally {
    process.exit(0);
  }
}

fixColumns();
