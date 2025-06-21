"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

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
        time: {
            type: DataTypes.TIME,
            allowNull: false,
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: "pending", // e.g. booked, cancelled, completed
        },
        session: {
            type: DataTypes.STRING, // e.g., 'successful', 'cancelled'
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
        modelName: "appointment",
        tableName: "appointment",
        timestamps: true,
    }
);

module.exports = Appointment;
