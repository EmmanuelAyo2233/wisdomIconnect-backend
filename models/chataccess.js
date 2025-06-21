const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

const ChatAccess = sequelize.define(
    "chataccess",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        accessCode: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        mentorId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "mentor", // ✅ should match table name in DB
                key: "id",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
        },
        menteeId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "mentee", // ✅ should match table name in DB
                key: "id",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
        },
        bookingId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "appointment", // ✅ DataTypes pluralizes table names by default
                key: "id",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
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
        modelName: "chataccess",
        tableName: "chataccess",
        timestamps: true,
    }
);

module.exports = ChatAccess;
