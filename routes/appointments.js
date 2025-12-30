const express = require("express");
const router = express.Router();

const {
  bookAppointment,
  getMenteeAppointments,
  cancelAppointment,
  deleteAppointment,
  getMentorAppointments,
  acceptAppointment,
  rejectAppointment,
  mentorRescheduleAppointment,
  getNotifications,
  markAsRead // ✅ added
} = require("../controllers/appointments"); // make sure this matches your controller file name

const { authentication, restrictTo } = require("../controllers/authcontrollers");

// ========================
// 📅 MENTEE ROUTES
// ========================

// Book appointment with mentor
router.post("/book/:id", authentication, restrictTo("mentee"), bookAppointment);

// Get all appointments for logged-in mentee
router.get("/mentee", authentication, restrictTo("mentee"), getMenteeAppointments);

// Reschedule appointment
// router.put("/:id/reschedule", authentication, restrictTo("mentee"), rescheduleAppointment);

// Cancel appointment
router.put("/:id/cancel", authentication, restrictTo("mentee"), cancelAppointment);

// Delete appointment
router.delete("/:id", authentication, restrictTo("mentee"), deleteAppointment);


// ========================
// 🧑🏽‍🏫 MENTOR ROUTES
// ========================

// Get all appointments for logged-in mentor
router.get("/mentor", authentication, restrictTo("mentor"), getMentorAppointments);

// Accept appointment
router.put("/:id/accept", authentication, restrictTo("mentor"), acceptAppointment);

// Reject appointment
router.put("/:id/reject", authentication, restrictTo("mentor"), rejectAppointment);

// Mentor reschedules appointment
router.put("/:id/mentor-reschedule", authentication, restrictTo("mentor"), mentorRescheduleAppointment);

// ✅ Get mentor notifications


// Unified notifications route
router.get("/notifications", authentication, getNotifications);
router.put("/notifications/:id/read", authentication, markAsRead);


module.exports = router;
