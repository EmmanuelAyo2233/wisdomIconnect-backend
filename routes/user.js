const { express } = require("../config/reuseablePackages");
const { upload } = require("../utils/cloudinary");
const {
    getdetails,
    updateDetails,
    uploadprofilePicture,
    deleteAccount,
} = require("../controllers/usercontroller");
const { authentication } = require("../controllers/authcontrollers");

const router = express.Router();

// Route to get user details
router.route("/me").get(authentication, getdetails);
// Route to update user details
router.route("/me/update").patch(authentication, updateDetails);
// Route to upload profile picture
router
    .route("/me/picture")
    .patch(authentication, upload.single("picture"), uploadprofilePicture);
// Route to delete user account
router.route("/me/delete").delete(authentication, deleteAccount);

module.exports = router;
