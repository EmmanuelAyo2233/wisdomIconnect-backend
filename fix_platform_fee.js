const sequelize = require('./config/db');

async function fix() {
  try {
    await sequelize.query('ALTER TABLE payment MODIFY COLUMN platformFee FLOAT DEFAULT 0.0;');
    console.log('Fixed platformFee by giving it a default.');
  } catch (e) {
    if (e.message.includes("doesn't exist") || e.message.includes("Unknown column")) {
       console.log('platformFee column not found or already fixed.');
    } else {
       console.log('Could not alter platformFee: ', e.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE payment DROP COLUMN platformFee;');
    console.log('Alternatively, dropped platformFee since we use platform_share.');
  } catch (e) {
    console.log('Could not drop platformFee: ', e.message);
  }
  process.exit();
}
fix();
