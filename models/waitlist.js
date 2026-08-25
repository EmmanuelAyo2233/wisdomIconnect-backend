"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const Waitlist = sequelize.define(
    "waitlist",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        full_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
        },
        role: {
            type: DataTypes.ENUM("mentor", "mentee"),
            allowNull: false,
        },
        interests: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: [],
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM("pending", "invited", "joined"),
            allowNull: false,
            defaultValue: "pending",
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
        modelName: "waitlist",
        tableName: "waitlist",
        timestamps: true,
    }
);

module.exports = Waitlist;
