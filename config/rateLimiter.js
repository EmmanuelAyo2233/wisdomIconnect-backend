/**
 * Rate Limiter Middleware
 * Uses express-rate-limit for robust, production-safe rate limiting.
 * Replaces the previous in-memory Map() implementation which reset on server restart.
 */

const rateLimit = require("express-rate-limit");

/**
 * Auth routes — login, register, forgot-password, reset-password
 * 5 attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Too many login/auth requests from this IP. Please try again after 15 minutes.",
  },
  handler: (req, res, next, options) => {
    console.warn(`🛑 [RATE LIMIT EXCEEDED] IP: ${req.ip} on auth route ${req.path}`);
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Payment routes — verify, withdraw, refund
 * 10 attempts per 15 minutes per IP
 */
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Too many payment requests from this IP. Please try again after 15 minutes.",
  },
  handler: (req, res, next, options) => {
    console.warn(`🛑 [RATE LIMIT EXCEEDED] IP: ${req.ip} on payment route ${req.path}`);
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * KYC submission — 3 attempts per hour per IP
 */
const kycLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Too many KYC submission attempts. Please try again after 1 hour.",
  },
  handler: (req, res, next, options) => {
    console.warn(`🛑 [RATE LIMIT EXCEEDED] IP: ${req.ip} on KYC route ${req.path}`);
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * General API limiter — 100 requests per 10 minutes per IP
 * Can be applied globally or to sensitive data endpoints
 */
const generalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Too many requests from this IP. Please slow down.",
  },
});

module.exports = { authLimiter, paymentLimiter, kycLimiter, generalLimiter };
