"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const Mentor = sequelize.define(
    "mentor",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        bio: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        experienceDescription: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user",
                key: "id",
            },
        },
        role: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        gender: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        education: {
            type: DataTypes.JSON,
        },
        experience: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        available: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
        },
        slotBooked: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        discipline: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        expertise: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        fluentIn: {
            type: DataTypes.JSON,
            allowNull: true,
        },
    },
    {
        freezeTableName: true,
        modelName: "mentor",
        timestamps: true,
    }
);

module.exports = Mentor;
