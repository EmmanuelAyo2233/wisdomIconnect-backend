const { MessageRequest, Mentee, Mentor, User, Connection, Notification } = require("../models");
const { Op } = require("sequelize");
const notificationService = require("../services/notificationService");

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

        // Check privacy settings: whoCanMessage
        let privacySettings = {};
        if (mentor.privacySettings) {
           try {
              privacySettings = typeof mentor.privacySettings === 'string' ? JSON.parse(mentor.privacySettings) : mentor.privacySettings;
           } catch(e) {
              privacySettings = mentor.privacySettings;
           }
        }
        if (privacySettings.whoCanMessage === 'connections') {
            return res.status(403).json({ status: "fail", message: "This mentor only accepts messages from established connections." });
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

        // Check notification prefs for messages_app
        let notifPrefs = {};
        if (mentor.notifPrefs) {
           try { notifPrefs = typeof mentor.notifPrefs === 'string' ? JSON.parse(mentor.notifPrefs) : mentor.notifPrefs; } catch(e) {}
        }

        if (notifPrefs.messages_app !== false) {
           const mentorUser = await User.findByPk(mentor.user_id);
           notificationService.sendMessageRequest(req.user, mentorUser, "mentor").catch(console.error);
        }

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

        const menteeObj = await Mentee.findByPk(request.mentee_id);
        const menteeUser = await User.findByPk(menteeObj.user_id);

        if (status === "accepted") {
            notificationService.sendMessageRequestAccepted(req.user, menteeUser, "mentee").catch(console.error);
        } else {
            // Just standard in-app for declined, or use generic
            await notificationService.sendNotification({
              receiverId: request.mentee_id,
              receiverType: "mentee",
              type: "update",
              title: "Message Request Declined",
              message: "❌ Your message request was declined."
            }).catch(console.error);
        }

        res.status(200).json({ status: "success", data: { request } });
    } catch (error) {
        console.error("Error responding to message request:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};
