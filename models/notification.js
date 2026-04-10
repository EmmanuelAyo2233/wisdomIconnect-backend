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
    allowNull: false,
  },

  message: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  receiverId: {
  type: DataTypes.INTEGER,
  allowNull: false,
},

receiverType: {
  type: DataTypes.ENUM("mentor", "mentee"),
  allowNull: false,
},


  type: {
    type: DataTypes.ENUM("booking", "message", "update", "system", "message_request", "message_request_response"),
    defaultValue: "booking",
  },

  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = Notification;