"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const Wishlist = sequelize.define("wishlist", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  menteeId: { type: DataTypes.INTEGER, allowNull: false },
  mentorId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  freezeTableName: true,
  tableName: "wishlist",
  timestamps: true,
  indexes: [{ unique: true, fields: ['menteeId', 'mentorId'] }]
});

module.exports = Wishlist;
