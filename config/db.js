const { Sequelize } = require("sequelize");
const env = process.env.NODE_ENV || "test"; // default to development if NODE_ENV is not set
const config = require("./config");

const sequelize = new Sequelize(config[env]);

module.exports = sequelize;
