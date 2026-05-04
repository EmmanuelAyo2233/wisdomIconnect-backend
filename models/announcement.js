"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const Announcement = sequelize.define("announcement", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  targetAudience: {
    type: DataTypes.ENUM("all", "mentors", "mentees"),
    defaultValue: "all",
  },
  sentViaEmail: { type: DataTypes.BOOLEAN, defaultValue: false },
  adminId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  freezeTableName: true,
  tableName: "announcement",
  timestamps: true,
});

module.exports = Announcement;
