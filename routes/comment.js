const { express } = require("../config/reuseablePackages");
const { authentication } = require("../controllers/authcontrollers");
const {
    createComment,
    deleteComment,
    getAllComment,
    getFullComment,
    updateComment,
} = require("../controllers/commentcontroller");

const router = express.Router();

// Get all Comments
router.route("/").get(getAllComment);

// Get Cmment by id
router.route("/:id").get(getFullComment);

// Comment on a post by id
router.route("/add/:id").post(authentication, createComment);

// Update comment on a post
router.route("/update/:id").patch(authentication, updateComment);

// Delete comment on a post
router.route("/delete/:id").delete(authentication, deleteComment);

module.exports = router;
