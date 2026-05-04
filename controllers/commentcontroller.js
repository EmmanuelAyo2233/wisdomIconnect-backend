const { User, Comment, Post, Mentor, Mentee } = require("../models");
const notificationService = require("../services/notificationService");

const getAllComment = async (req, res) => {
    try {
        const comments = await Comment.findAll();

        if (comments <= 0) {
            return res.status(404).json({
                status: "fail",
                message: "No comment yet",
            });
        }

        return res.status(201).json({ status: "success", message: comments });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to load all comments",
            error: error.message,
        });
    }
};

const getFullComment = async (req, res) => {
    try {
        const id = req.params.id;

        const comment = await Comment.findByPk(id);

        if (!comment) {
            return res.status(404).json({
                status: "fail",
                message: "Comment not found",
            });
        }

        if (comment.length <= 0) {
            return res.status(404).json({
                status: "fail",
                message: "No comment yet",
            });
        }

        return res.status(201).json({ status: "success", message: comment });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to get comment",
            error: error.message,
        });
    }
};

const createComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const user = req.user;

        const post = await Post.findByPk(id);

        if (!post) {
            return res.status(404).json({
                status: "fail",
                message: "Post not found",
            });
        }

        const newComment = await Comment.create({
            content,
            postId: id,
            userId: user.id,
            createdAt: Date.now(),
        });

        const postOwner = await User.findByPk(post.userId, {
            include: [
                { model: Mentor, as: 'mentor' },
                { model: Mentee, as: 'mentee' }
            ]
        });

        if (!postOwner) {
            return res.status(404).json({
                status: "fail",
                message: "Post owner not found",
            });
        }

        // Notify the post owner if someone else commented
        if (postOwner.id !== user.id) {
            let receiverId = postOwner.id;
            if (postOwner.userType === 'mentor' && postOwner.mentor) receiverId = postOwner.mentor.id;
            if (postOwner.userType === 'mentee' && postOwner.mentee) receiverId = postOwner.mentee.id;

            await notificationService.sendNotification({
                receiverId: receiverId,
                receiverType: postOwner.userType,
                senderId: user.id,
                type: 'general',
                title: 'New Comment on your Playbook',
                message: `${user.name} commented on your playbook.`,
                link: `/playbooks/${post.id}`,
                emailData: {
                    to: postOwner.email,
                    html: `<div style="font-family:sans-serif;color:#333;">
                             <h2>New Comment on Your Playbook</h2>
                             <p><b>${user.name}</b> just commented on your playbook:</p>
                             <blockquote style="border-left:4px solid #f59e0b;padding-left:10px;color:#555;">${content}</blockquote>
                             <p><a href="${process.env.FRONTEND_URL}/playbooks" style="color:#2563eb;font-weight:bold;">View Comment</a></p>
                           </div>`
                }
            }).catch(err => console.error("Failed to send comment notification:", err));
        }

        return res.status(201).json({
            status: "success",
            message: "Comment created successfully",
            data: {
                comment: newComment,
            },
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to post comments",
            error: error.message,
        });
    }
};

const updateComment = async (req, res) => {
    try {
        const body = req.body;
        const id = req.params.id;
        const user = req.user;

        const comment = await Comment.findByPk(id);
        const post = await Post.findByPk(comment.postId);
        const userComment = await User.findByPk(user.id);

        if (!comment) {
            return res.status(404).json({
                status: "fail",
                message: "Comment not found",
            });
        }

        if (comment.userId !== user.id) {
            return res.status(401).json({
                status: "fail",
                message: "Unauthorized",
            });
        }

        if (post.userId !== userComment.id) {
            return res.status(401).json({
                status: "fail",
                message: "Unauthorized",
            });
        }

        await Comment.update(body, {
            where: { id },
        });

        return res.status(200).json({
            status: "success",
            message: "Comment updated successfully",
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update comment",
            error: error.message,
        });
    }
};

const deleteComment = async (req, res) => {
    try {
        const id = req.params.id;
        const user = req.user;

        const comment = await Comment.findByPk(id);
        const post = await Post.findByPk(comment.postId);
        const userComment = await User.findByPk(user.id);

        if (!comment) {
            return res.status(404).json({
                status: "fail",
                message: "Comment not found",
            });
        }

        if (comment.userId !== user.id) {
            return res.status(401).json({
                status: "fail",
                message: "Unauthorized",
            });
        }

        if (post.userId !== userComment.id) {
            return res.status(401).json({
                status: "fail",
                message: "Unauthorized",
            });
        }

        await Comment.destroy({
            where: { id },
        });

        return res.status(200).json({
            status: "success",
            message: "Comment deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to delete comment",
            error: error.message,
        });
    }
};

module.exports = {
    createComment,
    deleteComment,
    getAllComment,
    getFullComment,
    updateComment,
};
