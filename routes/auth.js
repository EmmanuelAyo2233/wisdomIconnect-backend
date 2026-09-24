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

// ✅ Production-safe rate limiter (express-rate-limit)
const { authLimiter } = require("../config/rateLimiter");

// ✅ Input sanitization middleware
const { sanitizeMiddleware } = require("../middlewares/sanitize");

const router = express.Router();

router.post(
    "/register",
    upload.single("certificate"),
    sanitizeMiddleware(["name", "email", "bio", "role", "expertise"]),
    signup
);
router.route("/login").post(
    authLimiter,
    sanitizeMiddleware(["email"]),
    login
);


router.post("/forgot-password", authLimiter, sanitizeMiddleware(["email"]), forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/logout",  authentication, logout);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", authLimiter, sanitizeMiddleware(["email"]), resendVerification);

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
