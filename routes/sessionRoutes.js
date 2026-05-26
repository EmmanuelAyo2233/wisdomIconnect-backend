const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/sessionController");
const { authentication } = require("../controllers/authcontrollers");

// Mark session complete (accessible by both mentor and mentee)
router.post("/:appointmentId/complete", authentication, sessionController.markSessionComplete);

// Join call session
router.post("/:appointmentId/join", authentication, sessionController.joinSession);

// End call session
router.post("/:appointmentId/end", authentication, sessionController.endSession);

// Mentee review mentor
router.post("/:appointmentId/review", authentication, sessionController.submitReview);

// Mentor commendate mentee
router.post("/:appointmentId/commendation", authentication, sessionController.submitCommendation);

module.exports = router;
