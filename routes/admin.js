const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authentication, restrictTo } = require("../controllers/authcontrollers");

// Admin routes
router.use(authentication);
router.use(restrictTo("admin"));

router.get("/users", adminController.getAllUsers);
router.get("/pending-mentors", adminController.getPendingMentors);
router.put("/approve-mentor/:id", adminController.approveMentor);
router.put("/reject-mentor/:id", adminController.rejectMentor);
// routes/admin.js
router.get("/stats", adminController.getStats);
router.get("/mentees", adminController.getMentees)
router.get("/approved-mentors", adminController.getApprovedMentors);
router.delete("/delete-mentor/:id", adminController.deleteMentor);
// Get rejected mentors
router.get("/rejected-mentors", adminController.getRejectedMentors);

router.put("/reconsider-mentor/:id", adminController.reconsiderMentor);
router.get("/mentees", adminController.getMentees);
router.delete("/mentee/:id", adminController.deleteMentee);

router.post("/suspend-user/:id", adminController.suspendUser);
router.post("/ban-user/:id", adminController.banUser);
router.post("/warn-user/:id", adminController.warnUser);
router.get("/user-activity/:id", adminController.getUserActivity);

// Disputes, Reviews & Commendations audit panel routes
router.get("/reviews", adminController.getReviewsForAdmin);
router.get("/commendations", adminController.getCommendationsForAdmin);
router.get("/disputes", adminController.getDisputedSessions);
router.put("/disputes/:appointmentId/resolve", adminController.resolveDispute);

module.exports = router;
