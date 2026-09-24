const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/sessionController");
const { authentication } = require("../controllers/authcontrollers");
const { sanitizeMiddleware } = require("../middlewares/sanitize");

// Mark session complete (accessible by both mentor and mentee)
router.post("/:appointmentId/complete", authentication, sessionController.markSessionComplete);

// Join call session
router.post("/:appointmentId/join", authentication, sessionController.joinSession);

// End call session
router.post("/:appointmentId/end", authentication, sessionController.endSession);

// Mentee review mentor (Sanitized)
router.post(
    "/:appointmentId/review",
    authentication,
    sanitizeMiddleware(["comment", "teachingQuality", "communication", "helpfulness", "recommend"]),
    sessionController.submitReview
);

// Mentor commendate mentee (Sanitized)
router.post(
    "/:appointmentId/commendation",
    authentication,
    sanitizeMiddleware(["comment", "strengths", "badge"]),
    sessionController.submitCommendation
);

// Delete a review (only the mentee who wrote it)
router.delete("/review/:reviewId", authentication, sessionController.deleteReview);

// Delete a commendation (only the mentor who wrote it)
router.delete("/commendation/:commendationId", authentication, sessionController.deleteCommendation);

module.exports = router;
