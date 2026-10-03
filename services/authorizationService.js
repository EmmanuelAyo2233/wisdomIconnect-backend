const { HttpError, positiveId, accountEligible } = require("../utils/security");

// Models are loaded only when needed; importing this module never opens a database.
async function currentUser(id, version) {
  const { User } = require("../models");
  const user = await User.findByPk(positiveId(id));
  if (
    !accountEligible(user) ||
    Number(user.tokenVersion || 0) !== Number(version || 0)
  ) {
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }
  return user;
}
async function connectionFor(user, connectionId) {
  const { Connection, Mentor, Mentee } = require("../models");
  const connection = await Connection.findByPk(positiveId(connectionId));
  if (!connection || connection.status !== "accepted")
    throw new HttpError(403, "Conversation unavailable");
  const Profile =
    user.userType === "mentor"
      ? Mentor
      : user.userType === "mentee"
        ? Mentee
        : null;
  const profile =
    Profile && (await Profile.findOne({ where: { user_id: user.id } }));
  const ownerId =
    user.userType === "mentor" ? connection.mentorId : connection.menteeId;
  if (!profile || Number(profile.id) !== Number(ownerId))
    throw new HttpError(403, "You cannot access this conversation");
  return connection;
}
async function appointmentFor(user, appointment, allowAdmin = false) {
  const { Mentor, Mentee } = require("../models");
  if (!appointment) throw new HttpError(404, "Session not found");
  if (allowAdmin && user.userType === "admin") return appointment;
  const Profile =
    user.userType === "mentor"
      ? Mentor
      : user.userType === "mentee"
        ? Mentee
        : null;
  const profile =
    Profile && (await Profile.findOne({ where: { user_id: user.id } }));
  if (
    !profile ||
    Number(profile.id) !==
      Number(
        user.userType === "mentor"
          ? appointment.mentorId
          : appointment.menteeId,
      )
  )
    throw new HttpError(403, "You cannot access this session");
  return appointment;
}
async function meetingFor(user, meetingId) {
  const { Appointment, Payment } = require("../models");
  if (typeof meetingId !== "string" || meetingId.length > 100)
    throw new HttpError(400, "Invalid meeting");
  const appointment = await Appointment.findOne({ where: { meetingId } });
  await appointmentFor(user, appointment);
  if (!["accepted", "ongoing", "in_progress"].includes(appointment.status))
    throw new HttpError(403, "This session is not active");
  if (appointment.sessionType === "paid") {
    const payment = await Payment.findOne({
      where: { appointmentId: appointment.id },
    });
    if (!payment || payment.status !== "pending")
      throw new HttpError(403, "Payment is not held for this session");
  }
  return appointment;
}
module.exports = { currentUser, connectionFor, appointmentFor, meetingFor };
