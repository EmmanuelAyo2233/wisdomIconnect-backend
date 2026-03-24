const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../config/reuseablePackages");
const { Connection, ChatMessage, Mentor, Mentee, User } = require("../models");
const { Op } = require("sequelize"); 
const socketIo = require("socket.io");

// ===============================
// 🔌 SOCKET.IO CHAT SETUP
// ===============================
const activeUsers = new Map(); // Global tracking Map

function setupWebsocket(io) {
  const chatNamespace = io.of("/chat");

  // 🔐 SOCKET AUTH
  chatNamespace.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided ❌"));

    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      socket.user = decoded; // { id, userType }
      next();
    } catch (err) {
      next(new Error("Invalid token ❌"));
    }
  });

  chatNamespace.on("connection", (socket) => {
    const userId = socket.user.id;
    activeUsers.set(userId, socket.id);

    // Broadcast active status
    chatNamespace.emit("user_status", { userId, status: "online" });

    // Send the current list of online users to the newly connected user
    socket.emit("initial_user_status", Array.from(activeUsers.keys()));

    // 🤝 JOIN CONVERSATION
    socket.on("join", async ({ connectionId }) => {
      try {
        const userId = socket.user.id;
        socket.join(`conn-${connectionId}`);

        // Mark all messages as read
        await ChatMessage.update(
          { isRead: true },
          { 
            where: { 
              chatAccessId: connectionId, 
              isRead: false,
              senderId: { [Op.ne]: userId }
            } 
          }
        );

        // Notify other user that messages are seen
        chatNamespace.to(`conn-${connectionId}`).emit("messages_seen", { connectionId, seenBy: userId });

        socket.emit("joined", { message: "Joined chat successfully ✅", connectionId });
      } catch (error) {
        console.error("❌ Chat join error:", error);
        socket.emit("error", { message: "Failed to join chat ❌" });
      }
    });

    // 💬 SEND MESSAGE EVENT
    socket.on("send-message", async (msgData) => {
      try {
        const { connectionId } = msgData;
        if (!connectionId) return socket.emit("error", { message: "Missing connection ID" });

        // Broadcast the message to the room
        chatNamespace.to(`conn-${connectionId}`).emit("receive_message", msgData);
      } catch (err) {
        console.error('Send message error:', err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("disconnect", () => {
      activeUsers.delete(userId);
      chatNamespace.emit("user_status", { userId, status: "offline" });
    });
  });
}

// ===============================
// 📄 GET ALL MESSAGES
// ===============================
const getChatMessages = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;
    const userType = req.user.userType || req.user.role;

    const connection = await Connection.findOne({
      where: { id: connectionId, status: "accepted" }
    });

    if (!connection) {
      return res.status(403).json({ status: "fail", message: "Connection not accepted ❌" });
    }

    // Determine relevant deletedAt filter
    let deletedAt = null;
    if (userType === 'mentor') {
      const mentor = await Mentor.findOne({ where: { user_id: userId } });
      if (mentor && mentor.id === connection.mentorId) deletedAt = connection.deletedAtMentor;
    } else {
      const mentee = await Mentee.findOne({ where: { user_id: userId } });
      if (mentee && mentee.id === connection.menteeId) deletedAt = connection.deletedAtMentee;
    }

    const whereClause = { chatAccessId: connectionId };
    if (deletedAt) {
      whereClause.createdAt = { [Op.gt]: deletedAt };
    }

    const messages = await ChatMessage.findAll({
      where: whereClause,
      order: [["createdAt", "ASC"]],
    });

    const activeMessages = messages.filter(msg => msg.deletedForSenderId !== userId);

    res.status(200).json({ status: "success", data: activeMessages });
  } catch (error) {
    console.error("❌ getChatMessages error:", error);
    res.status(500).json({ status: "error", message: "Internal server error ❌" });
  }
};

const sendChatMessage = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    if (!message || message.trim() === "") {
      return res.status(400).json({ status: "fail", message: "Message cannot be empty" });
    }

    const connection = await Connection.findOne({
      where: { id: connectionId, status: "accepted" }
    });

    if (!connection) {
      return res.status(403).json({ status: "fail", message: "Connection is not accepted or not found ❌" });
    }

    const newMessage = await ChatMessage.create({
      chatAccessId: connection.id,
      senderId: userId,
      message,
    });

    res.status(201).json({ status: "success", data: newMessage });
  } catch (error) {
    console.error("❌ sendChatMessage error:", error);
    res.status(500).json({ status: "error", message: "Internal server error ❌" });
  }
};

const deleteChatMessage = async (req, res) => {
  try {
    const { connectionId, messageId } = req.params;
    const { type } = req.query; // 'everyone' or 'me'
    const userId = req.user.id; // Sender

    const message = await ChatMessage.findOne({
      where: { id: messageId, chatAccessId: connectionId }
    });

    if (!message) {
      return res.status(404).json({ status: "fail", message: "Message not found ❌" });
    }

    if (type === 'everyone') {
      if (message.senderId !== userId) {
        return res.status(403).json({ status: "fail", message: "Cannot delete others' messages for everyone" });
      }
      await message.update({ isDeleted: true, message: "This message was deleted", fileUrl: null });
    } else {
      // Delete just for me
      if (message.senderId === userId) {
        await message.update({ deletedForSenderId: userId });
      } else {
        // If the receiver deletes it! Assuming it's the receiver, just set it as deleted for them.
        // Wait, receiver wouldn't trigger `senderId === userId`. We can store `deletedForReceiverId`.
        // For now, I'll just map the deletedForSenderId as the general `hiddenForUserId` effectively.
        // If sender triggers it => sets deletedForSenderId=userId. If receiver triggers it, wait, we don't have deletedForReceiverId!
        // Let's do a fast raw SQL update if needed, or just set deletedForSenderId to their ID arbitrarily since it's just tracking who hid it.
        await message.update({ deletedForSenderId: userId });
      }
    }

    res.status(200).json({ status: "success", data: message });
  } catch (error) {
    console.error("❌ deleteChatMessage error:", error);
    res.status(500).json({ status: "error", message: "Internal server error ❌" });
  }
};

const uploadChatFile = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ status: "fail", message: "No file uploaded ❌" });
    }

    const { filename, mimetype } = req.file;
    const fileUrl = `${process.env.API_URL || "http://localhost:5000"}/uploads/${filename}`;

    const connection = await Connection.findOne({
      where: { id: connectionId, status: "accepted" }
    });

    if (!connection) {
      return res.status(403).json({ status: "fail", message: "Connection not accepted ❌" });
    }

    const newMessage = await ChatMessage.create({
      chatAccessId: connection.id,
      senderId: userId,
      message: req.body.message || null,
      fileUrl,
      fileType: mimetype,
      fileName: filename,
    });

    res.status(201).json({ status: "success", data: newMessage });
  } catch (error) {
    console.error("❌ uploadChatFile error:", error);
    res.status(500).json({ status: "error", message: "Failed to upload file ❌" });
  }
};

const deleteConversation = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;
    const userType = req.user.userType || req.user.role;

    const connection = await Connection.findOne({ where: { id: connectionId } });
    if (!connection) return res.status(404).json({ message: "Connection not found" });

    if (userType === 'mentor') {
      const mentor = await Mentor.findOne({ where: { user_id: userId } });
      if (mentor && mentor.id === connection.mentorId) {
        await connection.update({ deletedAtMentor: new Date() });
      }
    } else {
      const mentee = await Mentee.findOne({ where: { user_id: userId } });
      if (mentee && mentee.id === connection.menteeId) {
        await connection.update({ deletedAtMentee: new Date() });
      }
    }

    res.status(200).json({ status: "success", message: "Conversation cleared for you ✅" });
  } catch (err) {
    console.error("Delete conversation error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  setupWebsocket,
  getChatMessages,
  sendChatMessage,
  deleteChatMessage,
  uploadChatFile,
  deleteConversation,
};
