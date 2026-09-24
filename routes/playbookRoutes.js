const express = require("express");
const { authentication, restrictTo } = require("../controllers/authcontrollers");
const { sanitizeMiddleware } = require("../middlewares/sanitize");
const {
    createPlaybook,
    getAllPlaybooks,
    getMentorPlaybooks,
    getPlaybookDetails,
    getAdminPlaybooks,
    approvePlaybook,
    deletePlaybook,
    updatePlaybook,
    likePlaybook,
    savePlaybook,
    getSavedPlaybooks,
    addPlaybookComment,
    getPlaybookComments,
    updatePlaybookComment,
    deletePlaybookComment,
    getPlaybookReplies,
} = require("../controllers/playbookController");

const router = express.Router();

// Public routes
router.get("/", authentication, getAllPlaybooks);

// Mentor routes
router.get("/mine", authentication, restrictTo("mentor"), getMentorPlaybooks);
router.post(
    "/create",
    authentication,
    restrictTo("mentor"),
    sanitizeMiddleware(["title", "description", "category", "content"]),
    createPlaybook
);
router.put(
    "/:id",
    authentication,
    restrictTo("mentor"),
    sanitizeMiddleware(["title", "description", "category", "content"]),
    updatePlaybook
);

// Details route (place after /mine so it doesn't conflict)
router.get("/:id", authentication, getPlaybookDetails);

// Admin routes
router.get("/admin/all", authentication, restrictTo("admin"), getAdminPlaybooks);
router.put("/:id/approve", authentication, restrictTo("admin"), approvePlaybook);

// Admin or Owner routes
router.delete("/:id", authentication, deletePlaybook);

// Anyone logged in can like/save a playbook
router.post("/:id/like", authentication, likePlaybook);
router.post("/:id/save", authentication, savePlaybook);
router.get("/user/saved", authentication, getSavedPlaybooks);

// Comments (Sanitized)
router.get("/:id/comments", authentication, getPlaybookComments);
router.post(
    "/:id/comments",
    authentication,
    sanitizeMiddleware(["comment", "reply", "content"]),
    addPlaybookComment
);
router.get("/:id/comments/:commentId/replies", authentication, getPlaybookReplies);
router.put(
    "/:id/comments/:commentId",
    authentication,
    sanitizeMiddleware(["comment", "reply", "content"]),
    updatePlaybookComment
);
router.delete("/:id/comments/:commentId", authentication, deletePlaybookComment);

module.exports = router;
