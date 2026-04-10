const sequelize = require('./config/db');

async function fix() {
  try {
    await sequelize.query("ALTER TABLE payment MODIFY COLUMN status ENUM('awaiting_acceptance', 'pending', 'completed', 'released', 'refunded', 'disputed') DEFAULT 'pending';");
    console.log('Fixed payment status enum to include awaiting_acceptance.');
  } catch (e) {
    console.log('Could not alter payment status enum: ', e.message);
  }
  process.exit();
}
fix();
