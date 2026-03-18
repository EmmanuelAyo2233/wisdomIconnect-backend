const { DataTypes } = require("../config/reuseablePackages");
const sequelize = require("../config/db");

const ChatMessage = sequelize.define(
  "chatmessage",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    chatAccessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "chataccess",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "user",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    tableName: "chatmessage",
    timestamps: true, // ✅ Sequelize handles createdAt & updatedAt
  }
);

module.exports = ChatMessage;
