const express = require("express");
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead
} = require("../controllers/notificatioController");

const { authentication, restrictTo } = require("../controllers/authcontrollers");

router.get("/", authentication, getNotifications);
router.put("/:id/read", authentication, markAsRead);
router.put("/read-all", authentication, markAllAsRead);



module.exports = router;
