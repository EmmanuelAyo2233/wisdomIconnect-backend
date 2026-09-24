const { express } = require("../config/reuseablePackages");
const { authentication } = require("../controllers/authcontrollers");
const { sanitizeMiddleware } = require("../middlewares/sanitize");
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

// Create Post (Sanitized)
router.route("/add").post(
    authentication,
    sanitizeMiddleware(["title", "content", "category", "tags"]),
    createPost
);

// Update Post (Sanitized)
router.route("/update/:id").patch(
    authentication,
    sanitizeMiddleware(["title", "content", "category", "tags"]),
    updatePost
);

// Delete Post
router.route("/delete/:id").delete(authentication, deletePost);

module.exports = router;
