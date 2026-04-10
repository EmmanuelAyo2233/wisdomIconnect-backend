const { MessageRequest, Mentee, Mentor, User, Connection, Notification } = require("../models");
const { Op } = require("sequelize");

// 1. Send Message Request (Mentee -> Mentor)
exports.sendMessageRequest = async (req, res) => {
    try {
        const { mentorId, initialMessage } = req.body;
        const userId = req.user.id; // Mentee's user ID

        let mentee = await Mentee.findOne({ where: { user_id: userId } });
        if (!mentee) {
            // Auto-create if they have 'mentee' userType but are missing the profile
            if (req.user.userType === 'mentee') {
                mentee = await Mentee.create({ user_id: userId });
            } else {
                return res.status(403).json({ status: "fail", message: "Only mentees can send message requests" });
            }
        }

        const mentor = await Mentor.findOne({
            where: {
                [Op.or]: [
                    { id: mentorId },
                    { user_id: mentorId }
                ]
            }
        });
        if (!mentor) {
            return res.status(404).json({ status: "fail", message: "Mentor not found" });
        }

        const existingRequest = await MessageRequest.findOne({
            where: { mentee_id: mentee.id, mentor_id: mentor.id }
        });

        if (existingRequest) {
            return res.status(400).json({ status: "fail", message: `Request already exists with status: ${existingRequest.status}` });
        }

        // Prevent if already actively connected in `connections`
        const existingConnection = await Connection.findOne({
            where: { mentorId: mentor.id, menteeId: mentee.id, status: "accepted" }
        });

        if (existingConnection) {
            return res.status(400).json({ status: "fail", message: "You are already connected with this mentor." });
        }

        const request = await MessageRequest.create({
            mentee_id: mentee.id,
            mentor_id: mentor.id,
            initial_message: initialMessage,
            status: "pending"
        });

        // Notify mentor
        await Notification.create({
            receiverId: mentor.id,
            receiverType: "mentor",
            senderId: userId,
            message: `📩 New message request from ${req.user.name}`,
            type: "message", // Adjusted to standard ENUM supported natively by the database
            isRead: false,
        });

        res.status(201).json({ status: "success", data: { request } });
    } catch (error) {
        console.error("Error sending message request:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 2. Get Message Requests for Mentor
exports.getMentorMessageRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const mentor = await Mentor.findOne({ where: { user_id: userId } });
        if (!mentor) {
            return res.status(403).json({ status: "fail", message: "Only mentors can view message requests" });
        }

        const requests = await MessageRequest.findAll({
            where: { mentor_id: mentor.id, status: "pending" },
            include: [
                {
                    model: Mentee,
                    as: "mentee",
                    include: [{ model: User, as: "user", attributes: ["id", "name", "picture"] }]
                }
            ],
            order: [["createdAt", "DESC"]]
        });

        res.status(200).json({ status: "success", data: { requests } });
    } catch (error) {
        console.error("Error getting message requests:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 3. Respond to Message Request
exports.respondToMessageRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status } = req.body; // 'accepted' or 'rejected'
        const userId = req.user.id;

        if (!["accepted", "rejected"].includes(status)) {
            return res.status(400).json({ status: "fail", message: "Invalid status" });
        }

        const mentor = await Mentor.findOne({ where: { user_id: userId } });
        const request = await MessageRequest.findOne({
            where: { id: requestId, mentor_id: mentor.id }
        });

        if (!request) {
            return res.status(404).json({ status: "fail", message: "Request not found" });
        }

        request.status = status;
        await request.save();

        if (status === "accepted") {
            // Create accepted connection to enable chat
            await Connection.findOrCreate({
                where: { mentorId: mentor.id, menteeId: request.mentee_id },
                defaults: { status: "accepted" }
            });
            
            // If connection exists but not accepted, update it
            const conn = await Connection.findOne({ where: { mentorId: mentor.id, menteeId: request.mentee_id } });
            if (conn && conn.status !== "accepted") {
                conn.status = "accepted";
                await conn.save();
            }
        }

        // Notify mentee
        await Notification.create({
            receiverId: request.mentee_id,
            receiverType: "mentee",
            senderId: userId,
            message: status === "accepted" ? "✅ Your message request was accepted!" : "❌ Your message request was declined.",
            type: "update", // Adjusted to standard ENUM supported natively by the database
            isRead: false,
        });

        res.status(200).json({ status: "success", data: { request } });
    } catch (error) {
        console.error("Error responding to message request:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};
