"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");
const Appointment = require("./appointment");
const Mentor = require("./mentor");
const Mentee = require("./mentee");

const Review = sequelize.define(
    "review",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 5
            }
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        appointmentId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "appointment",
                key: "id",
            },
        },
        mentorId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "mentor",
                key: "id",
            },
        },
        menteeId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "mentee",
                key: "id",
            },
        },
    },
    {
        freezeTableName: true,
        tableName: "review",
        timestamps: true,
    }
);

Review.belongsTo(Appointment, { foreignKey: "appointmentId", as: "appointment" });
Review.belongsTo(Mentor, { foreignKey: "mentorId", as: "mentor" });
Review.belongsTo(Mentee, { foreignKey: "menteeId", as: "mentee" });

module.exports = Review;
