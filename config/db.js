const { Sequelize } = require("sequelize");
require("dotenv").config();

if (process.env.NODE_ENV === 'test' && !process.env.TEST_DATABASE_STORAGE) {
  throw new Error('Tests require an explicit isolated TEST_DATABASE_STORAGE');
}

const sequelize = process.env.NODE_ENV === 'test' ? new Sequelize({ dialect: 'sqlite', storage: process.env.TEST_DATABASE_STORAGE, logging: false }) : new Sequelize(
  process.env.DB_NAME || "wisdomconnect_test",
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    dialect: "mysql",
    dialectOptions: {
      ssl: {
        rejectUnauthorized: true, // some cloud DBs require this
      },
      connectTimeout: 60000, // Increase connection timeout to 60s
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 60000,
      idle: 10000
    },
    logging: false, // optional
  }
);

module.exports = sequelize;
