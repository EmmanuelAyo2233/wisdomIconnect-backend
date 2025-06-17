"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const Mentee = sequelize.define(
    "mentee",
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
        gender: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        role: {
            type: DataTypes.STRING,
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
        interest: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        startDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        endDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        phone: {
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
        modelName: "mentee",
        timestamps: true,
    }
);

module.exports = Mentee;
