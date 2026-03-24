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
const { upload } = require("../utils/cloudinary");

const router = express.Router();

router.post("/register", upload.single("certificate"), signup);
router.route("/login").post(login);

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
