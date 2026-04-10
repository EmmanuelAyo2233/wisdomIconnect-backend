const sequelize = require('./config/db');
const { DataTypes } = require('sequelize');

async function migrate() {
    try {
        console.log('Starting migration for payment and escrow system...');

        // 1. Alter User table
        await sequelize.query(`ALTER TABLE user MODIFY COLUMN mentorLevel ENUM('starter', 'verified', 'premium', 'gold') DEFAULT 'starter';`);
        
        // 2. Alter Mentor table to add session_price
        try {
            await sequelize.query(`ALTER TABLE mentor ADD COLUMN session_price FLOAT DEFAULT 0.0;`);
        } catch(e) {
            console.log('session_price might already exist');
        }

        // 3. Alter Wallet table
        try {
            await sequelize.query(`ALTER TABLE wallet CHANGE balance available_balance FLOAT DEFAULT 0.0;`);
        } catch(e) { console.log('available_balance exist', e.message); }
        try {
            await sequelize.query(`ALTER TABLE wallet CHANGE pendingBalance pending_balance FLOAT DEFAULT 0.0;`);
        } catch(e) { console.log('pending_balance exist', e.message); }
        try {
            await sequelize.query(`ALTER TABLE wallet ADD COLUMN total_earned FLOAT DEFAULT 0.0;`);
        } catch(e) { console.log('total_earned exist', e.message); }

        // 4. Create or Alter Payment table
        try {
            await sequelize.query(`ALTER TABLE payment ADD COLUMN reference VARCHAR(255);`);
            await sequelize.query(`ALTER TABLE payment ADD COLUMN mentor_share FLOAT DEFAULT 0.0;`);
            await sequelize.query(`ALTER TABLE payment ADD COLUMN platform_share FLOAT DEFAULT 0.0;`);
            await sequelize.query(`ALTER TABLE payment MODIFY COLUMN status ENUM('pending', 'completed', 'released') DEFAULT 'pending';`);
        } catch(e) { console.log('payment columns error', e.message); }

        console.log('Migration complete!');
        process.exit();
    } catch(err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}
migrate();
