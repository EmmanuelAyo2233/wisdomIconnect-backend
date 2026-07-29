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
const TEST_DATABASE = process.env.TEST_DATABASE;
const DB_USERNAME = process.env.DB_USERNAME;
const DB_NAME = process.env.DB_NAME;
const DB_NAME_TEST = process.env.DB_NAME_TEST;
const DB_NAME_DEV = process.env.DB_NAME_DEV;
const DB_PORT = process.env.DB_PORT;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST = process.env.DB_HOST;
const SECRET_KEY = process.env.SECRET_KEY || "wisdomconnectsecretkey";

// Frontend environment variables
const FRONTEND_URL = process.env.FRONTEND_URL;

// Backend URL for production image uploads
const BACKEND_URL = process.env.BACKEND_URL;

// API base URL
const API_URL = "/api/v1";
// Cloudinary environment variables
const CLOUDINARY_NAME = process.env.CLOUDINARY_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_SECRET_KEY;
const CLOUDINARY_FOLDER_NAME = process.env.CLOUDINARY_FOLDER_NAME;
const CLOUDINARY_URL = `cloudinary://${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}@dwrtusn1v`;

// Brevo / SMTP Email
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SMTP_SERVER = process.env.SMTP_SERVER || process.env.SMTP_SEVER;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

// Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// bcrypt salt rounds
const salt = 8;

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
    BACKEND_URL,
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
    SMTP_SERVER,
    SMTP_PORT,
    SMTP_EMAIL,
    SMTP_PASSWORD,
    nodemailer,
    cloudinary,
    streamFier,
};
