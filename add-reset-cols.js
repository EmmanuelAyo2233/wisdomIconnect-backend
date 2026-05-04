// Run this once: node add-reset-cols.js
const sequelize = require('./config/db');

(async () => {
  try {
    await sequelize.query(`
      ALTER TABLE user 
      ADD COLUMN IF NOT EXISTS passwordResetToken VARCHAR(10) NULL,
      ADD COLUMN IF NOT EXISTS passwordResetExpires DATETIME NULL;
    `);
    console.log('✅ passwordResetToken and passwordResetExpires columns added.');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit();
  }
})();
