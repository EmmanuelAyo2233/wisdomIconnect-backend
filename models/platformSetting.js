"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const PlatformSetting = sequelize.define("platformSetting", {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.JSON, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: true },
}, {
  freezeTableName: true,
  tableName: "platform_setting",
  timestamps: true,
});

module.exports = PlatformSetting;
