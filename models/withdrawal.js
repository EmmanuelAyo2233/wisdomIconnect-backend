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
        amount: {
            type: DataTypes.FLOAT,
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
