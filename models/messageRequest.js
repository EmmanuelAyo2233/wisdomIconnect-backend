"use strict";
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const MessageRequest = sequelize.define(
    "message_request",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        mentee_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "mentee",
                key: "id",
            },
            onDelete: "CASCADE",
        },
        mentor_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "mentor",
                key: "id",
            },
            onDelete: "CASCADE",
        },
        status: {
            type: DataTypes.ENUM("pending", "accepted", "rejected"),
            allowNull: false,
            defaultValue: "pending",
        },
        initial_message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        tableName: "message_requests",
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ["mentee_id", "mentor_id"],
            },
        ],
    }
);

module.exports = MessageRequest;
