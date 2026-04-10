const sequelize = require('./config/db');

async function fix() {
  try {
    await sequelize.query('ALTER TABLE mentor ADD COLUMN default_duration INT DEFAULT 30;');
    console.log('Added default_duration to mentor table.');
  } catch (e) {
    console.log('Error adding default_duration: ', e.message);

  }
  process.exit();
}
fix();
