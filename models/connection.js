const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const Connection = sequelize.define(
    "connection",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        mentorId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "mentor",
                key: "id",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
        },
        menteeId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "mentee",
                key: "id",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
        },
        status: {
            type: DataTypes.ENUM("pending", "accepted", "rejected"),
            defaultValue: "pending",
        },
        deletedAtMentor: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        deletedAtMentee: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        freezeTableName: true,
        modelName: "connection",
        tableName: "connection",
        timestamps: true,
    }
);

module.exports = Connection;
