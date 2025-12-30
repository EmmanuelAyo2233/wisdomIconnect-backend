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
    mentorId: {
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    day: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    endTime: {
      type: DataTypes.TIME,
      allowNull: true,
    },
//     slotDuration: {
//   type: DataTypes.INTEGER, // in minutes
//   allowNull: true,
// },


    
    status: {
      type: DataTypes.ENUM("available", "booked"),
      defaultValue: "available",
    },
  },
  {
    freezeTableName: true,
    tableName: "availability",
    timestamps: true,
  }
);
module.exports = Availability;
