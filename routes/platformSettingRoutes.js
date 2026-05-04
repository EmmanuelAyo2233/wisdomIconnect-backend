const express = require('express');
const router = express.Router();
const { getSettings, updateSetting } = require('../controllers/platformSettingController');
const { authentication, restrictTo } = require('../controllers/authcontrollers');

router.use(authentication);

router.use(restrictTo('admin'));
router.get('/admin', getSettings);
router.put('/admin/:key', updateSetting);

module.exports = router;
