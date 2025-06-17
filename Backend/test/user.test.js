// Test setup for User model tests
process.env.NODE_ENV = 'test';

const sequelize = require('../config/db');
const { User } = require('../models');