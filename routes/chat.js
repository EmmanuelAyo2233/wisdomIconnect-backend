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

router.put('/:connectionId/read',authentication,async(req,res)=>{
 try {
  const connection=await require('../services/authorizationService').connectionFor(req.user,req.params.connectionId);
  const {ChatMessage}=require('../models');const {Op}=require('sequelize');
  await ChatMessage.update({isRead:true},{where:{chatAccessId:connection.id,senderId:{[Op.ne]:req.user.id}}});
  res.json({success:true});
 } catch(error) {require('../utils/security').respondError(res,error);}
});
module.exports = router;