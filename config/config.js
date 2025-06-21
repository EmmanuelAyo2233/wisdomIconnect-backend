require("dotenv").config({ path: `${process.cwd()}/.env` });
const {
    DB_HOST,
    DB_PASSWORD,
    DB_USERNAME,
    DB_PORT,
    DB_NAME,
    DB_NAME_DEV,
    DB_NAME_TEST,
} = require("./reuseablePackages");

module.exports = {
    // Development environment configuration
    development: {
        username: DB_USERNAME,
        password: DB_PASSWORD,
        database: DB_NAME_DEV,
        host: DB_HOST,
        dialect: "mysql",
        dialectOptions: {
            ssl: {
                rejectUnauthorized: true,
            },
        },
    },
    // Test environment configuration
    test: {
        username: DB_USERNAME,
        password: DB_PASSWORD,
        database: DB_NAME_TEST,
        host: DB_HOST,
        dialect: "mysql",
        dialectOptions: {
            ssl: {
                rejectUnauthorized: true,
            },
        },
    },
    // Production environment configuration
    production: {
        username: DB_USERNAME,
        password: DB_PASSWORD,
        database: DB_NAME,
        host: DB_HOST,
        dialect: "mysql",
        dialectOptions: {
            ssl: {
                rejectUnauthorized: true,
            },
        },
    },
};
