"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const RefundRequest = sequelize.define("refundRequest", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  paymentId: { type: DataTypes.INTEGER, allowNull: false },
  appointmentId: { type: DataTypes.INTEGER, allowNull: true },
  mentorId: { type: DataTypes.INTEGER, allowNull: true },
  reasonType: {
    type: DataTypes.ENUM("no_show", "technical", "cancelled", "misconduct", "duration", "other"),
    defaultValue: "other",
  },
  reason: { type: DataTypes.TEXT, allowNull: false },
  evidenceUrl: { type: DataTypes.STRING, allowNull: true },
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
