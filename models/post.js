"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const Post = sequelize.define(
    "post",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
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
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.DATE,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: null,
        },
    },
    {
        freezeTableName: true,
        modelName: "post",
        tableName: "post",
        timestamps: true,
    }
);

module.exports = Post;
