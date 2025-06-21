const { Post, User } = require("../models");

const datenoow = Date.now();

const getAllPost = async (req, res) => {
    try {
        const posts = await Post.findAll();

        if (posts <= 0) {
            return res.status(404).json({
                status: "fail",
                message: "No post yet",
            });
        }

        res.status(201).json({ status: "success", message: posts });
    } catch (error) {
        res.status(500).json({
            message: "Failed to load posts",
            error: error.message,
        });
    }
};

const getFullPost = async (req, res) => {
    try {
        const postId = req.params;

        const post = await Post.findOne({
            where: { id: postId.id },
            include: {
                model: User,
                as: "user",
                attributes: ["id", "name", "email"],
            },
        });

        if (!post) {
            return res.status(404).json({
                status: "fail",
                message: "No post found",
            });
        }

        res.status(201).json({ status: "success", message: post });
    } catch (error) {
        res.status(500).json({
            message: "Failed to load post details",
            error: error.message,
        });
    }
};

const createPost = async (req, res) => {
    try {
        const body = req.body;
        const user = req.user;

        if (!body.title || !body.content) {
            return res.status(400).json({
                status: "fail",
                message: "Title and content are required",
            });
        }

        const post = await Post.create({
            title: body.title,
            content: body.content,
            userId: user.id,
            createdAt: Date.now(),
        });

        return res.status(201).json({
            status: "success",
            message: "Post created successfully",
            data: post,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to create post",
            error: error.message,
        });
    }
};

const updatePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const body = req.body;
        const user = req.user;

        if (!body.title && !body.content) {
            return res.status(400).json({
                status: "fail",
                message: "Title and content are required",
            });
        }

        const post = await Post.findOne({
            where: { id: postId },
        });

        if (!post) {
            return res.status(404).json({
                status: "fail",
                message: "Post not found",
            });
        }

        const updates = { updatedAt: Date.now().toString() };
        if (body.title) {
            updates.title = body.title;
        }
        if (body.content) {
            updates.content = body.content;
        }
        if (body.content) {
            updates.content = body.content;
        }

        await post.update({
            updates,
            updatedAt: datenoow,
        });

        if (post.userId !== user.id) {
            return res.status(403).json({
                status: "fail",
                message: "You are not authorized to update this post",
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Post updated successfully",
            data: post,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to update post",
            error: error.message,
        });
    }
};

const deletePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const user = req.user;

        const post = await Post.findOne({
            where: { id: postId },
            include: {
                model: User,
                as: "user",
                attributes: ["id", "name", "email"],
            },
        });

        if (!user) {
            return res.status(401).json({
                status: "fail",
                message: "Unauthorized",
            });
        }

        if (post.userId !== user.id) {
            return res.status(403).json({
                status: "fail",
                message: "You are not allowed to delete this post",
            });
        }

        await post.destroy();

        return res.status(200).json({
            status: "success",
            message: "Post deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete post",
            error: error.message,
        });
    }
};

module.exports = {
    getAllPost,
    getFullPost,
    createPost,
    updatePost,
    deletePost,
};
