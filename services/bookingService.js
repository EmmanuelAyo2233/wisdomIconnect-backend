const crypto = require("crypto");
const { Op } = require("sequelize");
const {
  HttpError,
  positiveId,
  text,
  accountEligible,
} = require("../utils/security");
const { toMinor, fromMinor, split } = require("../utils/money");
const models = () => require("../models");

async function reserve(user, body, mentorUserId, paid) {
  if (user.userType !== "mentee")
    throw new HttpError(403, "Only mentees can book sessions");
  return models().db.sequelize.transaction(async (transaction) => {
    const { Mentor, Mentee, User, Availability, Appointment, PlatformSetting } =
      models();
    // Parent locks prevent overlapping reservations even when different slots overlap.
    const mentee = await Mentee.findOne({
      where: { user_id: user.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (paid &&
      (await Appointment.count({
        where: { menteeId: mentee?.id || 0, status: "pending_payment" },
        transaction,
      })) >= 2
    )
      throw new HttpError(
        409,
        "Resolve your pending payment reservations before booking more paid sessions",
      );
    if (!mentee) throw new HttpError(403, "Mentee profile required");
    const slotLookup = body.slotId
      ? { id: positiveId(body.slotId) }
      : {
          mentorId: positiveId(mentorUserId),
          date: body.date,
          startTime: body.startTime,
          endTime: body.endTime,
        };
    const snapshot = await Availability.findOne({
      where: slotLookup,
      transaction,
    });
    if (!snapshot) throw new HttpError(404, "Availability slot not found");
    const mentor = await Mentor.findOne({
      where: { user_id: snapshot.mentorId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const owner =
      mentor && (await User.findByPk(mentor.user_id, { transaction }));
    if (!mentor || !accountEligible(owner) || owner.status !== "approved")
      throw new HttpError(409, "This mentor is unavailable");
    if (mentorUserId && Number(mentorUserId) !== Number(owner.id))
      throw new HttpError(400, "Mentor and slot do not match");
    const slot = await Availability.findByPk(snapshot.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (slot.status !== "available")
      throw new HttpError(409, "This slot is already reserved");
    const start = new Date(`${slot.date}T${slot.startTime}+01:00`);
    const end = new Date(`${slot.date}T${slot.endTime}+01:00`);
    if (
      !Number.isFinite(start.getTime()) ||
      start <= new Date() ||
      end <= start
    )
      throw new HttpError(400, "Choose a future valid session");
    const amount = toMinor(slot.price || 0);
    if (amount > 0 !== paid)
      throw new HttpError(
        400,
        paid
          ? "This is a free session"
          : "Initialize payment before booking this paid session",
      );
    if (
      paid &&
      (mentor.kyc_status !== "verified" ||
        owner.mentorLevel === "starter" ||
        amount > (owner.mentorLevel === "gold" ? 5000000 : 2000000))
    )
      throw new HttpError(409, "Mentor is not eligible for this paid session");
    const active = { [Op.notIn]: ["cancelled", "rejected", "deleted"] };
    const conflict = await Appointment.findOne({
      where: {
        date: slot.date,
        status: active,
        startTime: { [Op.lt]: slot.endTime },
        endTime: { [Op.gt]: slot.startTime },
        [Op.or]: [{ mentorId: mentor.id }, { menteeId: mentee.id }],
      },
      transaction,
    });
    if (conflict)
      throw new HttpError(409, "An overlapping session already exists");
    if (
      mentor.maxSessionsPerDay &&
      (await Appointment.count({
        where: { mentorId: mentor.id, date: slot.date, status: active },
        transaction,
      })) >= mentor.maxSessionsPerDay
    )
      throw new HttpError(409, "Mentor has reached the daily session limit");
    const meetingId = !paid && mentor.autoAccept ? crypto.randomUUID() : null;
    const appointment = await Appointment.create(
      {
        mentorId: mentor.id,
        menteeId: mentee.id,
        slotId: slot.id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        topic: text(body.topic, "Topic", 255),
        goals: text(body.goals || "", "Goals", 5000, false),
        price: fromMinor(amount),
        sessionType: paid ? "paid" : "free",
        status: paid
          ? "pending_payment"
          : mentor.autoAccept
            ? "accepted"
            : "pending",
        meetingId,
        meetingLink: meetingId ? `/call/${meetingId}` : null,
      },
      { transaction },
    );
    await slot.update({ status: "booked" }, { transaction });
    let intent;
    if (paid) {
      const setting = await PlatformSetting.findByPk(
        "platform_commission_rate",
        { transaction },
      );
      const commissionRate = setting ? Number(setting.value) : 10;
      split(amount, commissionRate);
      intent = await require("../models/paymentIntent").create(
        {
          reference: `wisi_${crypto.randomUUID()}`,
          userId: user.id,
          appointmentId: appointment.id,
          email: user.email,
          amountMinor: amount,
          commissionRate,
          currency: "NGN",
          expiresAt: new Date(Date.now() + 30 * 60000),
        },
        { transaction },
      );
    }
    if (!paid)
      await require("./bookingNotificationService").record(
        appointment,
        "Session booking submitted",
        transaction,
      );
    return { appointment, intent };
  });
}
module.exports = { reserve };
