require("dotenv").config({ path: `${process.cwd()}/.env` });

module.exports = {
    // Development environment configuration
    development: {
        username: "root",
        password: null,
        database: "database_development",
        host: "127.0.0.1",
        dialect: "mysql",
    },
    // Test environment configuration
    test: {
        dialect: "sqlite",
        storage: "./test.db",
    },
    // Production environment configuration
    production: {
        username: "root",
        password: null,
        database: "database_production",
        host: "127.0.0.1",
        dialect: "mysql",
    },
};
