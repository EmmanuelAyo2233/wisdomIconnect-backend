"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");
const User = require("./user");

const Wallet = sequelize.define(
    "wallet",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        availableBalance: {
            type: DataTypes.FLOAT,
            defaultValue: 0.0,
            field: "available_balance"
        },
        pendingBalance: {
            type: DataTypes.FLOAT,
            defaultValue: 0.0,
            field: "pending_balance"
        },
        totalEarned: {
            type: DataTypes.FLOAT,
            defaultValue: 0.0,
            field: "total_earned"
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user",
                key: "id",
            },
        },
    },
    {
        freezeTableName: true,
        tableName: "wallet",
        timestamps: true,
    }
);

Wallet.belongsTo(User, { foreignKey: "userId", as: "user" });

module.exports = Wallet;
