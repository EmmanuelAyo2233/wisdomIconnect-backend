"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const RefundRequest = sequelize.define("refundRequest", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  paymentId: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  status: {
    type: DataTypes.ENUM("pending", "approved", "rejected"),
    defaultValue: "pending",
  },
  adminNote: { type: DataTypes.TEXT, allowNull: true },
}, {
  freezeTableName: true,
  tableName: "refund_request",
  timestamps: true,
});

module.exports = RefundRequest;
