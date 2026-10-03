const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../config/reuseablePackages");
const { Connection, ChatMessage, Mentor, Mentee, User } = require("../models");
const { Op } = require("sequelize"); 
const { connectionFor, currentUser } = require('../services/authorizationService');
const { cloudinary } = require("../utils/cloudinary");
const streamifier = require("streamifier");

// ===============================
// 🔌 SOCKET.IO CHAT SETUP
// ===============================
const activeUsers = new Map();
function setupWebsocket(io) {
  const ns = io.of('/chat');
  ns.use(async (socket, next) => {
    try {
      const decoded = jwt.verify(socket.handshake.auth?.token, SECRET_KEY, { algorithms: ['HS256'] });
      socket.user = await currentUser(decoded.id, decoded.tokenVersion);
      socket.sessionVersion = decoded.tokenVersion || 0;
      const timer = setTimeout(() => socket.disconnect(true), Math.max(0, decoded.exp * 1000 - Date.now()));
      timer.unref?.(); socket.once('disconnect', () => clearTimeout(timer)); next();
    } catch { next(new Error('Please sign in again')); }
  });
  ns.on('connection', (socket) => {
    const userId = socket.user.id;
    const sockets = activeUsers.get(userId) || new Set();
    sockets.add(socket.id); activeUsers.set(userId, sockets);
    let windowStart = Date.now(), eventCount = 0;
    socket.use(async (_packet, next) => {
      try {
        if (Date.now() - windowStart > 60000) { windowStart = Date.now(); eventCount = 0; }
        if (++eventCount > 240) throw new Error('Rate limit');
        socket.user = await currentUser(userId, socket.sessionVersion); next();
      } catch { socket.disconnect(true); }
    });
    socket.on('join', async (payload = {}) => {
      try {
        const conn = await connectionFor(socket.user, payload.connectionId);
        await socket.join(`conn-${conn.id}`);
        await ChatMessage.update({ isRead: true }, { where: { chatAccessId: conn.id, isRead: false, senderId: { [Op.ne]: userId } } });
        ns.to(`conn-${conn.id}`).emit('messages_seen', { connectionId: conn.id, seenBy: userId });
        socket.emit('joined', { connectionId: conn.id });
      } catch { socket.emit('error', { message: 'Conversation unavailable' }); }
    });
    socket.on('leave', (payload = {}) => {
      if (Number.isSafeInteger(Number(payload.connectionId))) socket.leave(`conn-${Number(payload.connectionId)}`);
    });
    socket.on('send-message', async (payload = {}) => {
      try {
        const conn = await connectionFor(socket.user, payload.connectionId);
        const message = await ChatMessage.findOne({ where: { id: payload.id, chatAccessId: conn.id, senderId: userId } });
        if (message) socket.to(`conn-${conn.id}`).emit('receive_message', { ...message.toJSON(), connectionId: conn.id });
      } catch { socket.emit('error', { message: 'Unable to deliver message' }); }
    });
    socket.on('disconnect', () => { sockets.delete(socket.id); if (!sockets.size) activeUsers.delete(userId); });
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

    const connection = await connectionFor(req.user, connectionId);

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

    const activeMessages = messages.filter(msg => msg.deletedForSenderId !== userId && msg.deletedForReceiverId !== userId);

    res.status(200).json({ status: "success", data: activeMessages });
  } catch (error) {
    require('../utils/logger').error("❌ getChatMessages error:", error);
    res.status(error.statusCode || 500).json({ status: "error", message: "Internal server error ❌" });
  }
};

const sendChatMessage = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    if (typeof message !== "string" || !message.trim() || message.length > 10000) {
      return res.status(400).json({ status: "fail", message: "Message cannot be empty" });
    }

    const connection = await connectionFor(req.user, connectionId);

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
    require('../utils/logger').error("❌ sendChatMessage error:", error);
    res.status(error.statusCode || 500).json({ status: "error", message: "Internal server error ❌" });
  }
};

const deleteChatMessage = async (req, res) => {
  try {
    const { connectionId, messageId } = req.params;
    const { type } = req.query; // 'everyone' or 'me'
    const userId = req.user.id; // Sender

    await connectionFor(req.user, connectionId);
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
        await message.update({ deletedForReceiverId: userId });
      }
    }

    res.status(200).json({ status: "success", data: message });
  } catch (error) {
    require('../utils/logger').error("❌ deleteChatMessage error:", error);
    res.status(error.statusCode || 500).json({ status: "error", message: "Internal server error ❌" });
  }
};

const uploadChatFile = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ status: "fail", message: "No file uploaded ❌" });
    }

    const { mimetype, originalname } = req.file;
    require('../utils/uploadValidation').validateFile(req.file);

    const connection = await connectionFor(req.user, connectionId);

    if (!connection) {
      return res.status(403).json({ status: "fail", message: "Connection not accepted ❌" });
    }

    // Stream upload directly to Cloudinary
    const fileUrl = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "chat_attachments", resource_type: "auto" },
        (err, result) => {
          if (err) return reject(err);
          resolve(result.secure_url);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    const newMessage = await ChatMessage.create({
      chatAccessId: connection.id,
      senderId: userId,
      message: req.body.message || null,
      fileUrl,
      fileType: mimetype,
      fileName: originalname || "attachment",
    });

    res.status(201).json({ status: "success", data: newMessage });
  } catch (error) {
    require('../utils/logger').error("❌ uploadChatFile error:", error);
    res.status(error.statusCode || 500).json({ status: "error", message: "Failed to upload file ❌" });
  }
};

const deleteConversation = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;
    const userType = req.user.userType || req.user.role;

    const connection = await connectionFor(req.user, connectionId);
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
    require('../utils/logger').error("Delete conversation error:", err);
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
