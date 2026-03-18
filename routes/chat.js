const express = require("express");
const { authentication } = require("../controllers/authcontrollers");
const { getAllChatAccesscode } = require("../controllers/chatcontroller");
const { getChatMessages } = require("../controllers/chatcontroller");

const router = express.Router();

// 🔐 Get all chat access codes for logged-in user
router.get("/", authentication, getAllChatAccesscode);
router.get("/:bookingId/messages", authentication,  getChatMessages);

module.exports = router;
 