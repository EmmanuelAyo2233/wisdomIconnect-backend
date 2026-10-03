const { respondError } = require("../utils/security");
const {
  Appointment,
  Mentor,
  Mentee,
  User,
  Review,
  MentorCommendation,
  Payment,
  Wallet,
} = require("../models");
const Achievement = require("../models/achievement");
const UserAchievement = require("../models/userAchievement");
const { Op } = require("sequelize");
const { logActivity } = require("../services/activityLogger");

/**
 * Dynamic achievement awarding system.
 * Checks ALL achievements for the user's role and awards any whose threshold is met.
 * This supports the continuous milestone pattern — no hardcoded limits.
 *
 * @param {number} userId - The user's ID
 * @param {string} role - 'mentor' or 'mentee'
 * @param {object} stats - { sessions, minutes, bookings, streaks }
 */
async function checkAndAwardAchievements(userId, role, stats = {}) {
  try {
    // Fetch all achievements for this role
    const roleAchievements = await Achievement.findAll({
      where: {
        [Op.or]: [
          { role: role },
          { role: null }, // shared achievements
        ],
      },
    });

    // Fetch already-earned achievement IDs
    const earnedRows = await UserAchievement.findAll({
      where: { user_id: userId, role },
      attributes: ["achievement_id"],
    });
    const earnedIds = new Set(earnedRows.map((r) => r.achievement_id));

    // Map criteria_type to stat values
    const statMap = {
      // Mentor types
      mentor_sessions: stats.sessions || 0,
      mentor_minutes: stats.minutes || 0,
      mentor_leaderboard: stats.leaderboardRank || 999999,
      // Mentee types
      mentee_sessions: stats.sessions || 0,
      mentee_minutes: stats.minutes || 0,
      mentee_bookings: stats.bookings || 0,
      mentee_streaks: stats.streaks || 0,
      // Legacy types (backwards compatible)
      sessions: stats.sessions || 0,
      rating: stats.rating || 0,
      engagement: stats.engagement || 0,
    };

    const newAwards = [];
    for (const ach of roleAchievements) {
      if (earnedIds.has(ach.id)) continue; // Already earned

      const currentVal = statMap[ach.criteria_type] || 0;

      // For leaderboard, lower rank = better (Top 10 means rank <= 10)
      if (ach.criteria_type === "mentor_leaderboard") {
        if (currentVal <= ach.criteria_threshold) {
          newAwards.push({
            user_id: userId,
            role,
            achievement_id: ach.id,
            earned_at: new Date(),
          });
        }
      } else {
        if (currentVal >= ach.criteria_threshold) {
          newAwards.push({
            user_id: userId,
            role,
            achievement_id: ach.id,
            earned_at: new Date(),
          });
        }
      }
    }

    if (newAwards.length > 0) {
      await UserAchievement.bulkCreate(newAwards);
      console.log(
        `🏆 Awarded ${newAwards.length} new achievement(s) to user ${userId} (${role})`,
      );
    }
  } catch (err) {
    require('../utils/logger').error("❌ Achievement check error:", err.message);
  }
}

function autoModerateText(text) {
  if (!text) return "approved";

  // Email pattern
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  // Phone number pattern (looks for strings of 7 to 15 digits, optionally with spaces/dashes/pluses)
  const phoneRegex = /(\+?\d[\s-]?){8,15}\d/;
  // Common Bypass Keywords
  const bypassRegex =
    /\b(whatsapp|telegram|instagram|phone|email|contact|skype|zoom|meet\.google|pay\s*me|transfer|bank|account|cash|crypto|usdt|solana)\b/i;
  // Abusive word checklist
  const abuseKeywords =
    /\b(scam|fraud|bastard|idiot|fool|stupid|asshole|bitch|fucking|cheat|steal|rob)\b/i;

  if (
    emailRegex.test(text) ||
    phoneRegex.test(text) ||
    bypassRegex.test(text) ||
    abuseKeywords.test(text)
  ) {
    return "flagged";
  }
  return "approved";
}

exports.markSessionComplete = async (req, res) => {
  try {
    const appointment = await require("../services/sessionService").transition(
      req.user,
      req.params.appointmentId,
      "confirm",
      req.body,
    );
    res.json({
      status: "success",
      data: appointment,
      completed: appointment.status === "completed",
      message:
        appointment.status === "completed"
          ? "Session completed"
          : "Session updated. Both participants must confirm completion to release payment.",
    });
  } catch (error) {
    respondError(res, error);
  }
};

exports.joinSession = async (req, res) => {
  try {
    const appointment = await require("../services/sessionService").transition(
      req.user,
      req.params.appointmentId,
      "join",
      req.body,
    );
    res.json({
      status: "success",
      data: appointment,
      completed: appointment.status === "completed",
      message:
        appointment.status === "completed"
          ? "Session completed"
          : "Session updated. Both participants must confirm completion to release payment.",
    });
  } catch (error) {
    respondError(res, error);
  }
};

exports.endSession = async (req, res) => {
  try {
    const appointment = await require("../services/sessionService").transition(
      req.user,
      req.params.appointmentId,
      "end",
      req.body,
    );
    res.json({
      status: "success",
      data: appointment,
      completed: appointment.status === "completed",
      message:
        appointment.status === "completed"
          ? "Session completed"
          : "Session updated. Both participants must confirm completion to release payment.",
    });
  } catch (error) {
    respondError(res, error);
  }
};

exports.submitReview = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const {
      rating,
      comment,
      teachingQuality,
      communication,
      helpfulness,
      recommend,
    } = req.body;
    const userId = req.user.id;
    if (
      !Number.isInteger(Number(rating)) ||
      Number(rating) < 1 ||
      Number(rating) > 5 ||
      (comment && (typeof comment !== "string" || comment.length > 5000))
    )
      return res
        .status(400)
        .json({
          status: "fail",
          message:
            "Provide a rating from 1 to 5 and a comment under 5,000 characters",
        });

    const mentee = await Mentee.findOne({ where: { user_id: userId } });
    if (!mentee)
      return res
        .status(403)
        .json({
          status: "fail",
          message: "Only mentees can submit reviews ❌",
        });

    const appointment = await Appointment.findOne({
      where: {
        id: appointmentId,
        menteeId: mentee.id,
        status: {
          [Op.in]: ["completed", "call_ended", "under_review", "ongoing"],
        },
      },
    });
    if (!appointment)
      return res
        .status(404)
        .json({ status: "fail", message: "Appointment not found ❌" });

    const existingReview = await Review.findOne({
      where: { appointmentId: appointment.id },
    });
    if (existingReview)
      return res
        .status(400)
        .json({ status: "fail", message: "Review already submitted ❌" });

    // Serialize structured feedback questionnaire inside the comment column
    let finalizedComment = comment;
    if (
      teachingQuality !== undefined ||
      communication !== undefined ||
      helpfulness !== undefined ||
      recommend !== undefined
    ) {
      finalizedComment = JSON.stringify({
        text: comment || "",
        teachingQuality: teachingQuality || 0,
        communication: communication || 0,
        helpfulness: helpfulness || 0,
        recommend: recommend !== undefined ? recommend : true,
      });
    }

    // ✅ FIXED: Always create reviews as "approved" so they show immediately on profile
    // Flagged content is still visible but admin can review and hide if needed
    const moderationStatus = autoModerateText(comment);

    const review = await Review.create({
      rating: rating || 5,
      comment: finalizedComment,
      appointmentId: appointment.id,
      mentorId: appointment.mentorId,
      menteeId: mentee.id,
      status: "approved", // ✅ ALWAYS approved - shows immediately instead of pending
      isFlagged: moderationStatus === "flagged", // Mark for admin review if flagged
    });

    // Update mentor's average rating (only based on approved reviews to keep data authentic)
    const allReviews = await Review.findAll({
      where: { mentorId: appointment.mentorId },
    });
    const allReviews2 = allReviews.filter((r) => !r.isHidden);
    if (allReviews2.length > 0) {
      const avgRating =
        allReviews2.reduce((sum, r) => sum + r.rating, 0) / allReviews2.length;
      const roundedRating = Number(avgRating.toFixed(1));

      const mentor = await Mentor.findByPk(appointment.mentorId, {
        include: ["user"],
      });
      if (mentor && mentor.user) {
        mentor.user.rating = roundedRating;

        // Use real DB count — NEVER trust the cached sessionsCompleted field here
        // The old code was resetting mentors to "starter" when sessionsCompleted was stale
        const realSessionsCount = await Appointment.count({
          where: { mentorId: mentor.id, status: "completed" },
        });
        mentor.user.sessionsCompleted = realSessionsCount;

        // Re-evaluate level — never downgrade, only upgrade
        if (realSessionsCount >= 50 && roundedRating >= 4.5) {
          mentor.user.mentorLevel = "gold";
        } else if (realSessionsCount >= 10 && roundedRating >= 4.0) {
          if (mentor.user.mentorLevel !== "gold")
            mentor.user.mentorLevel = "verified";
        }
        // ⛔ No else-branch: never reset to starter once promoted
        await mentor.user.save();
      }
    }

    res
      .status(201)
      .json({
        status: "success",
        message: "Review submitted successfully ✅",
        data: review,
      });
  } catch (error) {
    require('../utils/logger').error("❌ Submit review error:", error);
    res.status(500).json({ status: "error", message: "Server error ❌" });
  }
};

exports.submitCommendation = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const {
      commendation,
      rating,
      strengths,
      areasToImprove,
      notes,
      recommendNextClass,
    } = req.body;
    const userId = req.user.id;

    const mentor = await Mentor.findOne({ where: { user_id: userId } });
    if (!mentor)
      return res
        .status(403)
        .json({
          status: "fail",
          message: "Only mentors can submit commendations ❌",
        });

    const appointment = await Appointment.findOne({
      where: {
        id: appointmentId,
        mentorId: mentor.id,
        status: {
          [Op.in]: ["completed", "call_ended", "under_review", "ongoing"],
        },
      },
    });
    if (!appointment)
      return res
        .status(404)
        .json({ status: "fail", message: "Appointment not found ❌" });

    const existingCommendation = await MentorCommendation.findOne({
      where: { appointmentId: appointment.id },
    });
    if (existingCommendation)
      return res
        .status(400)
        .json({ status: "fail", message: "Commendation already submitted ❌" });

    // Serialize structured commendation feedback inside the commendation column
    let finalizedCommendation = commendation;
    if (
      strengths !== undefined ||
      areasToImprove !== undefined ||
      notes !== undefined ||
      recommendNextClass !== undefined
    ) {
      finalizedCommendation = JSON.stringify({
        text: commendation || "",
        strengths: strengths || "",
        areasToImprove: areasToImprove || "",
        notes: notes || "",
        recommendNextClass: recommendNextClass || "",
      });
    }

    // ✅ FIXED: Always create commendations as "approved" so they show immediately on profile
    // Flagged content is still visible but admin can review and hide if needed
    const moderationStatus = autoModerateText(commendation);

    const newCommendation = await MentorCommendation.create({
      commendation: finalizedCommendation,
      rating: rating || 5,
      appointmentId: appointment.id,
      mentorId: mentor.id,
      menteeId: appointment.menteeId,
      status: "approved", // ✅ ALWAYS approved - shows immediately instead of pending
      isFlagged: moderationStatus === "flagged", // Mark for admin review if flagged
    });

    res
      .status(201)
      .json({
        status: "success",
        message: "Commendation submitted successfully ✅",
        data: newCommendation,
      });
  } catch (error) {
    require('../utils/logger').error("❌ Submit commendation error:", error);
    res.status(500).json({ status: "error", message: "Server error ❌" });
  }
};

// ✅ Delete a review — only the mentee who wrote it can delete it
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;
    const review = await Review.findByPk(reviewId, {
      include: [
        {
          model: Mentee,
          as: "mentee",
          include: [{ model: User, as: "user", attributes: ["id"] }],
        },
      ],
    });
    if (!review)
      return res
        .status(404)
        .json({ status: "fail", message: "Review not found" });
    const authorUserId = review.mentee?.user?.id || review.mentee?.user_id;
    if (String(authorUserId) !== String(userId)) {
      return res
        .status(403)
        .json({
          status: "fail",
          message: "You can only delete your own reviews",
        });
    }
    await review.destroy();
    res
      .status(200)
      .json({ status: "success", message: "Review deleted successfully" });
  } catch (error) {
    require('../utils/logger').error("❌ Delete review error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// ✅ Delete a commendation — only the mentor who wrote it can delete it
exports.deleteCommendation = async (req, res) => {
  try {
    const { commendationId } = req.params;
    const userId = req.user.id;
    const commendation = await MentorCommendation.findByPk(commendationId, {
      include: [
        {
          model: Mentor,
          as: "mentor",
          include: [{ model: User, as: "user", attributes: ["id"] }],
        },
      ],
    });
    if (!commendation)
      return res
        .status(404)
        .json({ status: "fail", message: "Commendation not found" });
    const authorUserId =
      commendation.mentor?.user?.id || commendation.mentor?.user_id;
    if (String(authorUserId) !== String(userId)) {
      return res
        .status(403)
        .json({
          status: "fail",
          message: "You can only delete your own commendations",
        });
    }
    await commendation.destroy();
    res
      .status(200)
      .json({
        status: "success",
        message: "Commendation deleted successfully",
      });
  } catch (error) {
    require('../utils/logger').error("❌ Delete commendation error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};
