const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

// Admin routes
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

module.exports = router;
