const { Sequelize } = require("sequelize");
const env = process.env.NODE_ENV || "test";
const config = require("./config");

// Initialize Sequelize with environment-specific configuration
const sequelize = new Sequelize(config[env]);

module.exports = sequelize;
