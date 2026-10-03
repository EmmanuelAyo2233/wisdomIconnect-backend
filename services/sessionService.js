const { HttpError, positiveId, text } = require("../utils/security");
const { appointmentFor } = require("./authorizationService");
const finance = require("./financeService");
async function transition(user, id, action, body = {}) {
  const { db, Appointment, Payment } = require("../models");
  const result = await db.sequelize.transaction(async (transaction) => {
    const appointment = await Appointment.findByPk(positiveId(id), {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    await appointmentFor(user, appointment);
    if (appointment.status === "completed") return appointment;
    if (!["accepted", "ongoing", "call_ended"].includes(appointment.status))
      throw new HttpError(409, "Session is not active");
    const payment = await Payment.findOne({
      where: { appointmentId: appointment.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (
      appointment.sessionType === "paid" &&
      (!payment ||
        payment.status !== "pending" ||
        payment.refundState !== "none")
    )
      throw new HttpError(409, "Payment is not available for this session");
    if (action === "confirm") {
      if (!appointment.actualStartTime)
        throw new HttpError(
          409,
          "Both participants must join before confirming completion",
        );
      await appointment.update(
        {
          [user.userType === "mentor" ? "mentorConfirmed" : "menteeConfirmed"]:
            true,
        },
        { transaction },
      );
    } else if (action === "join") {
      if (appointment.status === "call_ended")
        throw new HttpError(409, "This call has ended");
      const field =
        user.userType === "mentor" ? "mentorJoinTime" : "menteeJoinTime";
      if (!appointment[field]) appointment[field] = new Date();
      if (
        appointment.mentorJoinTime &&
        appointment.menteeJoinTime &&
        !appointment.actualStartTime
      ) {
        appointment.actualStartTime = new Date();
        appointment.status = "ongoing";
      }
      await appointment.save({ transaction });
    } else if (action === "end") {
      if (appointment.status === "call_ended") return appointment;
      const end = new Date();
      await appointment.update(
        {
          actualEndTime: end,
          callEndedAt: end,
          endedBy: user.userType,
          endReason: text(body.endReason || "Call ended", "End reason", 500),
          duration: appointment.actualStartTime
            ? Math.max(
                0,
                Math.floor((end - appointment.actualStartTime) / 60000),
              )
            : 0,
          status: "call_ended",
        },
        { transaction },
      );
    }
    return appointment;
  });
  if (
    result.status !== "completed" &&
    result.mentorConfirmed &&
    result.menteeConfirmed
  )
    return finance.release(id, user);
  return result;
}
module.exports = { transition };
