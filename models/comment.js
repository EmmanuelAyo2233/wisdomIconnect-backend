"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const Comment = sequelize.define(
    "comment",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        postId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "post", // <-- reference post table
                key: "id", // <-- reference id column
            },
            onDelete: "CASCADE", // if post deleted, delete related messages
            onUpdate: "CASCADE",
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user", // <-- reference user table
                key: "id", // <-- reference id column
            },
            onDelete: "CASCADE", // if user deleted, delete related messages
            onUpdate: "CASCADE",
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: null,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: null,
        },
    },
    {
        freezeTableName: true,
        modelName: "comment",
        tableName: "comment",
        timestamps: true,
    }
);

module.exports = Comment;
