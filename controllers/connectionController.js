const Connection = require("../models/connection");
const Mentor = require("../models/mentor");
const Mentee = require("../models/mentee");
const User = require("../models/user");
const Notification = require("../models/notification");

exports.requestConnection = async (req, res) => {
  try {
    const { mentorUserId } = req.params;
    const menteeUserId = req.user.id;

    const mentor = await Mentor.findOne({ where: { user_id: mentorUserId } });
    if (!mentor) return res.status(400).json({ message: "Mentor profile not found for this user ❌" });

    const mentee = await Mentee.findOne({ where: { user_id: menteeUserId } });
    if (!mentee) return res.status(400).json({ message: "Mentee profile not found. Please complete your profile first ❌" });

    // Check if connection already exists
    let connection = await Connection.findOne({
      where: { mentorId: mentor.id, menteeId: mentee.id }
    });

    if (connection) {
      if (connection.status === "rejected") {
         // Allow re-request if previously rejected or simply prevent it. We'll update it to pending.
         connection.status = "pending";
         await connection.save();
      } else {
         return res.status(400).json({ message: `Connection already exists with status: ${connection.status} ❌` });
      }
    } else {
      connection = await Connection.create({
        mentorId: mentor.id,
        menteeId: mentee.id,
        status: "pending"
      });
    }

    const { ChatMessage } = require("../models");
    if (req.body.initialMessage && req.body.initialMessage.trim() !== "") {
       await ChatMessage.create({
         chatAccessId: connection.id,
         senderId: req.user.id,
         message: req.body.initialMessage,
       });
    }

    // Notify Mentor
    const notificationService = require("../services/notificationService");
    const menteeUserObj = await User.findByPk(menteeUserId);
    const mentorUserObj = await User.findByPk(mentorUserId);
    await notificationService.sendMessageRequest(menteeUserObj, mentorUserObj, "mentor");

    res.status(201).json({ status: "success", data: connection });
  } catch (error) {
    console.error("Connection request error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.respondConnection = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { status } = req.body; // 'accepted' or 'rejected'
    const mentorUserId = req.user.id;

    if (!['accepted', 'rejected'].includes(status)) {
       return res.status(400).json({ message: "Invalid status ❌" });
    }

    const mentor = await Mentor.findOne({ where: { user_id: mentorUserId } });
    
    const connection = await Connection.findOne({
      where: { id: connectionId, mentorId: mentor.id }
    });

    if (!connection) return res.status(404).json({ message: "Connection request not found ❌" });

    connection.status = status;
    await connection.save();

    const notificationService = require("../services/notificationService");
    
    if (status === "accepted") {
        // Send nice email + notification
        const menteeUser = await User.findByPk(connection.menteeId, { include: [Mentee] }); // Wait! menteeId is Mentee.id!
        // No, I need the mentee User object!
        const m = await Mentee.findByPk(connection.menteeId);
        const menteeUserObj = await User.findByPk(m.user_id);
        const mentorUserObj = await User.findByPk(mentor.user_id);
        
        await notificationService.sendMessageRequestAccepted(mentorUserObj, menteeUserObj, "mentee");
    } else {
        await Notification.create({
          receiverId: connection.menteeId,
          receiverType: "mentee",
          senderId: mentor.id,
          message: "❌ Your message request was declined.",
          type: "update",
          isRead: false,
        });
    }

    res.status(200).json({ status: "success", data: connection });
  } catch (error) {
    console.error("Connection response error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getConnections = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType || req.user.role;
    const { ChatMessage } = require("../models");

    let connections = [];

    if (userType === 'mentor') {
       const mentor = await Mentor.findOne({ where: { user_id: userId } });
       if (!mentor) return res.status(404).json({ message: "Mentor not found" });

       connections = await Connection.findAll({
         where: { mentorId: mentor.id },
         include: [
           {
             model: Mentee,
             as: "mentee",
             include: [{ model: User, as: "user", attributes: ["id", "name", "picture"] }]
           },
           {
             model: ChatMessage,
             as: "chatMessage"
           }
         ]
       });
    } else {
       const mentee = await Mentee.findOne({ where: { user_id: userId } });
       if (!mentee) return res.status(404).json({ message: "Mentee not found" });

       connections = await Connection.findAll({
         where: { menteeId: mentee.id },
         include: [
           {
             model: Mentor,
             as: "mentor",
             include: [{ model: User, as: "user", attributes: ["id", "name", "picture"] }]
           },
           {
             model: ChatMessage,
             as: "chatMessage"
           }
         ]
       });
    }
    
    // Process messages to attach lastMessage and unreadCount
    const formattedConnections = connections.map(conn => {
        const c = conn.toJSON();
        let lastMessageStr = "Tap to open chat";
        let unread = 0;
        let lastMessageTime = null;
        let lastMessageSenderId = null;
        
        if (c.chatMessage && c.chatMessage.length > 0) {
            // Sort by createdAt ascending
            const msgs = c.chatMessage.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            const lastMsg = msgs[msgs.length - 1];
            
            if (lastMsg.isDeleted) {
                lastMessageStr = "🚫 This message was deleted";
            } else if (lastMsg.message) {
                lastMessageStr = lastMsg.message;
            } else if (lastMsg.fileUrl) {
                lastMessageStr = "📎 Attachment";
            }
            
            lastMessageTime = lastMsg.createdAt;
            lastMessageSenderId = lastMsg.senderId;
            
            unread = msgs.filter(m => !m.isRead && m.senderId !== userId).length;
        }
        
        delete c.chatMessage;
        return { ...c, lastMessageStr, unreadCount: unread, lastMessageTime, lastMessageSenderId };
    });
    
    // Sort by lastMessageTime descending
    formattedConnections.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });

    res.status(200).json({ status: "success", data: formattedConnections });
  } catch(error) {
    console.error("Get connections error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
