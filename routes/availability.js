const express = require("express");
const router = express.Router();
const {
  createAvailability,
  getMentorAvailability,
  updateAvailabilityStatus,
  deleteAvailability,
  getAvailabilityByMentorId, // ✅ New controller for mentee view
} = require("../controllers/availabilityController");

const { authentication, restrictTo } = require("../controllers/authcontrollers");

// ✅ Public route — mentee can view mentor availability
router.get("/:mentorId", getAvailabilityByMentorId);

// ✅ Protected mentor routes
router.use(authentication);
router.use(restrictTo("mentor"));

// ✅ Mentor-only routes
router.post("/", createAvailability);
router.get("/", getMentorAvailability);
router.put("/:id", updateAvailabilityStatus);
router.delete("/:id", deleteAvailability);

module.exports = router;
