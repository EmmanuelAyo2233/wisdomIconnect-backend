"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const Notification = sequelize.define("notification", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  mentorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  message: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM("booking", "message", "update"),
    defaultValue: "booking",
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },


    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
});

module.exports = Notification;
