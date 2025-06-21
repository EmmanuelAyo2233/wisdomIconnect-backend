const { DataTypes } = require("../config/reuseablePackages");
const sequelize = require("../config/db");
const ChatMessage = sequelize.define(
    "chatmessage",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        chatAccessId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "chataccess",
                key: "id",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
        },
        senderId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user", // <-- reference user table
                key: "id", // <-- reference id column
            },
            onDelete: "CASCADE", // if user deleted, delete related messages
            onUpdate: "CASCADE",
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    },
    {
        freezeTableName: true,
        modelName: "chatmessage",
        tableName: "chatmessage",
        timestamps: true,
    }
);

module.exports = ChatMessage;
