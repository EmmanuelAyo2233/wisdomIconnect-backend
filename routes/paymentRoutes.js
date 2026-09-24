const express = require('express');
const router = express.Router();
const { authentication } = require("../controllers/authcontrollers");
const paymentController = require('../controllers/paymentController');

// ✅ Rate limiter for payment endpoints
const { paymentLimiter } = require("../config/rateLimiter");

// ✅ Input sanitization
const { sanitizeMiddleware } = require("../middlewares/sanitize");

// ─── Paystack Webhook ─────────────────────────────────────────────────────────
// IMPORTANT: Must use express.raw() body parser to preserve raw body for HMAC
// signature verification. Registered without authentication middleware.
router.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    paymentController.paystackWebhook
);

// ─── Payment Verification ─────────────────────────────────────────────────────
router.post('/verify', authentication, paymentLimiter, paymentController.verifyPayment);
router.post('/sessions/confirm', authentication, paymentLimiter, paymentController.confirmSession);
router.post('/refund/request', authentication, paymentLimiter, paymentController.requestRefund);

// ─── Withdrawal ───────────────────────────────────────────────────────────────
router.post(
    '/wallet/withdraw',
    authentication,
    paymentLimiter,
    sanitizeMiddleware(["bankName", "accountName", "accountNumber"]),
    paymentController.withdrawFunds
);

// ─── Read Routes ──────────────────────────────────────────────────────────────
router.get('/wallet', authentication, paymentController.getWallet);
router.get('/wallet/admin', authentication, paymentController.getAdminWallet);
router.get('/transactions', authentication, paymentController.getTransactions);
router.post('/wallet/withdraw/:withdrawalId/approve', authentication, paymentController.approveWithdrawal);
router.post('/wallet/withdraw/:withdrawalId/reject', authentication, paymentController.rejectWithdrawal);

module.exports = router;
