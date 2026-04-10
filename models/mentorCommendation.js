"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");
const Appointment = require("./appointment");
const Mentor = require("./mentor");
const Mentee = require("./mentee");

const MentorCommendation = sequelize.define(
    "mentor_commendation",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        commendation: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 1,
                max: 5
            }
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
        tableName: "mentor_commendation",
        timestamps: true,
    }
);

MentorCommendation.belongsTo(Appointment, { foreignKey: "appointmentId", as: "appointment" });
MentorCommendation.belongsTo(Mentor, { foreignKey: "mentorId", as: "mentor" });
MentorCommendation.belongsTo(Mentee, { foreignKey: "menteeId", as: "mentee" });

module.exports = MentorCommendation;
