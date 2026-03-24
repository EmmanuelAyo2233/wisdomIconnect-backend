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
    if (!mentor) return res.status(404).json({ message: "Mentor not found ❌" });

    const mentee = await Mentee.findOne({ where: { user_id: menteeUserId } });
    if (!mentee) return res.status(404).json({ message: "Mentee not found ❌" });

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
    await Notification.create({
      receiverId: mentor.id,
      receiverType: "mentor",
      senderId: mentee.id,
      message: `📩 New message request from Mentee`,
      type: "booking",
      isRead: false,
    });

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

    // Notify Mentee
    await Notification.create({
      receiverId: connection.menteeId,
      receiverType: "mentee",
      senderId: mentor.id,
      message: status === "accepted" ? "✅ Your message request was accepted! You can now chat." : "❌ Your message request was declined.",
      type: "update",
      isRead: false,
    });

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
           }
         ]
       });
    }

    res.status(200).json({ status: "success", data: connections });
  } catch(error) {
    console.error("Get connections error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
