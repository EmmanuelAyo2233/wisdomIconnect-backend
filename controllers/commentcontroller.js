const { User, Comment, Post } = require("../models");
const { sendEmail } = require("./emailcontroller");

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

        const postOwner = await User.findByPk(post.userId);
        if (!postOwner) {
            return res.status(404).json({
                status: "fail",
                message: "Post owner not found",
            });
        }

        const recipients = [
            { email: user.email, name: user.name },
            { email: postOwner.email, name: postOwner.name },
        ];

        const result = await sendEmail(
            recipients,
            user.name,
            "Post added Successfully",
            JSON.stringify(newComment.content)
        );

        return res.status(201).json({
            status: "success",
            message: result.success
                ? "Comment created and email sent"
                : "Comment created but email failed",
            data: {
                comment: newComment,
                emailInfo: result.info || null,
                emailError: result.error?.message || null,
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
