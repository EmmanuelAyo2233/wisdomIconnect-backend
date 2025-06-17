const { User, Mentee, Mentor } = require("../models");

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
    return res
        .status(201)
        .json({ status: "success", message: "Details updated successfully" });
};

// Placeholder for uploading/updating profile picture (TODO: Implement)
const uploadprofilePicture = async (req, res) => {
    return res.status(201).json({
        status: "sucess",
        message: "Profile picture updated successfully",
    });
};

// Deletes the authenticated user's account
const deleteAccount = async (req, res) => {
    try {
        const user = await User.findOne({
            where: { email: req.user.email },
            include: [
                { model: Mentee, as: "mentee", required: false },
                { model: Mentor, as: "mentor", required: false },
            ],
        });
        await user.destroy();

        return res.status(201).json({
            status: "sucess",
            message: "Account deleted successfully",
        });
    } catch (error) {
        console.error("Delete account error", error);
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
