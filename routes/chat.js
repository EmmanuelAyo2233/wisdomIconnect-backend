const express = require("express");
const { authentication } = require("../controllers/authcontrollers");
const { getChatMessages, sendChatMessage, deleteChatMessage, uploadChatFile, deleteConversation } = require("../controllers/chatcontroller");
const { upload } = require("../utils/cloudinary");

const router = express.Router();

// 🔐 Get all chat messages for a specific connection
router.get("/:connectionId/messages", authentication, getChatMessages);
router.post("/:connectionId/messages", authentication, sendChatMessage);
router.delete("/:connectionId/messages/:messageId", authentication, deleteChatMessage);

// 📁 Upload a file/image into a chat connection (Stream directly to Cloudinary)
router.post("/:connectionId/upload", authentication, upload.single("file"), uploadChatFile);

// 🗑️ Delete entire conversation history for a user
router.delete("/:connectionId/clear", authentication, deleteConversation);

module.exports = router;