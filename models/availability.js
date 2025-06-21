const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");
const User = require("./user");

const Availability = sequelize.define(
    "availability",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        time: {
            type: DataTypes.TIME,
            allowNull: false,
        },
        mentorId: {
            type: DataTypes.INTEGER,
            references: {
                model: User,
                key: "id",
            },
            onDelete: "CASCADE",
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        freezeTableName: true,
        modelName: "availability",
        tableName: "availability",
        timestamps: true,
    }
);

module.exports = Availability;
