const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME || "wisdomconnect_test",
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    dialect: "mysql",
    dialectOptions: {
      ssl: {
        rejectUnauthorized: true, // some cloud DBs require this
      },
    },
    logging: false, // optional
  }
);

sequelize
  .authenticate()
  .then(() => console.log("Database connected successfully"))
  .catch((err) => console.error("Database connection error:", err));

module.exports = sequelize;
