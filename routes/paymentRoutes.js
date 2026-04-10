const express = require('express');
const router = express.Router();
const { authentication } = require("../controllers/authcontrollers");
const paymentController = require('../controllers/paymentController');

router.post('/verify', authentication, paymentController.verifyPayment);
router.post('/sessions/confirm', authentication, paymentController.confirmSession);
router.post('/refund/request', authentication, paymentController.requestRefund);
router.post('/wallet/withdraw', authentication, paymentController.withdrawFunds);

router.get('/wallet', authentication, paymentController.getWallet);
router.get('/wallet/admin', authentication, paymentController.getAdminWallet);
router.get('/transactions', authentication, paymentController.getTransactions);

module.exports = router;
