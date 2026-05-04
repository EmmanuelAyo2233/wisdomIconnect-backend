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

const { getMenteeProfileById } = require("../controllers/menteescontroller");
router.route("/mentee/:id").get(authentication, getMenteeProfileById);

module.exports = router;

