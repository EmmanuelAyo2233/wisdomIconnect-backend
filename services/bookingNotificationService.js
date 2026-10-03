async function record(appointment, title, transaction) {
  const { Notification } = require("../models");
  for (const [receiverType, receiverId] of [
    ["mentor", appointment.mentorId],
    ["mentee", appointment.menteeId],
  ]) {
    await Notification.create(
      {
        receiverId,
        receiverType,
        title,
        type: "booking",
        message: `Session #${appointment.id}: ${appointment.topic || "Mentorship"} on ${appointment.date} at ${appointment.startTime}. Status: ${appointment.status}.`,
        link: `/${receiverType}/bookings`,
      },
      { transaction },
    );
  }
}
module.exports = { record };
