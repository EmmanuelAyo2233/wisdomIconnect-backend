const { express } = require("../config/reuseablePackages");
const { authentication } = require("../controllers/authcontrollers");
const {
    createPost,
    deletePost,
    getAllPost,
    getFullPost,
    updatePost,
} = require("../controllers/postcontroller");

const router = express.Router();

// Get all post
router.route("/").get(getAllPost);

// Get post details by Id
router.route("/:id").get(getFullPost);

// Create Post
router.route("/add").post(authentication, createPost);

// Update Post
router.route("/update/:id").patch(authentication, updatePost);

// Delete Post
router.route("/delete/:id").delete(authentication, deletePost);

module.exports = router;
