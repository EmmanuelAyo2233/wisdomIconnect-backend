const { express } = require("../config/reuseablePackages");
const { authentication } = require("../controllers/authcontrollers");
const { sanitizeMiddleware } = require("../middlewares/sanitize");
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

// Get Comment by id
router.route("/:id").get(getFullComment);

// Comment on a post by id (Sanitized)
router.route("/add/:id").post(
    authentication,
    sanitizeMiddleware(["comment", "content"]),
    createComment
);

// Update comment on a post (Sanitized)
router.route("/update/:id").patch(
    authentication,
    sanitizeMiddleware(["comment", "content"]),
    updateComment
);

// Delete comment on a post
router.route("/delete/:id").delete(authentication, deleteComment);

module.exports = router;
