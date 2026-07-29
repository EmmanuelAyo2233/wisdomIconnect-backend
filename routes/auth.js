const { express } = require("../config/reuseablePackages");
const {
    signup,
    login,
    forgotPassword,
    resetPassword,
    approveMentor,
    rejectMentor,
    authentication,
    restrictTo,
    logout,
    verifyEmail,
    resendVerification,
} = require("../controllers/authcontrollers");
const { upload } = require("../utils/cloudinary");

const rateLimiter = require("../config/rateLimiter");
const authLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 5, message: "Too many login/auth requests from this IP. Please try again after 15 minutes." });

const router = express.Router();

router.post("/register", upload.single("certificate"), signup);
router.route("/login").post(authLimiter, login);

const { db, User, Mentor } = require("../models");
router.get("/fix-db", async (req, res) => {
    try {
        const admin = await User.findOne({ where: { email: "admin@wisdomconnect.com" } });
        const [tables] = await db.sequelize.query("SHOW TABLES;");
        res.json({ 
            adminExists: !!admin, 
            userTable: User.tableName,
            mentorTable: Mentor.tableName,
            tables
        });
    } catch(e) {
        res.send("Sync Error: " + e.message);
    }
});

router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/logout",  authentication, logout);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", authLimiter, resendVerification);

// Admin-only routes for mentor approval/rejection
router.patch(
    "/admin/approve-mentor/:userId",
    authentication,
    restrictTo("admin"),
    approveMentor
);

router.patch(
    "/admin/reject-mentor/:userId",
    authentication,
    restrictTo("admin"),
    rejectMentor
);

module.exports = router;
