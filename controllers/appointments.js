const db = require("../config/db");
const Appointment = require("../models/appointment");
const Notification = require("../models/notification");
const Mentor = require("../models/mentor");
const Mentee = require("../models/mentee");
const Availability = require("../models/availability");
const User = require("../models/user");

// =====================
// 📅 MENTEE ACTIONS
// =====================
// ✅ Book appointment
exports.bookAppointment = async (req, res) => {
  try {
    const mentorUserId = req.params.id;
    const menteeUserId = req.user.id;
    const { date, startTime, endTime, topic, goals } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        status: "fail",
        message: "Date, start time, and end time are required ❌",
      });
    }

    // ✅ Find mentor
    const mentor = await Mentor.findOne({ where: { user_id: mentorUserId } });
    if (!mentor) {
      return res.status(404).json({
        status: "fail",
        message: "Mentor not found ❌",
      });
    }

    // ✅ Find mentee
    const mentee = await Mentee.findOne({ where: { user_id: menteeUserId } });
    if (!mentee) {
      return res.status(404).json({
        status: "fail",
        message: "Mentee not found ❌",
      });
    }

    // ✅ Check slot availability
    console.log("Booking slot for:", { mentorUserId, date, startTime, endTime });
    const availabilitySlot = await Availability.findOne({
      where: {
        mentorId: mentorUserId, // ✅ fixed: use user id
        date,
        startTime,
        endTime,
        status: "available",
      },
    });

    if (!availabilitySlot) {
      return res.status(400).json({
        status: "fail",
        message: "This slot is already booked or unavailable ❌",
      });
    }

    // ✅ Create appointment
    const appointment = await Appointment.create({
      mentorId: mentor.id,
      menteeId: mentee.id,
      date,
      startTime,
      endTime,
      topic,
      goals,
      status: "pending",
    });

    // ✅ Mark slot as booked
    await Promise.all([
      availabilitySlot.update({ status: "booked" }),
      appointment.update({ slotId: availabilitySlot.id }),
    ]);
    // ✅ Notify mentor
await Notification.create({
  receiverId: mentor.id,
  receiverType: "mentor",
  senderId: mentee.id,
  message: `📅 New booking request from ${req.user.name} for ${date} at ${startTime}`,
  type: "booking",
  isRead: false,
});



    res.status(201).json({
      status: "success",
      message: "Appointment booked successfully ✅ Slot marked as booked 🔔",
      data: appointment,
    });
  } catch (error) {
    console.error("Error booking appointment:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to book appointment ❌",
      error: error.message,
    });
  }
};


// ✅ Cancel appointment
exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find mentee record linked to this user
    const mentee = await Mentee.findOne({ where: { user_id: userId } });
    if (!mentee) {
      return res.status(404).json({
        status: "fail",
        message: "Mentee not found ❌",
      });
    }

    // Find the appointment that belongs to this mentee
    const appointment = await Appointment.findOne({
      where: { id, menteeId: mentee.id },
    });

    if (!appointment) {
      return res.status(404).json({
        status: "fail",
        message: "Appointment not found ❌",
      });
    }

    await appointment.update({ status: "cancelled" });

    res.status(200).json({
      status: "success",
      message: "Appointment cancelled ✅",
      data: appointment,
    });
  } catch (error) {
    console.error("❌ Error cancelling appointment:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to cancel appointment ❌",
      error: error.message,
    });
  }
};


// ✅ Get all appointments for a specific mentee
exports.getMenteeAppointments = async (req, res) => {
  try {
    const menteeUserId = req.user.id;

    // 🧠 Find the mentee record linked to this user
    const mentee = await Mentee.findOne({ where: { user_id: menteeUserId } });
    if (!mentee) {
      return res.status(404).json({
        status: "fail",
        message: "Mentee not found ❌",
      });
    }

    // 🧩 Fetch appointments including mentor’s user info
    const appointments = await Appointment.findAll({
      where: { menteeId: mentee.id },
      include: [
        {
          model: Mentor,
          as: "mentor", // ✅ use alias from Appointment model
          include: [
            {
              model: User,
              as: "user", // ✅ alias from Mentor model in index.js
              attributes: ["id", "name", "picture",],
            },
          ],
        },
      ],
      order: [["date", "ASC"]],
    });

    if (!appointments || appointments.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: "No appointments found ❌",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Mentee appointments fetched successfully ✅",
      data: appointments,
    });
  } catch (error) {
    console.error("❌ Error fetching mentee appointments:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch mentee appointments ❌",
      error: error.message,
    });
  }
};




// ✅ Delete appointment
exports.deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const menteeUserId = req.user.id; // logged-in mentee user

    // ✅ Find the mentee linked to this user
    const mentee = await Mentee.findOne({ where: { user_id: menteeUserId } });
    if (!mentee) {
      return res.status(404).json({
        status: "fail",
        message: "Mentee not found ❌",
      });
    }

    // ✅ Find appointment that belongs to this mentee
    const appointment = await Appointment.findOne({
      where: { id, menteeId: mentee.id },
    });

    if (!appointment) {
      return res.status(404).json({
        status: "fail",
        message: "Appointment not found ❌",
      });
    }

    // ✅ Delete appointment
    await appointment.destroy();

    res.status(200).json({
      status: "success",
      message: "Appointment deleted successfully ✅",
    });
  } catch (error) {
    console.error("❌ Error deleting appointment:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete appointment ❌",
      error: error.message,
    });
  }
};

// =====================
// 🧑🏽‍🏫 MENTOR ACTIONS
// =====================

// ✅ View all mentor appointments
exports.getMentorAppointments = async (req, res) => {
  try {
    const mentorUserId = req.user.id;

    // 🧠 Find the mentor record linked to this user
    const mentor = await Mentor.findOne({ where: { user_id: mentorUserId } });
    if (!mentor) {
      return res.status(404).json({
        status: "fail",
        message: "Mentor not found ❌",
      });
    }

    // 🧩 Fetch appointments including mentee info
    const appointments = await Appointment.findAll({
      where: { mentorId: mentor.id },
      include: [
        {
          model: Mentee,
          as: "mentee",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "name", "picture"],
            },
          ],
        },
      ],
      order: [["date", "ASC"]],
    });

    res.status(200).json({
      status: "success",
      message: "Mentor appointments fetched successfully ✅",
      data: appointments,
    });
  } catch (error) {
    console.error("❌ Error fetching mentor appointments:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch mentor appointments ❌",
      error: error.message,
    });
  }
};

// ✅ Accept appointment
exports.acceptAppointment = async (req, res) => {
  try {
    const mentorUserId = req.user.id;

    // 🧠 Find the mentor record linked to this user
    const mentor = await Mentor.findOne({ where: { user_id: mentorUserId } });
    if (!mentor) return res.status(404).json({ status: "fail", message: "Mentor not found ❌" });

    const appointment = await Appointment.findOne({
      where: { id: req.params.id, mentorId: mentor.id },
    });

    if (!appointment) {
      return res.status(404).json({ status: "fail", message: "Appointment not found ❌" });
    }

    appointment.status = "accepted";
    await appointment.save();

    // Create notification
await Notification.create({
  receiverId: appointment.menteeId,
  receiverType: "mentee",
  senderId: mentor.id,
  message: "✅ Your appointment has been accepted!",
  type: "booking",
  isRead: false,
});



    res.json({ status: "success", message: "Appointment accepted successfully ✅", data: appointment });
  } catch (error) {
    console.error("❌ Accept appointment error:", error);
    res.status(500).json({ status: "error", message: "Server error ❌", error: error.message });
  }
};

// ✅ Reject appointment
exports.rejectAppointment = async (req, res) => {
  try {
    const mentorUserId = req.user.id;
    const mentor = await Mentor.findOne({ where: { user_id: mentorUserId } });
    if (!mentor) return res.status(404).json({ status: "fail", message: "Mentor not found ❌" });

    const appointment = await Appointment.findOne({
      where: { id: req.params.id, mentorId: mentor.id },
    });
    if (!appointment) return res.status(404).json({ status: "fail", message: "Appointment not found ❌" });

    appointment.status = "rejected";
    await appointment.save();

    res.status(200).json({ status: "success", message: "Appointment rejected ✅", data: appointment });
  } catch (error) {
    console.error("❌ Reject appointment error:", error);
    res.status(500).json({ status: "error", message: "Failed to reject ❌", error: error.message });
  }
};

// ✅ Mentor reschedules appointment
exports.mentorRescheduleAppointment = async (req, res) => {
  try {
    const mentorUserId = req.user.id;
    const mentor = await Mentor.findOne({ where: { user_id: mentorUserId } });
    if (!mentor) return res.status(404).json({ status: "fail", message: "Mentor not found ❌" });

    const appointment = await Appointment.findOne({
      where: { id: req.params.id, mentorId: mentor.id },
    });
    if (!appointment) return res.status(404).json({ status: "fail", message: "Appointment not found ❌" });

    const { date, startTime, endTime, rescheduleReason } = req.body;

    appointment.date = date || appointment.date;
    appointment.startTime = startTime || appointment.startTime;
    appointment.endTime = endTime || appointment.endTime;
    appointment.rescheduleReason = rescheduleReason || "Mentor requested reschedule";
    appointment.status = "mentor-rescheduled";

    await appointment.save();

    res.status(200).json({ status: "success", message: "Appointment rescheduled ✅", data: appointment });
  } catch (error) {
    console.error("❌ Reschedule appointment error:", error);
    res.status(500).json({ status: "error", message: "Failed to reschedule ❌", error: error.message });
  }
};



// // ✅ Get notifications for logged-in user
// exports.getNotifications = async (req, res) => {
//   try {
//     const userType = req.user.role; // mentor or mentee
//     const whereClause =
//       userType === "mentor"
//         ? { mentorId: req.user.id }
//         : { menteeId: req.user.id };

//     const notifications = await Notification.findAll({
//       where: whereClause,
//       order: [["createdAt", "DESC"]],
//     });

//     res.status(200).json({
//       status: "success",
//       message: "Notifications fetched successfully ✅",
//       data: notifications,
//     });
//   } catch (error) {
//     console.error("Error fetching notifications:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Failed to fetch notifications ❌",
//       error: error.message,
//     });
//   }
// };

// // ✅ Mark notification as read
// exports.markAsRead = async (req, res) => {
//   try {
//     const notif = await Notification.findByPk(req.params.id);
//     if (!notif)
//       return res.status(404).json({ message: "Notification not found ❌" });

//     notif.read = true;
//     await notif.save();

//     res.json({ status: "success", message: "Notification marked as read ✅" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ status: "error", message: "Failed to update notification ❌" });
//   }
// };
