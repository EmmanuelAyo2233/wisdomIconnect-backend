const {
  HttpError,
  positiveId,
  text,
  respondError,
} = require("../utils/security");
const { appointmentFor } = require("../services/authorizationService");
const db = require("../config/db");
const Appointment = require("../models/appointment");
const Notification = require("../models/notification");
const Mentor = require("../models/mentor");
const Mentee = require("../models/mentee");
const Availability = require("../models/availability");
const User = require("../models/user");
const Review = require("../models/review");
const MentorCommendation = require("../models/mentorCommendation");
const PlatformSetting = require("../models/platformSetting");

const notificationService = require("../services/notificationService");
const { logActivity } = require("../services/activityLogger");

// =====================
// 📅 MENTEE ACTIONS
// =====================
// ✅ Book appointment
exports.bookAppointment = async (req, res) => {
  try {
    const { appointment } = await require("../services/bookingService").reserve(
      req.user,
      req.body,
      req.params.id,
      false,
    );
    res.status(201).json({ status: "success", data: appointment });
  } catch (error) {
    respondError(res, error);
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(positiveId(req.params.id));
    await appointmentFor(req.user, appointment);
    if (
      !["pending", "accepted", "mentor-rescheduled"].includes(
        appointment.status,
      )
    )
      throw new HttpError(409, "This session cannot be cancelled");
    if (appointment.sessionType === "paid") {
      await require("../services/financeService").requestRefund(
        appointment.id,
        req.user,
        "Session cancelled",
      );
    } else {
      await db.transaction(async (transaction) => {
        const current = await Appointment.findByPk(appointment.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (
          !["pending", "accepted", "mentor-rescheduled"].includes(
            current.status,
          )
        )
          throw new HttpError(409, "Session status changed");
        await current.update({ status: "cancelled" }, { transaction });
        if (current.slotId)
          await Availability.update(
            { status: "available" },
            { where: { id: current.slotId }, transaction },
          );
      });
    }
    res.json({
      status: "success",
      message:
        "Cancellation recorded. Paid refunds remain pending until confirmed by the payment provider.",
    });
  } catch (error) {
    respondError(res, error);
  }
};

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
              attributes: ["id", "name", "picture"],
            },
          ],
        },
        { model: Review, as: "review" },
        { model: MentorCommendation, as: "commendation" },
        { model: require("../models").Payment, as: "payment" },
      ],
      order: [["date", "ASC"]],
    });

    res.status(200).json({
      status: "success",
      message:
        appointments.length > 0
          ? "Mentee appointments fetched successfully ✅"
          : "No appointments yet",
      data: appointments || [],
    });
  } catch (error) {
    require('../utils/logger').error("❌ Error fetching mentee appointments:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch mentee appointments ❌",
    });
  }
};

// ✅ Delete appointment
exports.deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(positiveId(req.params.id));
    await appointmentFor(req.user, appointment);
    if (
      !["cancelled", "rejected"].includes(appointment.status) ||
      appointment.sessionType === "paid"
    )
      throw new HttpError(
        409,
        "Financial and active sessions must remain in your history",
      );
    await appointment.update({ status: "deleted" });
    res.json({ status: "success", message: "Session archived" });
  } catch (error) {
    respondError(res, error);
  }
};

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
        { model: require("../models").Payment, as: "payment" },
      ],
      order: [["date", "ASC"]],
    });

    res.status(200).json({
      status: "success",
      message: "Mentor appointments fetched successfully ✅",
      data: appointments || [],
    });
  } catch (error) {
    require('../utils/logger').error("❌ Error fetching mentor appointments:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch mentor appointments ❌",
    });
  }
};

// ✅ Accept appointment
exports.acceptAppointment = async (req, res) => {
  try {
    const appointment = await db.transaction(async (transaction) => {
      const item = await Appointment.findByPk(positiveId(req.params.id), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      await appointmentFor(req.user, item);
      if (req.user.userType !== "mentor")
        throw new HttpError(403, "Only the mentor can accept");
      if (item.status === "accepted") return item;
      if (!["pending", "mentor-rescheduled"].includes(item.status))
        throw new HttpError(409, "Session is not pending");
      const Payment = require("../models/payment");
      const payment = await Payment.findOne({
        where: { appointmentId: item.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (
        item.sessionType === "paid" &&
        (!payment || payment.status !== "pending")
      )
        throw new HttpError(409, "Payment requires reconciliation");
      const meetingId = item.meetingId || require("crypto").randomUUID();
      await item.update(
        { status: "accepted", meetingId, meetingLink: `/call/${meetingId}` },
        { transaction },
      );
      await require("../services/bookingNotificationService").record(
        item,
        "Session accepted",
        transaction,
      );
      return item;
    });
    res.json({ status: "success", data: appointment });
  } catch (error) {
    respondError(res, error);
  }
};

exports.rejectAppointment = async (req, res) => {
  try {
    if (req.user.userType !== "mentor")
      throw new HttpError(403, "Only mentors can reject");
    req.body = {};
    return exports.cancelAppointment(req, res);
  } catch (error) {
    respondError(res, error);
  }
};

exports.mentorRescheduleAppointment = async (req, res) => {
  try {
    if (req.user.userType !== "mentor")
      throw new HttpError(403, "Mentor required");
    const item = await db.transaction(async (transaction) => {
      const a = await Appointment.findByPk(positiveId(req.params.id), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      await appointmentFor(req.user, a);
      if (!["pending", "accepted", "mentor-rescheduled"].includes(a.status))
        throw new HttpError(409, "Session cannot be rescheduled");
      await Mentor.findByPk(a.mentorId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const slot = await Availability.findOne({
        where: {
          mentorId: req.user.id,
          date: req.body.date,
          startTime: req.body.startTime,
          endTime: req.body.endTime,
          status: "available",
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (
        !slot ||
        new Date(`${slot.date}T${slot.startTime}+01:00`) <= new Date() ||
        Number(slot.price) !== Number(a.price)
      )
        throw new HttpError(
          409,
          "Choose a future available slot with the same price",
        );
      const { Op } = require("sequelize");
      if (
        await Appointment.findOne({
          where: {
            id: { [Op.ne]: a.id },
            date: slot.date,
            status: { [Op.notIn]: ["cancelled", "rejected", "deleted"] },
            startTime: { [Op.lt]: slot.endTime },
            endTime: { [Op.gt]: slot.startTime },
            [Op.or]: [{ mentorId: a.mentorId }, { menteeId: a.menteeId }],
          },
          transaction,
        })
      )
        throw new HttpError(409, "Session overlaps another booking");
      if (a.slotId)
        await Availability.update(
          { status: "available" },
          { where: { id: a.slotId }, transaction },
        );
      await slot.update({ status: "booked" }, { transaction });
      await a.update(
        {
          slotId: slot.id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: "mentor-rescheduled",
          rescheduleReason: text(
            req.body.rescheduleReason || "Mentor requested reschedule",
            "Reason",
            255,
          ),
        },
        { transaction },
      );
      await require("../services/bookingNotificationService").record(
        a,
        "Session rescheduled",
        transaction,
      );
      return a;
    });
    res.json({ status: "success", data: item });
  } catch (error) {
    respondError(res, error);
  }
};
