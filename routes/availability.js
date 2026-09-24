const express = require("express");
const router = express.Router();
const {
  createAvailability,
  getMentorAvailability,
  updateAvailabilityStatus,
  deleteAvailability,
  getAvailabilityByMentorId,
} = require("../controllers/availabilityController");

const { authentication, restrictTo } = require("../controllers/authcontrollers");
const { sanitizeMiddleware } = require("../middlewares/sanitize");

// ✅ Public route — mentee can view mentor availability
router.get("/:mentorId", getAvailabilityByMentorId);

// ✅ Protected mentor routes
router.use(authentication);
router.use(restrictTo("mentor"));

// ✅ Mentor-only routes (with input sanitization for session texts)
router.post(
  "/",
  sanitizeMiddleware(["title", "topic_name", "session_title"]),
  createAvailability
);
router.get("/", getMentorAvailability);
router.put(
  "/:id",
  sanitizeMiddleware(["title", "topic_name", "session_title"]),
  updateAvailabilityStatus
);
router.delete("/:id", deleteAvailability);

module.exports = router;
