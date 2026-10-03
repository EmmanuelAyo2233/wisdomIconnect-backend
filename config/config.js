require("dotenv").config({ path: `${process.cwd()}/.env` });
const { DB_HOST, DB_PASSWORD, DB_USERNAME, DB_PORT, DB_NAME, DB_NAME_DEV, DB_NAME_TEST } = require("./reuseablePackages");

const configuration = (database) => ({
    username: DB_USERNAME,
    password: DB_PASSWORD,
    database,
    host: DB_HOST,
    port: Number(DB_PORT || 3306),
    dialect: "mysql",
    dialectOptions: { ssl: { rejectUnauthorized: true } },
});

const isolatedConfiguration = (database, environment, variable) => {
    if (!database || database === DB_NAME) {
        throw new Error(`${environment} migrations require ${variable} distinct from DB_NAME; refusing the main database`);
    }
    return configuration(database);
};

module.exports = {
    get development() {
        return isolatedConfiguration(DB_NAME_DEV, "Development", "DB_NAME_DEV");
    },
    get test() {
        return isolatedConfiguration(DB_NAME_TEST, "Test", "DB_NAME_TEST");
    },
    production: configuration(DB_NAME),
};
