const {
    CLOUDINARY_FOLDER_NAME,
    streamFier,
} = require("../config/reuseablePackages");
const { User, Mentee, Mentor } = require("../models");
const { cloudinary } = require("../utils/cloudinary");

// Retrieves details of the authenticated user
const getdetails = async (req, res) => {
    return res.status(200).json({
        status: "success",
        message: "Fetched user details successfully",
        data: req.user,
    });
};

// Placeholder for updating user details (TODO: Implement)
const updateDetails = async (req, res) => {
    try {
        const userId = req.user.id;
        const { body } = req.body;

        if (!userId) {
            return res.status(400).json({
                status: "error",
                message: "User ID is missing",
            });
        }

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        // Update user details
        if (body.name) user.name = body.name;
        if (body.email) user.email = body.email;
        if (body.password) user.password = body.password;
        await user.save();

        if (user.userType === "mentor") {
            const mentor = await Mentor.findOne({ where: { user_id: userId } });
            if (mentor) {
                Object.assign(mentor, {
                    bio: body.bio,
                    experienceDescription: body.experienceDescription,
                    gender: body.gender,
                    role: body.role,
                    yearsOfExperience: body.yearsOfExperience,
                    available: body.available,
                    slotBooked: body.slotBooked,
                    phone: body.phone,
                    linkedInUrl: body.linkedInUrl,
                    education: body.education,
                    experience: body.experience,
                    expertise: body.expertise,
                    fluentIn: body.fluentIn,
                    startDate: body.startDate,
                    endDate: body.endDate,
                });
                await mentor.save();
            }
        } else if (user.userType === "mentee") {
            const mentee = await Mentee.findOne({ where: { user_id: userId } });
            if (mentee) {
                Object.assign(mentee, {
                    bio: body.bio,
                    gender: body.gender,
                    role: body.role,
                    phone: body.phone,
                    fluentIn: body.fluentIn,
                    interest: body.interest,
                    startDate: body.startDate,
                    endDate: body.endDate,
                });
                await mentee.save();
            }
        }

        return res.status(201).json({
            status: "success",
            message: "User details updated successfully",
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to update details",
            error: error.message,
        });
    }
    return res
        .status(201)
        .json({ status: "success", message: "Details updated successfully" });
};

// Placeholder for uploading/updating profile picture (TODO: Implement)
const uploadprofilePicture = async (req, res) => {
    try {
        const user = req.user; // authenticated user
        const file = req.file;

        if (!file || !file.buffer) {
            return res.status(400).json({ message: "No image provided" });
        }

        const firstName = user.name.split(" ")[0].toLowerCase();

        const publicId = `${firstName}_profile`;

        const stream = await cloudinary.uploader.upload_stream(
            {
                folder: CLOUDINARY_FOLDER_NAME,
                overwrite: true,
                resource_type: "image",
                public_id: publicId,
            },
            async (error, result) => {
                if (error) {
                    return res.status(500).json({ error });
                }

                const imageUrl = result.secure_url;

                console.log("Image Url", imageUrl);

                await User.update(
                    {
                        profile: imageUrl,
                    },
                    { where: { id: user.id } }
                );

                return res.status(201).json({
                    status: "success",
                    message: "Profile picture updated successfully",
                    imageUrl,
                });
            }
        );

        streamFier.createReadStream(file.buffer).pipe(stream);
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Failed to update profile picture",
            error: error.message,
        });
    }
};

// Deletes the authenticated user's account
const deleteAccount = async (req, res) => {
    try {
        const useremail = req.user.email;

        const user = await User.findOne({
            where: { email: req.user.email },
            include: [
                { model: Mentee, as: "mentee", required: false },
                { model: Mentor, as: "mentor", required: false },
            ],
        });

        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        if (useremail !== user.email) {
            return res.status(401).json({
                status: "error",
                message: "Unauthorized",
            });
        }
        await user.destroy();

        return res.status(201).json({
            status: "sucess",
            message: "Account deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete account",
            error: error.message,
        });
    }
};
module.exports = {
    getdetails,
    updateDetails,
    uploadprofilePicture,
    deleteAccount,
};
