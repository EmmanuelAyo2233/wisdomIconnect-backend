const { Playbook, User, Mentor, Notification } = require("../models");

// 1. Create Playbook (Mentor only)
exports.createPlaybook = async (req, res) => {
    try {
        const { title, description, category, content, media_url } = req.body;

        if (req.user.userType !== "mentor") {
            return res.status(403).json({
                status: "fail",
                message: "Only mentors can create playbooks",
            });
        }

        const playbook = await Playbook.create({
            mentor_id: req.user.id,
            title,
            description,
            category,
            content,
            media_url,
            status: "pending",
        });

        res.status(201).json({
            status: "success",
            data: { playbook },
        });
    } catch (error) {
        console.error("Error creating playbook:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 2. Get All Approved Playbooks (Public)
exports.getAllPlaybooks = async (req, res) => {
    try {
        const playbooks = await Playbook.findAll({
            where: { status: "approved" },
            include: [
                {
                    model: User,
                    as: "mentor",
                    attributes: ["id", "name", "picture"],
                    include: [{ model: Mentor, as: "mentor", attributes: ["role", "bio"] }]
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        res.status(200).json({
            status: "success",
            results: playbooks.length,
            data: { playbooks },
        });
    } catch (error) {
        console.error("Error getting all playbooks:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 3. Get Mentor's Own Playbooks
exports.getMentorPlaybooks = async (req, res) => {
    try {
        if (req.user.userType !== "mentor") {
            return res.status(403).json({
                status: "fail",
                message: "Only mentors can fetch their playbooks",
            });
        }

        const playbooks = await Playbook.findAll({
            where: { mentor_id: req.user.id },
            order: [["createdAt", "DESC"]],
        });

        res.status(200).json({
            status: "success",
            results: playbooks.length,
            data: { playbooks },
        });
    } catch (error) {
        console.error("Error getting mentor playbooks:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 4. Get Single Playbook Details
exports.getPlaybookDetails = async (req, res) => {
    try {
        const playbook = await Playbook.findOne({
            where: { id: req.params.id },
            include: [
                {
                    model: User,
                    as: "mentor",
                    attributes: ["id", "name", "picture"],
                    include: [{ model: Mentor, as: "mentor", attributes: ["role", "bio"] }]
                },
            ],
        });

        if (!playbook) {
            return res.status(404).json({
                status: "fail",
                message: "No playbook found with that ID",
            });
        }

        if (playbook.status !== "approved" && req.user.userType !== "admin" && playbook.mentor_id !== req.user.id) {
             return res.status(403).json({
                 status: "fail",
                 message: "This playbook is not publicly available yet",
             });
        }

        playbook.views_count += 1;
        await playbook.save();

        res.status(200).json({
            status: "success",
            data: { playbook },
        });
    } catch (error) {
        console.error("Error getting playbook details:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 5. Get Pending Playbooks (Admin only)
exports.getPendingPlaybooks = async (req, res) => {
    try {
        const playbooks = await Playbook.findAll({
            where: { status: "pending" },
            include: [
                {
                    model: User,
                    as: "mentor",
                    attributes: ["id", "name", "picture"],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        res.status(200).json({
            status: "success",
            results: playbooks.length,
            data: { playbooks },
        });
    } catch (error) {
        console.error("Error getting pending playbooks:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 6. Approve Playbook (Admin only)
exports.approvePlaybook = async (req, res) => {
    try {
        const playbook = await Playbook.findByPk(req.params.id);

        if (!playbook) {
            return res.status(404).json({
                status: "fail",
                message: "No playbook found with that ID",
            });
        }

        playbook.status = "approved";
        await playbook.save();

        // Get mentor record to send notification
        const mentor = await Mentor.findOne({ where: { user_id: playbook.mentor_id } });
        if (mentor) {
             await Notification.create({
                 receiverId: mentor.id,
                 receiverType: "mentor",
                 senderId: req.user.id,
                 message: "Your playbook has been approved and is now live.",
                 type: "system",
                 isRead: false,
             });
        }

        res.status(200).json({
            status: "success",
            data: { playbook },
        });
    } catch (error) {
        console.error("Error approving playbook:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 7. Reject / Delete Playbook (Admin or Owner)
exports.deletePlaybook = async (req, res) => {
    try {
        const playbook = await Playbook.findByPk(req.params.id);

        if (!playbook) {
            return res.status(404).json({
                status: "fail",
                message: "No playbook found with that ID",
            });
        }

        const isAdmin = req.user.userType === "admin";
        
        if (!isAdmin && playbook.mentor_id !== req.user.id) {
            return res.status(403).json({
                status: "fail",
                message: "You do not have permission to delete this playbook",
            });
        }

        await playbook.destroy();

        if (isAdmin && playbook.mentor_id !== req.user.id) {
             const mentor = await Mentor.findOne({ where: { user_id: playbook.mentor_id } });
             if (mentor) {
                 await Notification.create({
                     receiverId: mentor.id,
                     receiverType: "mentor",
                     senderId: req.user.id,
                     message: "Your playbook was rejected and has been removed.",
                     type: "system",
                     isRead: false,
                 });
             }
        }

        res.status(204).json({
            status: "success",
            data: null,
        });
    } catch (error) {
        console.error("Error deleting playbook:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 8. Update Playbook (Owner only)
exports.updatePlaybook = async (req, res) => {
    try {
        const playbook = await Playbook.findByPk(req.params.id);

        if (!playbook) {
            return res.status(404).json({
                status: "fail",
                message: "No playbook found with that ID",
            });
        }

        if (playbook.mentor_id !== req.user.id) {
            return res.status(403).json({
                status: "fail",
                message: "You do not have permission to edit this playbook",
            });
        }

        const { title, description, category, content, media_url } = req.body;
        
        // Let's allow updating, but reset status to pending? The user didn't explicitly request resetting status.
        // It says "Edit playbook (if pending or rejected)".
        if (playbook.status === "approved") {
            return res.status(400).json({
               status: "fail",
               message: "Cannot edit approved playbooks directly. Create a new one.",
            });
        }

        playbook.title = title || playbook.title;
        playbook.description = description || playbook.description;
        playbook.category = category || playbook.category;
        playbook.content = content || playbook.content;
        playbook.media_url = media_url || playbook.media_url;

        await playbook.save();

        res.status(200).json({
            status: "success",
            data: { playbook },
        });
    } catch (error) {
        console.error("Error updating playbook:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 9. Like Playbook
exports.likePlaybook = async (req, res) => {
    try {
        const playbook = await Playbook.findByPk(req.params.id);

        if (!playbook) {
            return res.status(404).json({
                status: "fail",
                message: "No playbook found with that ID",
            });
        }

        playbook.likes_count += 1;
        await playbook.save();

        res.status(200).json({
            status: "success",
            data: { playbook },
        });
    } catch (error) {
        console.error("Error liking playbook:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};
