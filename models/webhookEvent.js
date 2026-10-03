const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');
module.exports = sequelize.define('webhook_event', {
  key: { type: DataTypes.STRING(150), primaryKey: true },
  event: { type: DataTypes.STRING(80), allowNull: false },
  payload: { type: DataTypes.JSON, allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'webhook_event', freezeTableName: true });
