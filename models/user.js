"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const User = sequelize.define(
    "user",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        userType: {
            type: DataTypes.ENUM("mentor", "mentee"),
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM("pending", "approved", "rejected"),
            allowNull: false,
            defaultValue: "pending", // New mentors start as pending
        },
       picture: {
        type: DataTypes.STRING,
        allowNull: true,
        },

        approvedAt: {
  type: DataTypes.DATE,
  allowNull: true, // null until approved
}
            ,
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
        modelName: "user",
        tableName: "user",
        timestamps: true,
    }
);

module.exports = User;
