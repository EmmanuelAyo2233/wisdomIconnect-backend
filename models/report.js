"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const Report = sequelize.define("report", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  reporterId: { type: DataTypes.INTEGER, allowNull: false },
  reportedUserId: { type: DataTypes.INTEGER, allowNull: false },
  reason: {
    type: DataTypes.ENUM('Spam', 'Inappropriate Behavior', 'Fake Profile', 'Harassment', 'Other'),
    allowNull: false
  },
  details: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'reviewed', 'resolved'),
    defaultValue: 'pending'
  }
}, {
  freezeTableName: true,
  tableName: "report",
  timestamps: true,
});

module.exports = Report;
