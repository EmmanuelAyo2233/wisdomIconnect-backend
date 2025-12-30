"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");
const Mentor = require("./mentor");
const Mentee = require("./mentee");

const Appointment = sequelize.define(
  "appointment",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "pending", // booked, cancelled, completed
    },
    session: {
      type: DataTypes.STRING, // successful, cancelled
      allowNull: true,
    },
    accessCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mentorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "mentor",
        key: "id",
      },
    },
    menteeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "mentee",
        key: "id",
      },
    },
    topic: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    goals: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rescheduleReason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    updatedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    tableName: "appointment",
    timestamps: true,
  }
);

// ✅ Correct Associations
Appointment.belongsTo(Mentor, { foreignKey: "mentorId", as: "mentor" });
Appointment.belongsTo(Mentee, { foreignKey: "menteeId", as: "mentee" });

module.exports = Appointment;
