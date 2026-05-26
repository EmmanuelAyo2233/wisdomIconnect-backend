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
    meetingId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: "meetingId",
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
    meetingLink: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "meetingLink",
    },
    mentorConfirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "mentorConfirmed",
    },
    menteeConfirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "menteeConfirmed",
    },
    callStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "callStartedAt",
    },
    callEndedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "callEndedAt",
    },
    autoCompleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "autoCompleted",
    },
    duration: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "duration",
    },
    sessionType: {
      type: DataTypes.STRING,
      defaultValue: "free",
      field: "sessionType",
    },
    mentorJoinTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "mentorJoinTime",
    },
    menteeJoinTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "menteeJoinTime",
    },
    actualStartTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "actualStartTime",
    },
    actualEndTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "actualEndTime",
    },
    endedBy: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "endedBy",
    },
    endReason: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "endReason",
    },
    completionMethod: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "completionMethod",
    },
    disputedBy: {
      type: DataTypes.STRING,
      defaultValue: "none",
      field: "disputedBy",
    },
    disputeReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "disputeReason",
    },
    refund_status: {
      type: DataTypes.ENUM("none", "pending", "refunded", "failed"),
      defaultValue: "none",
      field: "refund_status",
    },
    completion_status: {
      type: DataTypes.ENUM("pending", "completed", "disputed", "cancelled"),
      defaultValue: "pending",
      field: "completion_status",
    },
    mentor_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "mentor_reason",
    },
    mentee_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "mentee_reason",
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
