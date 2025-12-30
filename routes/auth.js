const { express } = require("../config/reuseablePackages");
const {
    signup,
    login,
    resetPassword,
    approveMentor,
    rejectMentor,
    authentication,
    restrictTo,
    logout,  // <-- import it
} = require("../controllers/authcontrollers"); // make sure the name matches your controller

const router = express.Router();

// Public routes
router.route("/register").post(signup);
router.route("/login").post(login);
router.route("/reset").patch(resetPassword);
router.post("/logout",  authentication, logout);


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
