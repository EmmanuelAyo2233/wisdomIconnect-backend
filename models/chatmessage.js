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
        model: "connection",
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
      allowNull: true,
    },

    fileUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    
    fileType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    deletedForSenderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    tableName: "chatmessage",
    timestamps: true, // ✅ Sequelize handles createdAt & updatedAt
  }
);

module.exports = ChatMessage;
