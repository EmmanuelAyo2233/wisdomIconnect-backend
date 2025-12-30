require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mysql2 = require("mysql2");
const { Sequelize, DataTypes, Model, Op } = require("sequelize");
const helmet = require("helmet");
const { Server } = require("socket.io");
const http = require("http");
const moment = require("moment");
const multer = require("multer");
const SibApiV3Sdk = require("sib-api-v3-sdk");
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;
const streamFier = require("streamifier");

// Load environment variables
dotenv.config();

const PORT = process.env.PORT;

// Database environment variables
TEST_DATABASE = process.env.TEST_DATABASE;
DB_USERNAME = process.env.DB_USERNAME;
DB_NAME = process.env.DB_NAME;
DB_NAME_TEST = process.env.DB_NAME_TEST;
DB_NAME_DEV = process.env.DB_NAME_DEV;
DB_PORT = process.env.DB_PORT;
DB_PASSWORD = process.env.DB_PASSWORD;
DB_HOST = process.env.DB_HOST;
const SECRET_KEY = process.env.SECRET_KEY || "wisdomconnectsecretkey";
console.log("SECRET_KEY loaded:", SECRET_KEY); // 🔍 debug

// Frontend environment variables
FRONTEND_URL = process.env.FRONTEND_URL;

// API base URL
API_URL = "/api/v1";
// Cloudinary environment variables
CLOUDINARY_NAME = process.env.CLOUDINARY_NAME;
CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
CLOUDINARY_API_SECRET = process.env.CLOUDINARY_SECRET_KEY;
CLOUDINARY_FOLDER_NAME = process.env.CLOUDINARY_FOLDER_NAME;
CLOUDINARY_URL = `cloudinary://${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}@dwrtusn1v`;

// Brevo Email
BREVO_API_KEY = process.env.BREVO_API_KEY;
SMTP_SEVER = process.env.SMTP_SEVER;
SMTP_PORT = process.env.SMTP_PORT;
SMTP_EMAIL = process.env.SMTP_EMAIL;
SMTP_PASSWORD = process.env.SMTP_PASSWORD;

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
    DB_NAME_DEV,
    DB_NAME_TEST,
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
    http,
    Server,
    FRONTEND_URL,
    moment,
    CLOUDINARY_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_FOLDER_NAME,
    CLOUDINARY_URL,
    multer,
    SibApiV3Sdk,
    BREVO_API_KEY,
    SMTP_SEVER,
    SMTP_PORT,
    SMTP_EMAIL,
    SMTP_PASSWORD,
    nodemailer,
    cloudinary,
    streamFier,
};
