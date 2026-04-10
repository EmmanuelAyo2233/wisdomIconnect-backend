"use strict";
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const SavedPlaybook = sequelize.define(
    "saved_playbook",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user",
                key: "id",
            },
            onDelete: "CASCADE",
        },
        playbook_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "playbooks",
                key: "id",
            },
            onDelete: "CASCADE",
        },
    },
    {
        tableName: "saved_playbooks",
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ["user_id", "playbook_id"],
            },
        ],
    }
);

module.exports = SavedPlaybook;
