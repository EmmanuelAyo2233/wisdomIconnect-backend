async function updateProgress(appointment, transaction) {
  const {
    User,
    Mentor,
    Mentee,
    Appointment,
    Achievement,
    UserAchievement,
  } = require("../models");
  const profiles = [
    ["mentor", await Mentor.findByPk(appointment.mentorId, { transaction })],
    ["mentee", await Mentee.findByPk(appointment.menteeId, { transaction })],
  ];
  for (const [role, profile] of profiles) {
    const user = await User.findByPk(profile.user_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const where = {
      [role === "mentor" ? "mentorId" : "menteeId"]: profile.id,
      status: "completed",
    };
    const sessions = await Appointment.count({ where, transaction });
    const minutes =
      (await Appointment.sum("duration", { where, transaction })) || 0;
    const updates = { sessionsCompleted: sessions };
    if (role === "mentor") {
      if (sessions >= 50 && Number(user.rating) >= 4.5)
        updates.mentorLevel = "gold";
      else if (
        sessions >= 10 &&
        Number(user.rating) >= 4 &&
        user.mentorLevel !== "gold"
      )
        updates.mentorLevel = "verified";
    }
    await user.update(updates, { transaction });
    const bookings =
      role === "mentee"
        ? await Appointment.count({
            where: { menteeId: profile.id },
            transaction,
          })
        : 0;
    const stats = {
      sessions,
      rating: Number(user.rating),
      mentor_sessions: role === "mentor" ? sessions : 0,
      mentee_sessions: role === "mentee" ? sessions : 0,
      mentor_minutes: role === "mentor" ? minutes : 0,
      mentee_minutes: role === "mentee" ? minutes : 0,
      mentee_bookings: bookings,
    };
    const achievements = await Achievement.findAll({
      where: { role },
      transaction,
    });
    for (const achievement of achievements) {
      if (
        stats[achievement.criteria_type] === undefined ||
        stats[achievement.criteria_type] < achievement.criteria_threshold
      )
        continue;
      const existing = await UserAchievement.findOne({
        where: { user_id: user.id, achievement_id: achievement.id, role },
        transaction,
      });
      if (!existing)
        await UserAchievement.create(
          {
            user_id: user.id,
            achievement_id: achievement.id,
            role,
            earned_at: new Date(),
          },
          { transaction },
        );
    }
  }
}
module.exports = { updateProgress };
