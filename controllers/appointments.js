const db = require("../config/db");
const Appointment = require("../models/appointment");
const Notification = require("../models/notification");
const Mentor = require("../models/mentor");
const Mentee = require("../models/mentee");
const Availability = require("../models/availability");
const User = require("../models/user");
const Review = require("../models/review");
const MentorCommendation = require("../models/mentorCommendation");
const { v4: uuidv4 } = require("uuid");
const notificationService = require("../services/notificationService");
const { logActivity } = require("../services/activityLogger");

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

    // ⛔ Extra Validation: Prevent same mentee booking overlapping slots
    const existingMenteeBooking = await Appointment.findOne({
      where: { menteeId: mentee.id, date, startTime, endTime }
    });
    if (existingMenteeBooking) {
      return res.status(400).json({ status: "fail", message: "You have already booked a session for this exact time ❌" });
    }

    // ⛔ Extra Validation: Prevent duplicate overall bookings for mentor slot
    const existingSlotBooking = await Appointment.findOne({
      where: { mentorId: mentor.id, date, startTime, endTime }
    });
    if (existingSlotBooking) {
      return res.status(400).json({ status: "fail", message: "This slot was just booked by someone else! Please pick another time ❌" });
    }

    // ⛔ Limit Validation: Max Sessions Per Day
    if (mentor.maxSessionsPerDay) {
       const sessionsTodayCount = await Appointment.count({
          where: { mentorId: mentor.id, date, status: ["pending", "accepted", "completed"] }
       });
       if (sessionsTodayCount >= mentor.maxSessionsPerDay) {
          return res.status(400).json({ status: "fail", message: `This mentor has reached their maximum daily limit of ${mentor.maxSessionsPerDay} sessions. Please choose another date ❌` });
       }
    }

    // ⛔ Date Validation: Must be future date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate.getTime() <= today.getTime()) {
      return res.status(400).json({ status: "fail", message: "Bookings must be strictly for future dates ❌" });
    }

    // ⛔ Enforce Pricing Validation at Booking
    const mentorUser = await User.findByPk(mentorUserId);
    const mentorLevel = mentorUser ? mentorUser.mentorLevel : "starter";
    const sessionAmount = req.body.amount !== undefined ? Number(req.body.amount) : Number(availabilitySlot.price) || 0;

    if (mentorLevel === "starter" && sessionAmount > 0) {
      return res.status(400).json({ status: "fail", message: "Starter mentors can only offer free sessions. ❌" });
    }
    if (mentorLevel === "verified" && sessionAmount > 20000) {
      return res.status(400).json({ status: "fail", message: "Verified mentors can charge up to 20,000 max. ❌" });
    }
    if (mentorLevel === "gold" && sessionAmount > 50000) {
      return res.status(400).json({ status: "fail", message: "Gold mentors can charge up to 50,000 max. ❌" });
    }

    // ✅ Create appointment
    const meetingId = mentor.autoAccept ? uuidv4() : null;
    const appointment = await Appointment.create({
      mentorId: mentor.id,
      menteeId: mentee.id,
      date,
      startTime,
      endTime,
      topic,
      goals,
      status: mentor.autoAccept ? "accepted" : "pending",
      meetingId: meetingId,
      meetingLink: meetingId ? `/call/${meetingId}` : null,
      sessionType: sessionAmount > 0 ? "paid" : "free"
    });

    // ✅ Mark slot as booked
    await Promise.all([
      availabilitySlot.update({ status: "booked" }),
      appointment.update({ slotId: availabilitySlot.id }),
    ]);

    // ✅ Payment Logic
    if (sessionAmount > 0) {
      if (!req.body.reference) {
         await appointment.destroy();
         await availabilitySlot.update({ status: "available" });
         return res.status(400).json({ status: "fail", message: "Payment reference is required for paid sessions ❌" });
      }

      const axios = require("axios");
      try {
         const paystackRes = await axios.get(`https://api.paystack.co/transaction/verify/${req.body.reference}`, {
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || 'sk_test_c869403811e92b7e632034bd5833823162354197'}` }
         });
         const txData = paystackRes.data.data;
         if (txData.status !== "success" || txData.amount / 100 < sessionAmount) {
             await appointment.destroy();
             await availabilitySlot.update({ status: "available" });
             return res.status(400).json({ status: "fail", message: "Payment verification failed or amount mismatch ❌" });
         }
      } catch (error) {
         await appointment.destroy();
         await availabilitySlot.update({ status: "available" });
         return res.status(500).json({ status: "error", message: "Failed to verify payment with Paystack" });
      }

      const platformShare = sessionAmount * 0.30;
      const mentorShare = sessionAmount * 0.70;

      const Payment = require("../models/payment");
      const paymentStatus = mentor.autoAccept ? "pending" : "awaiting_acceptance";
      const payment = await Payment.create({
        appointmentId: appointment.id,
        amount: sessionAmount,
        mentorShare,
        platformShare,
        reference: req.body.reference,
        status: paymentStatus
      });

      if (mentor.autoAccept) {
        const Wallet = require("../models/wallet");
        let wallet = await Wallet.findOne({ where: { userId: mentor.user_id } });
        if (!wallet) wallet = await Wallet.create({ userId: mentor.user_id, availableBalance: 0, pendingBalance: 0 });
        wallet.pendingBalance = Number(wallet.pendingBalance || 0) + mentorShare;
        await wallet.save();

        let admin = await User.findOne({ where: { userType: 'admin' } });
        if (admin) {
           let adminWallet = await Wallet.findOne({ where: { userId: admin.id } });
           if (!adminWallet) adminWallet = await Wallet.create({ userId: admin.id, availableBalance: 0, pendingBalance: 0 });
           adminWallet.pendingBalance = Number(adminWallet.pendingBalance || 0) + platformShare;
           await adminWallet.save();
        }
      }
    }

    // ✅ Notify mentor
    const actingUser = await User.findByPk(req.user.id);
    const actingName = actingUser ? actingUser.name : (req.user.name || "A Mentee");
    const paymentText = sessionAmount > 0 ? ` (Paid: ₦${sessionAmount.toLocaleString()})` : '';
    
    // Check Notification Prefs
    let notifPrefs = {};
    if (mentor.notifPrefs) {
      try { notifPrefs = typeof mentor.notifPrefs === 'string' ? JSON.parse(mentor.notifPrefs) : mentor.notifPrefs; } catch(e) {}
    }

    if (notifPrefs.booking_requests_app !== false) {
      const mentorUserObj = await User.findByPk(mentor.user_id);
      if (mentor.autoAccept) {
          notificationService.sendBookingAccepted(req.user, mentorUserObj, `Date: ${date}\nTime: ${startTime}\nTopic: ${topic}`, `/call/${meetingId}`).catch(console.error);
      } else {
          notificationService.sendBookingRequest(req.user, mentorUserObj, `Date: ${date}\nTime: ${startTime}\nTopic: ${topic}`).catch(console.error);
      }
    }

// ✅ Auto-create accepted connection
const Connection = require("../models/connection"); // Using this at the top logically, but we can do db.Connection.
// Actually, I'll require it here since I didn't require it explicitly at the top.
const ConnectionModel = require("../models/connection");

const existingConn = await ConnectionModel.findOne({
  where: { mentorId: mentor.id, menteeId: mentee.id }
});

if (!existingConn) {
  await ConnectionModel.create({
    mentorId: mentor.id,
    menteeId: mentee.id,
    status: "accepted"
  });
} else if (existingConn.status !== "accepted") {
  existingConn.status = "accepted";
  await existingConn.save();
}
    logActivity({
      type: "BOOKING",
      message: `${req.user.name} booked a session with Mentor ID ${appointment.mentorId} on ${appointment.date} at ${appointment.startTime}`,
      userId: req.user.id,
      targetId: appointment.id,
      status: "success",
      metadata: {
        mentorId: appointment.mentorId,
        topic: appointment.topic,
        sessionType: appointment.sessionType,
        amount: appointment.sessionAmount
      }
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

    // Notify mentor
    const mentorUserObj = await User.findByPk(appointment.mentorId, { include: [{ model: Mentor, as: "mentor" }] }); // Note: mentorId is the Mentor PK. Wait, mentorId is ID in Mentor table.
    const mentorRec = await Mentor.findByPk(appointment.mentorId);
    if (mentorRec) {
        const mentorUser = await User.findByPk(mentorRec.user_id);
        const menteeUser = await User.findByPk(mentee.user_id);
        if (mentorUser && menteeUser) {
           notificationService.sendNotification({
              receiverId: mentorRec.id,
              receiverType: "mentor",
              type: "booking",
              title: "Booking Cancelled",
              message: `❌ ${menteeUser.name} has cancelled the upcoming session on ${appointment.date}.`,
              emailData: {
                 to: mentorUser.email,
                 html: require("../utils/emailTemplates").bookingCancelled(mentorUser.name, menteeUser.name, "Mentee initiated cancellation")
              }
           }).catch(console.error);
        }
    }

    logActivity({
      type: "BOOKING",
      message: `${req.user.name} cancelled the session (Appointment ID ${appointment.id})`,
      userId: req.user.id,
      targetId: appointment.id,
      status: "success",
      metadata: {
        appointmentId: appointment.id,
        mentorId: appointment.mentorId,
        date: appointment.date,
        startTime: appointment.startTime
      }
    });

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
        { model: Review, as: "review" },
        { model: MentorCommendation, as: "commendation" },
        { model: require("../models").Payment, as: "payment" }
      ],
      order: [["date", "ASC"]],
    });

    res.status(200).json({
      status: "success",
      message: appointments.length > 0 ? "Mentee appointments fetched successfully ✅" : "No appointments yet",
      data: appointments || [],
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
        { model: Review, as: "review" },
        { model: MentorCommendation, as: "commendation" },
        { model: require("../models").Payment, as: "payment" }
      ],
      order: [["date", "ASC"]],
    });

    res.status(200).json({
      status: "success",
      message: "Mentor appointments fetched successfully ✅",
      data: appointments || [],
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

    const meetingId = uuidv4();
    appointment.status = "accepted";
    appointment.meetingId = meetingId;
    appointment.meetingLink = `/call/${meetingId}`;
    await appointment.save();
    
    // Escrow payment upon acceptance
    const Payment = require("../models").Payment;
    const Wallet = require("../models/wallet");
    const User = require("../models/user");
    
    const payment = await Payment.findOne({ where: { appointmentId: appointment.id } });
    if (payment && payment.status === "awaiting_acceptance") {
      payment.status = "pending";
      await payment.save();

      // Escrow mentor
      let wallet = await Wallet.findOne({ where: { userId: mentor.user_id } });
      if (!wallet) {
        wallet = await Wallet.create({ userId: mentor.user_id, availableBalance: 0, pendingBalance: 0 });
      }
      wallet.pendingBalance = Number(wallet.pendingBalance || 0) + payment.mentorShare;
      await wallet.save();

      // Escrow platform
      let admin = await User.findOne({ where: { userType: 'admin' } });
      if (admin) {
         let adminWallet = await Wallet.findOne({ where: { userId: admin.id } });
         if (!adminWallet) adminWallet = await Wallet.create({ userId: admin.id, availableBalance: 0, pendingBalance: 0 });
         adminWallet.pendingBalance = Number(adminWallet.pendingBalance || 0) + payment.platformShare;
         await adminWallet.save();
      }
    }

    // Create notification
    const menteeRec = await Mentee.findByPk(appointment.menteeId);
    const menteeUser = await User.findByPk(menteeRec.user_id);
    const mentorUserObj = await User.findByPk(mentor.user_id);
    
    notificationService.sendBookingAccepted(
      menteeUser, 
      mentorUserObj, 
      `Date: ${appointment.date}\nTime: ${appointment.startTime}`, 
      appointment.meetingLink
    ).catch(console.error);



    logActivity({
      type: "BOOKING",
      message: `Mentor ${req.user.name} approved the session request (Appointment ID ${appointment.id})`,
      userId: req.user.id,
      targetId: appointment.id,
      status: "success",
      metadata: {
        appointmentId: appointment.id,
        menteeId: appointment.menteeId,
        date: appointment.date,
        startTime: appointment.startTime
      }
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

    // Handle refund logic
    const Payment = require("../models").Payment;
    const payment = await Payment.findOne({ where: { appointmentId: appointment.id } });
    if (payment && payment.status === "awaiting_acceptance") {
       payment.status = "refunded";
       await payment.save();
    }

    const menteeRec = await Mentee.findByPk(appointment.menteeId);
    const menteeUser = await User.findByPk(menteeRec.user_id);
    const mentorUserObj = await User.findByPk(mentor.user_id);

    notificationService.sendNotification({
      receiverId: appointment.menteeId,
      receiverType: "mentee",
      type: "booking",
      title: "Booking Declined",
      message: "❌ Your appointment was declined by the mentor.",
      emailData: {
         to: menteeUser.email,
         html: require("../utils/emailTemplates").bookingDeclined(menteeUser.name, mentorUserObj.name, "Mentor unavailable")
      }
    }).catch(console.error);

    logActivity({
      type: "BOOKING",
      message: `Mentor ${req.user.name} declined the session request (Appointment ID ${appointment.id})`,
      userId: req.user.id,
      targetId: appointment.id,
      status: "success",
      metadata: {
        appointmentId: appointment.id,
        menteeId: appointment.menteeId,
        date: appointment.date,
        startTime: appointment.startTime
      }
    });

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

    const menteeRec = await Mentee.findByPk(appointment.menteeId);
    const menteeUser = await User.findByPk(menteeRec.user_id);

    notificationService.sendNotification({
      receiverId: appointment.menteeId,
      receiverType: "mentee",
      type: "update",
      title: "Session Rescheduled",
      message: `🔄 Your appointment was rescheduled to ${appointment.date} at ${appointment.startTime}.`,
      emailData: {
         to: menteeUser.email,
         html: require("../utils/emailTemplates").sessionReminder(menteeUser.name, mentor.user?.name || "Your mentor", `${appointment.date} at ${appointment.startTime}`, appointment.meetingLink || "#")
      }
    }).catch(console.error);

    logActivity({
      type: "BOOKING",
      message: `Mentor ${req.user.name} rescheduled the session (Appointment ID ${appointment.id}) to ${appointment.date} at ${appointment.startTime}`,
      userId: req.user.id,
      targetId: appointment.id,
      status: "success",
      metadata: {
        appointmentId: appointment.id,
        newDate: appointment.date,
        newStartTime: appointment.startTime,
        rescheduleReason: appointment.rescheduleReason
      }
    });

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
