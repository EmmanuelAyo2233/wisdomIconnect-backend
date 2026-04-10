"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const PlaybookComment = sequelize.define(
    "playbookComment",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        playbook_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "playbooks", 
                key: "id", 
            },
            onDelete: "CASCADE", 
            onUpdate: "CASCADE",
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user", 
                key: "id", 
            },
            onDelete: "CASCADE", 
            onUpdate: "CASCADE",
        },
        parent_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "playbook_comment", 
                key: "id", 
            },
            onDelete: "CASCADE", 
            onUpdate: "CASCADE",
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
    },
    {
        freezeTableName: true,
        modelName: "playbookComment",
        tableName: "playbook_comment",
        timestamps: true,
    }
);

module.exports = PlaybookComment;
