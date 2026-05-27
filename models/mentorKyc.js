"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const MentorKyc = sequelize.define(
    "mentor_kyc",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        mentorId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: "mentor_id",
            references: {
                model: "mentor",
                key: "id",
            },
        },
        id_type: {
            type: DataTypes.ENUM(
                "national_id",
                "drivers_license",
                "international_passport",
                "voters_card"
            ),
            allowNull: false,
        },
        id_document_url: {
            type: DataTypes.STRING(500),
            allowNull: false,
        },
        selfie_url: {
            type: DataTypes.STRING(500),
            allowNull: false,
        },
        // Optional: live phone check
        phone_number: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM("pending", "verified", "rejected"),
            defaultValue: "pending",
        },
        admin_note: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        reviewed_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        reviewed_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        freezeTableName: true,
        modelName: "mentor_kyc",
        tableName: "mentor_kyc",
        timestamps: true,
    }
);

module.exports = MentorKyc;
