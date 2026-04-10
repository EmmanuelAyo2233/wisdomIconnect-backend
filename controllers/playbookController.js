const { Playbook, User, Mentor, Mentee, Notification, PlaybookLike, PlaybookView, SavedPlaybook, PlaybookComment } = require("../models");

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
        const userId = req.user ? req.user.id : null;
        const playbooks = await Playbook.findAll({
            where: { status: "approved" },
            include: [
                {
                    model: User,
                    as: "mentor",
                    attributes: ["id", "name", "picture"],
                    include: [{ model: Mentor, as: "mentor", attributes: ["id", "role", "bio"] }]
                },
                {
                    model: PlaybookLike,
                    as: "playbookLikes",
                    attributes: ["user_id"]
                },
                {
                    model: SavedPlaybook,
                    as: "savedPlaybooks",
                    attributes: ["user_id"]
                }
            ],
            order: [["createdAt", "DESC"]],
        });

        const formattedPlaybooks = playbooks.map(pb => {
            const pbJson = pb.toJSON();
            pbJson.isLiked = userId ? pb.playbookLikes.some(l => l.user_id === userId) : false;
            pbJson.isSaved = userId ? pb.savedPlaybooks.some(s => s.user_id === userId) : false;
            return pbJson;
        });

        res.status(200).json({
            status: "success",
            results: playbooks.length,
            data: { playbooks: formattedPlaybooks },
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
            include: [
                {
                    model: User,
                    as: "mentor",
                    attributes: ["id", "name", "picture", "userType"],
                    include: [{ model: Mentor, as: "mentor", attributes: ["id", "role", "bio"] }]
                },
                {
                    model: PlaybookLike,
                    as: "playbookLikes",
                    attributes: ["user_id"]
                },
                {
                    model: SavedPlaybook,
                    as: "savedPlaybooks",
                    attributes: ["user_id"]
                }
            ],
            order: [["createdAt", "DESC"]],
        });

        const formattedPlaybooks = playbooks.map(pb => {
            const pbJson = pb.toJSON();
            pbJson.isLiked = pb.playbookLikes.some(l => l.user_id === req.user.id);
            pbJson.isSaved = pb.savedPlaybooks.some(s => s.user_id === req.user.id);
            return pbJson;
        });

        res.status(200).json({
            status: "success",
            results: playbooks.length,
            data: { playbooks: formattedPlaybooks },
        });
    } catch (error) {
        console.error("Error getting mentor playbooks:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 4. Get Single Playbook Details
exports.getPlaybookDetails = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const playbook = await Playbook.findOne({
            where: { id: req.params.id },
            include: [
                {
                    model: User,
                    as: "mentor",
                    attributes: ["id", "name", "picture"],
                    include: [{ model: Mentor, as: "mentor", attributes: ["id", "role", "bio"] }]
                },
                {
                    model: PlaybookLike,
                    as: "playbookLikes",
                    attributes: ["user_id"]
                },
                {
                    model: SavedPlaybook,
                    as: "savedPlaybooks",
                    attributes: ["user_id"]
                }
            ],
        });

        if (!playbook) {
            return res.status(404).json({
                status: "fail",
                message: "No playbook found with that ID",
            });
        }

        if (playbook.status !== "approved" && (!req.user || (req.user.userType !== "admin" && playbook.mentor_id !== req.user.id))) {
             return res.status(403).json({
                 status: "fail",
                 message: "This playbook is not publicly available yet",
             });
        }

        // Handle unique views
        if (userId) {
            const [view, created] = await PlaybookView.findOrCreate({
                where: { user_id: userId, playbook_id: playbook.id }
            });
            
            if (created) {
                playbook.views_count += 1;
                await playbook.save();
            }
        }

        const playbookJson = playbook.toJSON();
        playbookJson.isLiked = userId ? playbook.playbookLikes.some(l => l.user_id === userId) : false;
        playbookJson.isSaved = userId ? playbook.savedPlaybooks.some(s => s.user_id === userId) : false;

        res.status(200).json({
            status: "success",
            data: { playbook: playbookJson },
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

// 9. Like Playbook (Toggle)
exports.likePlaybook = async (req, res) => {
    try {
        const userId = req.user.id;
        const playbookId = req.params.id;

        const playbook = await Playbook.findByPk(playbookId);
        if (!playbook) {
            return res.status(404).json({
                status: "fail",
                message: "No playbook found with that ID",
            });
        }

        const existingLike = await PlaybookLike.findOne({
            where: { user_id: userId, playbook_id: playbookId }
        });

        if (existingLike) {
            await existingLike.destroy();
            playbook.likes_count = Math.max(0, playbook.likes_count - 1);
            await playbook.save();
            
            return res.status(200).json({
                status: "success",
                message: "Unliked",
                data: { isLiked: false, likes_count: playbook.likes_count }
            });
        } else {
            await PlaybookLike.create({ user_id: userId, playbook_id: playbookId });
            playbook.likes_count += 1;
            await playbook.save();

            return res.status(200).json({
                status: "success",
                message: "Liked",
                data: { isLiked: true, likes_count: playbook.likes_count }
            });
        }
    } catch (error) {
        console.error("Error liking playbook:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 10. Save Playbook (Toggle)
exports.savePlaybook = async (req, res) => {
    try {
        const userId = req.user.id;
        const playbookId = req.params.id;

        const playbook = await Playbook.findByPk(playbookId);
        if (!playbook) {
            return res.status(404).json({
                status: "fail",
                message: "No playbook found with that ID",
            });
        }

        const existingSave = await SavedPlaybook.findOne({
            where: { user_id: userId, playbook_id: playbookId }
        });

        if (existingSave) {
            await existingSave.destroy();
            return res.status(200).json({
                status: "success",
                message: "Removed from saved",
                data: { isSaved: false }
            });
        } else {
            await SavedPlaybook.create({ user_id: userId, playbook_id: playbookId });
            return res.status(200).json({
                status: "success",
                message: "Saved successfully",
                data: { isSaved: true }
            });
        }
    } catch (error) {
        console.error("Error saving playbook:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 11. Get Saved Playbooks (Mentee only)
exports.getSavedPlaybooks = async (req, res) => {
    try {
        const userId = req.user.id;
        const savedPlaybooks = await SavedPlaybook.findAll({
            where: { user_id: userId },
            include: [
                {
                    model: Playbook,
                    as: "playbook",
                    include: [
                        {
                            model: User,
                            as: "mentor",
                            attributes: ["id", "name", "picture"],
                            include: [{ model: Mentor, as: "mentor", attributes: ["id", "role", "bio"] }]
                        },
                        {
                            model: PlaybookLike,
                            as: "playbookLikes",
                            attributes: ["user_id"]
                        }
                    ]
                }
            ],
            order: [["createdAt", "DESC"]]
        });

        const formattedPlaybooks = savedPlaybooks.map(s => {
            const pbJson = s.playbook.toJSON();
            pbJson.isLiked = pbJson.playbookLikes.some(l => l.user_id === userId);
            pbJson.isSaved = true;
            return pbJson;
        });

        res.status(200).json({
            status: "success",
            results: formattedPlaybooks.length,
            data: { playbooks: formattedPlaybooks },
        });
    } catch (error) {
        console.error("Error getting saved playbooks:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 12. Add a Comment to a Playbook
exports.addPlaybookComment = async (req, res) => {
    try {
        const { id } = req.params; // playbook ID
        const { content, parent_id } = req.body;
        const userId = req.user.id;

        if (!content) {
            return res.status(400).json({ status: "fail", message: "Comment content is required" });
        }

        const playbook = await Playbook.findByPk(id);
        if (!playbook) {
            return res.status(404).json({ status: "fail", message: "Playbook not found" });
        }

        // If replying, ensure parent comment exists and belongs to this playbook
        if (parent_id) {
            const parentComment = await PlaybookComment.findByPk(parent_id);
            if (!parentComment || parentComment.playbook_id !== parseInt(id)) {
                return res.status(400).json({ status: "fail", message: "Invalid parent comment" });
            }
        }

        const newComment = await PlaybookComment.create({
            playbook_id: id,
            user_id: userId,
            parent_id: parent_id || null,
            content
        });

        // Notifications Logic
        try {
            let targetUserId = null;
            let notifyMsg = "";

            if (parent_id) {
                const parentComment = await PlaybookComment.findByPk(parent_id);
                if (parentComment && parentComment.user_id !== userId) {
                    targetUserId = parentComment.user_id;
                    notifyMsg = `${req.user.name || 'Someone'} replied to your comment on a playbook.`;
                }
            } else {
                if (playbook.mentor_id !== userId) {
                    targetUserId = playbook.mentor_id;
                    notifyMsg = `${req.user.name || 'Someone'} commented on your playbook "${playbook.title}".`;
                }
            }

            if (targetUserId) {
                const targetUser = await User.findByPk(targetUserId, {
                   attributes: ['id', 'userType']
                });
                
                if (targetUser) {
                    let receiverId = null;
                    if (targetUser.userType === 'mentor') {
                        const m = await Mentor.findOne({ where: { user_id: targetUserId }});
                        if (m) receiverId = m.id;
                    } else if (targetUser.userType === 'mentee') {
                        const m = await Mentee.findOne({ where: { user_id: targetUserId }});
                        if (m) receiverId = m.id;
                    }
                    
                    if (receiverId) {
                        await Notification.create({
                            receiverId: receiverId,
                            receiverType: targetUser.userType,
                            senderId: userId,
                            message: notifyMsg,
                            type: "update",
                            isRead: false
                        });
                    }
                }
            }
        } catch (notifErr) {
            console.error("Error sending comment notification:", notifErr);
        }

        // Fetch it back right away with associations to return
        const createdComment = await PlaybookComment.findOne({
            where: { id: newComment.id },
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "name", "picture", "userType"],
                    include: [
                        { model: Mentor, as: "mentor", attributes: ["id", "role"] },
                        { model: Mentee, as: "mentee", attributes: ["id", "role"] }
                    ]
                }
            ]
        });

        res.status(201).json({
            status: "success",
            data: { comment: createdComment }
        });
    } catch (error) {
        console.error("Error adding playbook comment:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 13. Get Playbook Comments
exports.getPlaybookComments = async (req, res) => {
    try {
        const { id } = req.params;

        const comments = await PlaybookComment.findAll({
            where: { playbook_id: id, parent_id: null },
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "name", "picture", "userType"],
                    include: [
                        { model: Mentor, as: "mentor", attributes: ["id", "role"] },
                        { model: Mentee, as: "mentee", attributes: ["id", "role"] }
                    ]
                }
            ]
        });

        const rootComments = [];
        for (let c of comments) {
            const cJson = c.toJSON();
            cJson.replyCount = await PlaybookComment.count({ where: { parent_id: c.id } });
            cJson.replies = []; // will be loaded dynamically
            rootComments.push(cJson);
        }

        res.status(200).json({
            status: "success",
            results: rootComments.length,
            data: { comments: rootComments }
        });
    } catch (error) {
        console.error("Error getting playbook comments:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 14. Update Playbook Comment
exports.updatePlaybookComment = async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        const comment = await PlaybookComment.findOne({
            where: { id: commentId, playbook_id: id }
        });

        if (!comment) {
            return res.status(404).json({ status: "error", message: "Comment not found" });
        }

        if (comment.user_id !== userId) {
            return res.status(403).json({ status: "error", message: "Not authorized to update this comment" });
        }

        comment.content = content;
        await comment.save();

        res.status(200).json({
            status: "success",
            data: { comment }
        });
    } catch (error) {
        console.error("Error updating comment:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 15. Delete Playbook Comment
exports.deletePlaybookComment = async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const userId = req.user.id;

        const comment = await PlaybookComment.findOne({
            where: { id: commentId, playbook_id: id }
        });

        if (!comment) {
            return res.status(404).json({ status: "error", message: "Comment not found" });
        }

        if (comment.user_id !== userId) {
            return res.status(403).json({ status: "error", message: "Not authorized to delete this comment" });
        }

        await comment.destroy();

        res.status(200).json({
            status: "success",
            message: "Comment deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting comment:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// 16. Get Playbook Replies (Paginated)
exports.getPlaybookReplies = async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        const { count, rows } = await PlaybookComment.findAndCountAll({
            where: { playbook_id: id, parent_id: commentId },
            order: [["createdAt", "ASC"]],
            limit,
            offset,
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "name", "picture", "userType"],
                    include: [
                        { model: Mentor, as: "mentor", attributes: ["id", "role"] },
                        { model: Mentee, as: "mentee", attributes: ["id", "role"] }
                    ]
                }
            ]
        });

        res.status(200).json({
            status: "success",
            results: rows.length,
            totalItems: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            data: { replies: rows }
        });
    } catch (error) {
        console.error("Error fetching replies:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};
