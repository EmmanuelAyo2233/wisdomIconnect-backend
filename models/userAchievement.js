"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const UserAchievement = sequelize.define(
    "user_achievement",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        role: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        achievement_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        earned_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    },
    {
        freezeTableName: true,
        tableName: "user_achievements",
        timestamps: true,
    }
);

module.exports = UserAchievement;
