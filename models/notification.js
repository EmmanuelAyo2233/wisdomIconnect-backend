"use strict";
const sequelize = require("../config/db");
const { DataTypes } = require("../config/reuseablePackages");

// const Notification = sequelize.define("notification", {
//   id: {
//     type: DataTypes.INTEGER,
//     autoIncrement: true,
//     primaryKey: true,
//   },
//   mentorId: {
//     type: DataTypes.INTEGER,
//     allowNull: false,
//   },
//   senderId: {
//     type: DataTypes.INTEGER,
//     allowNull: false,
//   },
//   message: {
//     type: DataTypes.STRING,
//     allowNull: false,
//   },
//   type: {
//     type: DataTypes.ENUM("booking", "message", "update"),
//     defaultValue: "booking",
//   },
//   isRead: {
//     type: DataTypes.BOOLEAN,
//     defaultValue: false,
//   },
//   createdAt: {
//     type: DataTypes.DATE,
//     defaultValue: DataTypes.NOW,
//   },


//     updatedAt: {
//       type: DataTypes.DATE,
//       defaultValue: DataTypes.NOW,
//     },
// });

// module.exports = Notification;



const Notification = sequelize.define("notification", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  mentorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  menteeId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  senderId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  message: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  title: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  receiverId: {
  type: DataTypes.INTEGER,
  allowNull: false,
},

link: {
  type: DataTypes.STRING,
  allowNull: true,
},

receiverType: {
  type: DataTypes.ENUM("mentor", "mentee", "admin"),
  allowNull: false,
},


  type: {
    type: DataTypes.ENUM("booking", "message", "update", "system", "message_request", "message_request_response", "payment", "auth", "general"),
    defaultValue: "booking",
  },

  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = Notification;