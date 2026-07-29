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
        const { Mentor, Sequelize } = require("../models");

        const mentorsCount  = await User.count({ where: { userType: "mentor", status: "approved" } });
        const sessionsCount = await Appointment.count({ where: { status: "completed" } });

        // Average star rating expressed as a satisfaction % (e.g. 4.8 stars → 96%)
        const ratingResult = await Review.findOne({
            attributes: [[Sequelize.fn("AVG", Sequelize.col("rating")), "avgRating"]],
            raw: true,
        });
        const avgRating = parseFloat(ratingResult?.avgRating || 0);
        const satisfactionPct = avgRating > 0 ? Math.round((avgRating / 5) * 100) : 0;

        // Distinct countries from mentor profiles (stored in the 'industries' JSON or a dedicated field)
        // We count distinct user entries — approximated by total approved user countries
        // Since we don't have a country column, we count distinct fluentIn languages as a proxy
        // and fall back to total unique mentor sign-up dates per month as "reach" 
        // For now: return distinct months mentors joined as a country proxy, or just the raw mentor count
        // BEST approach: query Mentor table for distinct country if the field exists
        let countriesCount = 0;
        try {
            const distinctCountries = await Mentor.findAll({
                attributes: [[Sequelize.fn("COUNT", Sequelize.fn("DISTINCT", Sequelize.col("country"))), "cnt"]],
                raw: true,
            });
            countriesCount = parseInt(distinctCountries[0]?.cnt || 0);
        } catch(_) {
            // country column may not exist yet — skip
        }

        res.json({
            mentors: mentorsCount,
            sessions: sessionsCount,
            satisfaction: satisfactionPct,
            countries: countriesCount,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

