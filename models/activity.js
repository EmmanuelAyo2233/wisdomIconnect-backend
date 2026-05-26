"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const Activity = sequelize.define("activity", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  type: { 
    type: DataTypes.ENUM("BOOKING", "PAYMENT", "SESSION", "USER", "SYSTEM"), 
    allowNull: false 
  },
  message: { type: DataTypes.TEXT, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  targetId: { type: DataTypes.STRING, allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
  status: { 
    type: DataTypes.ENUM("success", "pending", "failed"), 
    defaultValue: "success", 
    allowNull: false 
  },
}, {
  freezeTableName: true,
  tableName: "activities",
  timestamps: true,
});

module.exports = Activity;
