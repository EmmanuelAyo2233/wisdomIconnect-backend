const express = require('express');
const router = express.Router();
const { requestRefund, getAllRefunds, updateRefundStatus } = require('../controllers/refundController');
const { authentication, restrictTo } = require('../controllers/authcontrollers');

router.use(authentication);

router.post('/request', requestRefund);

router.use(restrictTo('admin'));
router.get('/admin', getAllRefunds);
router.patch('/admin/:id', updateRefundStatus);

module.exports = router;
