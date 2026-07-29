const { express } = require("../config/reuseablePackages");
const { upload } = require("../utils/cloudinary");
const {
    getdetails,
    updateDetails,
    uploadprofilePicture,
    deleteAccount,
    getAllPlatformAchievements,
    changePassword,
    changeEmail,
    updateMentorSettings,
} = require("../controllers/usercontroller");
const { authentication } = require("../controllers/authcontrollers");

const router = express.Router();

// Get / update user details
router.route("/me").get(authentication, getdetails);
router.route("/me/update").patch(authentication, updateDetails);
router.route("/me/picture").patch(authentication, upload.single("picture"), uploadprofilePicture);
router.route("/me/delete").delete(authentication, deleteAccount);

// Security: change password & email
router.route("/me/change-password").patch(authentication, changePassword);
router.route("/me/change-email").patch(authentication, changeEmail);

// Settings (booking control, notifications, privacy)
router.route("/me/settings").patch(authentication, updateMentorSettings);

// Platform achievements
router.route("/achievements").get(authentication, getAllPlatformAchievements);

const { User, Appointment, Review } = require("../models");

// Public stats for Landing Page
router.get("/landing-stats", async (req, res) => {
    try {
        const mentorsCount = await User.count({ where: { userType: "mentor", status: "approved" } });
        const menteesCount = await User.count({ where: { userType: "mentee" } });
        const sessionsCount = await Appointment.count({ where: { status: "completed" } });
        const totalReviews = await Review.count();
        
        res.json({
            mentors: mentorsCount,
            mentees: menteesCount,
            sessions: sessionsCount,
            totalReviews
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

