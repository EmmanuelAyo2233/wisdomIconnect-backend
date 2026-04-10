const express = require("express");
const { authentication, restrictTo } = require("../controllers/authcontrollers");
const {
    createPlaybook,
    getAllPlaybooks,
    getMentorPlaybooks, // new
    getPlaybookDetails,
    getPendingPlaybooks,
    approvePlaybook,
    deletePlaybook,
    updatePlaybook, // new
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
router.post("/create", authentication, restrictTo("mentor"), createPlaybook);
router.put("/:id", authentication, restrictTo("mentor"), updatePlaybook); // update existing

// Details route (place after /mine so it doesn't conflict)
router.get("/:id", authentication, getPlaybookDetails);

// Admin routes
router.get("/admin/pending", authentication, restrictTo("admin"), getPendingPlaybooks);
router.put("/:id/approve", authentication, restrictTo("admin"), approvePlaybook);

// Admin or Owner routes
router.delete("/:id", authentication, deletePlaybook);

// Anyone logged in can like/save a playbook
router.post("/:id/like", authentication, likePlaybook);
router.post("/:id/save", authentication, savePlaybook);
router.get("/user/saved", authentication, getSavedPlaybooks);

// Comments
router.get("/:id/comments", authentication, getPlaybookComments);
router.post("/:id/comments", authentication, addPlaybookComment);
router.get("/:id/comments/:commentId/replies", authentication, getPlaybookReplies);
router.put("/:id/comments/:commentId", authentication, updatePlaybookComment);
router.delete("/:id/comments/:commentId", authentication, deletePlaybookComment);

module.exports = router;
