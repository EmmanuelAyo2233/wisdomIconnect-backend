"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");
const Mentor = require("./mentor");

const Withdrawal = sequelize.define(
    "withdrawal",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        mentorId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "mentor",
                key: "id",
            },
        },
        idempotencyKey: { type: DataTypes.STRING(150), unique: true },
        amount: {
            type: DataTypes.DECIMAL(14, 2),
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM("pending", "completed", "failed"),
            defaultValue: "pending",
        },
        bankName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        accountNumber: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        accountName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        reference: {
            unique: true,
            type: DataTypes.STRING,
            allowNull: true,
        },
    },
    {
        freezeTableName: true,
        tableName: "withdrawal",
        timestamps: true,
    }
);

Withdrawal.belongsTo(Mentor, { foreignKey: "mentorId", as: "mentor" });

module.exports = Withdrawal;
