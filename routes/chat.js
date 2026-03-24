const express = require("express");
const { authentication } = require("../controllers/authcontrollers");
const { getChatMessages, sendChatMessage, deleteChatMessage, uploadChatFile, deleteConversation } = require("../controllers/chatcontroller");
const multer = require("multer");
const path = require("path");

// Configure local native multer storage instantly
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const router = express.Router();

// 🔐 Get all chat messages for a specific connection
router.get("/:connectionId/messages", authentication, getChatMessages);
router.post("/:connectionId/messages", authentication, sendChatMessage);
router.delete("/:connectionId/messages/:messageId", authentication, deleteChatMessage);

// 📁 Upload a file/image into a chat connection
router.post("/:connectionId/upload", authentication, upload.single("file"), uploadChatFile);

// 🗑️ Delete entire conversation history for a user
router.delete("/:connectionId/clear", authentication, deleteConversation);

module.exports = router;