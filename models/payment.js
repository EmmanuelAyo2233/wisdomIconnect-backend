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
        },
        amount: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        mentorShare: {
            type: DataTypes.FLOAT,
            allowNull: false,
            field: "mentor_share"
        },
        platformShare: {
            type: DataTypes.FLOAT,
            allowNull: false,
            field: "platform_share"
        },
        status: {
            type: DataTypes.ENUM("awaiting_acceptance", "pending", "completed", "released", "refunded", "disputed"),
            defaultValue: "awaiting_acceptance",
        },
        appointmentId: {
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
