const express = require( "express" );
const cors = require( "cors" );
const cookieParser = require( "cookie-parser" );
const bodyParser = require( "body-parser" );
const dotenv = require( "dotenv" );
const swaggerJSDoc = require( "swagger-jsdoc" );
const swaggerUi = require( "swagger-ui-express" );
const YAML = require( "yamljs" );
const jwt = require( "jsonwebtoken" );
const bcrypt = require( "bcryptjs" );
const mysql2 = require( "mysql2" );
const { Sequelize, DataTypes, Model, Op } = require( "sequelize" );
const helmet = require( "helmet" );

// Load environment variables
dotenv.config();

const PORT = process.env.PORT;

// Database environment variables
TEST_DATABASE = process.env.TEST_DATABASE;
DB_USERNAME = process.env.DB_USERNAME;
DB_NAME = process.env.DB_NAME;
DB_PORT = process.env.DB_PORT;
DB_PASSWORD = process.env.DB_PASSWORD;
DB_HOST = process.env.DB_HOST;
SECRET_KEY = process.env.SECRET_KEY;

// API base URL
API_URL = "/api/v1";

// Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// bcrypt salt rounds
salt = 8;

// Standardized messages
const messages = {
    error: {
        registration: "Registration failed",
        login: "Login failed",
        server: "Server error",
    },
    success: {
        registration: "Registration successful",
        login: "Login successful",
    },
};

module.exports = {
    express,
    cors,
    cookieParser,
    bodyParser,
    dotenv,
    PORT,
    swaggerJSDoc,
    swaggerUi,
    YAML,
    jwt,
    bcrypt,
    mysql2,
    TEST_DATABASE,
    DB_USERNAME,
    DB_NAME,
    DB_PORT,
    DB_PASSWORD,
    DB_HOST,
    DataTypes,
    Sequelize,
    Model,
    messages,
    EMAIL_REGEX,
    salt,
    helmet,
    API_URL,
    SECRET_KEY,
    Op,
};
