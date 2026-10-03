const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');
module.exports = sequelize.define('payment_intent', {
  reference: { type: DataTypes.STRING(100), primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'user', key: 'id' } },
  appointmentId: { type: DataTypes.INTEGER, allowNull: false, unique: true, references: { model: 'appointment', key: 'id' } },
  amountMinor: { type: DataTypes.BIGINT, allowNull: false },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NGN' },
  commissionRate: { type: DataTypes.DECIMAL(5,2), allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'initialized' },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'payment_intent', freezeTableName: true });
