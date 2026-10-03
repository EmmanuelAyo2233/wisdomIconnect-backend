"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");
const Appointment = require("./appointment");

const Payment = sequelize.define(
    "payment",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        reference: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
        },
        amount: {
            type: DataTypes.DECIMAL(14, 2),
            allowNull: false,
        },
        mentorShare: {
            type: DataTypes.DECIMAL(14, 2),
            allowNull: false,
            field: "mentor_share"
        },
        platformShare: {
            type: DataTypes.DECIMAL(14, 2),
            allowNull: false,
            field: "platform_share"
        },
        status: {
            type: DataTypes.ENUM("awaiting_acceptance", "pending", "completed", "released", "refunded", "disputed"),
            defaultValue: "awaiting_acceptance",
        },
        escrow_status: {
            type: DataTypes.ENUM("held", "released", "refunded", "disputed"),
            defaultValue: "held",
            field: "escrow_status"
        },
        refund_reference: {
            type: DataTypes.STRING,
            allowNull: true,
            field: "refund_reference"
        },
        refundedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "refundedAt"
        },
        refundReason: {
            type: DataTypes.STRING,
            allowNull: true,
            field: "refundReason"
        },
        providerTransactionId: {type:DataTypes.STRING(100),allowNull:true,unique:true},
        platformUserId: { type: DataTypes.INTEGER, allowNull: true },
        refundState: { type: DataTypes.STRING(30), defaultValue: "none" },
        originalUncredited: { type: DataTypes.BOOLEAN, defaultValue: false },
        appointmentId: {
            unique: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "appointment",
                key: "id",
            },
        },
    },
    {
        freezeTableName: true,
        tableName: "payment",
        timestamps: true,
    }
);

Payment.belongsTo(Appointment, { foreignKey: "appointmentId", as: "appointment" });

module.exports = Payment;
