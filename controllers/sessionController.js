const { Appointment, Mentor, Mentee, User, Review, MentorCommendation, Payment, Wallet } = require("../models");
const Achievement = require("../models/achievement");
const UserAchievement = require("../models/userAchievement");
const { Op } = require("sequelize");

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
                    { role: null }     // shared achievements
                ]
            }
        });

        // Fetch already-earned achievement IDs
        const earnedRows = await UserAchievement.findAll({
            where: { user_id: userId, role },
            attributes: ['achievement_id']
        });
        const earnedIds = new Set(earnedRows.map(r => r.achievement_id));

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
            if (ach.criteria_type === 'mentor_leaderboard') {
                if (currentVal <= ach.criteria_threshold) {
                    newAwards.push({
                        user_id: userId,
                        role,
                        achievement_id: ach.id,
                        earned_at: new Date()
                    });
                }
            } else {
                if (currentVal >= ach.criteria_threshold) {
                    newAwards.push({
                        user_id: userId,
                        role,
                        achievement_id: ach.id,
                        earned_at: new Date()
                    });
                }
            }
        }

        if (newAwards.length > 0) {
            await UserAchievement.bulkCreate(newAwards);
            console.log(`🏆 Awarded ${newAwards.length} new achievement(s) to user ${userId} (${role})`);
        }
    } catch (err) {
        console.error("❌ Achievement check error:", err.message);
    }
}

exports.markSessionComplete = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const userId = req.user.id;
        const role = req.user.userType;

        const appointment = await Appointment.findByPk(appointmentId);
        if (!appointment) return res.status(404).json({ status: "fail", message: "Appointment not found ❌" });

        // If already completed, return success cleanly
        if (appointment.status === "completed") {
            return res.status(200).json({ status: "success", message: "Session already completed ✅", data: appointment });
        }

        if (role === "mentor") {
            const mentor = await Mentor.findOne({ where: { user_id: userId } });
            if (!mentor || appointment.mentorId !== mentor.id) {
                return res.status(403).json({ status: "fail", message: "Unauthorized ❌" });
            }
            appointment.mentorConfirmed = true;
        } else if (role === "mentee") {
            const mentee = await Mentee.findOne({ where: { user_id: userId } });
            if (!mentee || appointment.menteeId !== mentee.id) {
                return res.status(403).json({ status: "fail", message: "Unauthorized ❌" });
            }
            appointment.menteeConfirmed = true;
        }

        let completedNow = false;
        if (appointment.status !== "completed") {
            appointment.status = "completed";
            appointment.callEndedAt = new Date();
            
            if (!appointment.callStartedAt) {
                appointment.callStartedAt = appointment.createdAt || new Date();
            }

            // Set duration
            if (req.body.duration) {
                appointment.duration = parseInt(req.body.duration, 10);
            } else {
                const diffMs = appointment.callEndedAt - appointment.callStartedAt;
                appointment.duration = Math.max(1, Math.round(diffMs / 60000));
            }

            completedNow = true;
        }

        await appointment.save();

        if (completedNow) {
            // Mentor progression update
            const mentor = await Mentor.findByPk(appointment.mentorId, { include: ["user"] });
            if (mentor && mentor.user) {
                mentor.user.sessionsCompleted = (mentor.user.sessionsCompleted || 0) + 1;
                
                // Upgrade logic
                if (mentor.user.sessionsCompleted >= 50 && mentor.user.rating >= 4.5) {
                    mentor.user.mentorLevel = "gold";
                } else if (mentor.user.sessionsCompleted >= 10 && mentor.user.rating >= 4.0) {
                    mentor.user.mentorLevel = "verified";
                }
                await mentor.user.save();

                // 🏆 Dynamic achievement check with full stats
                const mentorCompletedAppts = await Appointment.count({ where: { mentorId: mentor.id, status: 'completed' } });
                await checkAndAwardAchievements(mentor.user.id, "mentor", {
                    sessions: mentorCompletedAppts,
                    minutes: mentorCompletedAppts * 60,
                    rating: mentor.user.rating || 0
                });
            }

            // Mentee progression update
            const mentee = await Mentee.findByPk(appointment.menteeId, { include: ["user"] });
            if (mentee && mentee.user) {
                mentee.user.sessionsCompleted = (mentee.user.sessionsCompleted || 0) + 1;
                await mentee.user.save();
                
                // 🏆 Dynamic achievement check with full stats
                const menteeCompletedAppts = await Appointment.count({ where: { menteeId: mentee.id, status: 'completed' } });
                const menteeBookings = await Appointment.count({ where: { menteeId: mentee.id } });
                await checkAndAwardAchievements(mentee.user.id, "mentee", {
                    sessions: menteeCompletedAppts,
                    minutes: menteeCompletedAppts * 60,
                    bookings: menteeBookings
                });
            }

            // Payment logic
            const payment = await Payment.findOne({ where: { appointmentId: appointment.id } });
            if (payment && payment.status === "pending") {
                payment.status = "released";
                await payment.save();

                const mentorWallet = await Wallet.findOne({ where: { userId: mentor.user_id } });
                if (mentorWallet) {
                    mentorWallet.pendingBalance -= payment.mentorShare;
                    mentorWallet.availableBalance += payment.mentorShare;
                    mentorWallet.totalEarned += payment.mentorShare;
                    await mentorWallet.save();
                }

                // Release admin wallet
                const User = require("../models/user");
                const admin = await User.findOne({ where: { userType: 'admin' } });
                if (admin) {
                     const adminWallet = await Wallet.findOne({ where: { userId: admin.id } });
                     if (adminWallet) {
                          adminWallet.pendingBalance -= payment.platformShare;
                          adminWallet.availableBalance += payment.platformShare;
                          adminWallet.totalEarned += payment.platformShare;
                          await adminWallet.save();
                     }
                }
            }
        }

        res.status(200).json({ status: "success", message: "Session marked as complete ✅", data: appointment });
    } catch (error) {
        console.error("❌ Complete session error:", error);
        res.status(500).json({ status: "error", message: "Server error ❌", error: error.message });
    }
};

exports.submitReview = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { rating, comment, teachingQuality, communication, helpfulness, recommend } = req.body;
        const userId = req.user.id;

        const mentee = await Mentee.findOne({ where: { user_id: userId } });
        if (!mentee) return res.status(403).json({ status: "fail", message: "Only mentees can submit reviews ❌" });

        const appointment = await Appointment.findOne({ where: { id: appointmentId, menteeId: mentee.id, status: "completed" } });
        if (!appointment) return res.status(404).json({ status: "fail", message: "Completed appointment not found ❌" });

        const existingReview = await Review.findOne({ where: { appointmentId: appointment.id } });
        if (existingReview) return res.status(400).json({ status: "fail", message: "Review already submitted ❌" });

        // Serialize structured feedback questionnaire inside the comment column
        let finalizedComment = comment;
        if (teachingQuality !== undefined || communication !== undefined || helpfulness !== undefined || recommend !== undefined) {
            finalizedComment = JSON.stringify({
                text: comment || "",
                teachingQuality: teachingQuality || 0,
                communication: communication || 0,
                helpfulness: helpfulness || 0,
                recommend: recommend !== undefined ? recommend : true
            });
        }

        const review = await Review.create({
            rating: rating || 5,
            comment: finalizedComment,
            appointmentId: appointment.id,
            mentorId: appointment.mentorId,
            menteeId: mentee.id,
        });

        // Update mentor's average rating
        const allReviews = await Review.findAll({ where: { mentorId: appointment.mentorId } });
        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
        const roundedRating = Number(avgRating.toFixed(1));

        const mentor = await Mentor.findByPk(appointment.mentorId, { include: ["user"] });
        if (mentor && mentor.user) {
            mentor.user.rating = roundedRating;
            
            // Re-evaluate level
            if (mentor.user.sessionsCompleted >= 50 && mentor.user.rating >= 4.5) {
                mentor.user.mentorLevel = "gold";
            } else if (mentor.user.sessionsCompleted >= 10 && mentor.user.rating >= 4.0) {
                mentor.user.mentorLevel = "verified";
            } else {
                mentor.user.mentorLevel = "starter";
            }
            await mentor.user.save();
        }

        res.status(201).json({ status: "success", message: "Review submitted ✅", data: review });
    } catch (error) {
        console.error("❌ Submit review error:", error);
        res.status(500).json({ status: "error", message: "Server error ❌", error: error.message });
    }
};

exports.submitCommendation = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { commendation, rating, strengths, areasToImprove, notes, recommendNextClass } = req.body;
        const userId = req.user.id;

        const mentor = await Mentor.findOne({ where: { user_id: userId } });
        if (!mentor) return res.status(403).json({ status: "fail", message: "Only mentors can submit commendations ❌" });

        const appointment = await Appointment.findOne({ where: { id: appointmentId, mentorId: mentor.id, status: "completed" } });
        if (!appointment) return res.status(404).json({ status: "fail", message: "Completed appointment not found ❌" });

        const existingCommendation = await MentorCommendation.findOne({ where: { appointmentId: appointment.id } });
        if (existingCommendation) return res.status(400).json({ status: "fail", message: "Commendation already submitted ❌" });

        // Serialize structured commendation feedback inside the commendation column
        let finalizedCommendation = commendation;
        if (strengths !== undefined || areasToImprove !== undefined || notes !== undefined || recommendNextClass !== undefined) {
            finalizedCommendation = JSON.stringify({
                text: commendation || "",
                strengths: strengths || "",
                areasToImprove: areasToImprove || "",
                notes: notes || "",
                recommendNextClass: recommendNextClass || ""
            });
        }

        const newCommendation = await MentorCommendation.create({
            commendation: finalizedCommendation,
            rating: rating || 5,
            appointmentId: appointment.id,
            mentorId: mentor.id,
            menteeId: appointment.menteeId,
        });

        res.status(201).json({ status: "success", message: "Commendation submitted ✅", data: newCommendation });
    } catch (error) {
        console.error("❌ Submit commendation error:", error);
        res.status(500).json({ status: "error", message: "Server error ❌", error: error.message });
    }
};
