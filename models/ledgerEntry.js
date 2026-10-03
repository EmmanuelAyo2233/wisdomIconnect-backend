const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');
module.exports = sequelize.define('ledger_entry', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  operationKey: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'user', key: 'id' } },
  availableDeltaMinor: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  pendingDeltaMinor: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  kind: { type: DataTypes.STRING(40), allowNull: false },
  reference: { type: DataTypes.STRING(100), allowNull: false },
}, { tableName: 'ledger_entry', freezeTableName: true, updatedAt: false, indexes: [{ fields: ['userId', 'createdAt'] }] });
