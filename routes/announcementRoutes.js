const express = require('express');
const router = express.Router();
const { createAnnouncement, getAllAnnouncements, getUserAnnouncements, deleteAnnouncement } = require('../controllers/announcementController');
const { authentication, restrictTo } = require('../controllers/authcontrollers');

router.use(authentication);

router.get('/my', getUserAnnouncements);

router.use(restrictTo('admin'));
router.post('/admin', createAnnouncement);
router.get('/admin', getAllAnnouncements);
router.delete('/admin/:id', deleteAnnouncement);

module.exports = router;
