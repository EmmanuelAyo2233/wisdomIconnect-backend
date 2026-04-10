const { Appointment, Mentor, Mentee, User, Review, MentorCommendation, Payment, Wallet } = require("../models");
const Achievement = require("../models/achievement");
const UserAchievement = require("../models/userAchievement");

async function checkAndAwardAchievement(userId, role, sessionsCount) {
    const fetchAndAward = async (title) => {
        const ach = await Achievement.findOne({ where: { title } });
        if (ach) {
            const exists = await UserAchievement.findOne({ where: { user_id: userId, achievement_id: ach.id } });
            if (!exists) {
                await UserAchievement.create({ user_id: userId, role, achievement_id: ach.id });
            }
        }
    };

    if (role === 'mentor') {
        if (sessionsCount === 1) await fetchAndAward('First Session');
        if (sessionsCount === 10) await fetchAndAward('Bronze Mentor');
        if (sessionsCount === 50) await fetchAndAward('Silver Mentor');
        if (sessionsCount === 100) await fetchAndAward('Gold Mentor');
    } else if (role === 'mentee') {
        if (sessionsCount === 1) await fetchAndAward('First Session');
        if (sessionsCount === 10) await fetchAndAward('Active Learner');
        if (sessionsCount === 50) await fetchAndAward('Dedicated Learner');
    }
}

exports.markSessionComplete = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const userId = req.user.id;
        const role = req.user.userType;

        const appointment = await Appointment.findByPk(appointmentId);
        if (!appointment) return res.status(404).json({ status: "fail", message: "Appointment not found ❌" });

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
        if (appointment.mentorConfirmed && appointment.menteeConfirmed && appointment.status !== "completed") {
            appointment.status = "completed";
            appointment.callEndedAt = new Date();
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

                // Gamification hook
                await checkAndAwardAchievement(mentor.user.id, "mentor", mentor.user.sessionsCompleted);
            }

            // Mentee progression update
            const mentee = await Mentee.findByPk(appointment.menteeId, { include: ["user"] });
            if (mentee && mentee.user) {
                mentee.user.sessionsCompleted = (mentee.user.sessionsCompleted || 0) + 1;
                await mentee.user.save();
                
                // Gamification hook
                await checkAndAwardAchievement(mentee.user.id, "mentee", mentee.user.sessionsCompleted);
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
        const { rating, comment } = req.body;
        const userId = req.user.id;

        const mentee = await Mentee.findOne({ where: { user_id: userId } });
        if (!mentee) return res.status(403).json({ status: "fail", message: "Only mentees can submit reviews ❌" });

        const appointment = await Appointment.findOne({ where: { id: appointmentId, menteeId: mentee.id, status: "completed" } });
        if (!appointment) return res.status(404).json({ status: "fail", message: "Completed appointment not found ❌" });

        const existingReview = await Review.findOne({ where: { appointmentId: appointment.id } });
        if (existingReview) return res.status(400).json({ status: "fail", message: "Review already submitted ❌" });

        const review = await Review.create({
            rating,
            comment,
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
        const { commendation, rating } = req.body;
        const userId = req.user.id;

        const mentor = await Mentor.findOne({ where: { user_id: userId } });
        if (!mentor) return res.status(403).json({ status: "fail", message: "Only mentors can submit commendations ❌" });

        const appointment = await Appointment.findOne({ where: { id: appointmentId, mentorId: mentor.id, status: "completed" } });
        if (!appointment) return res.status(404).json({ status: "fail", message: "Completed appointment not found ❌" });

        const existingCommendation = await MentorCommendation.findOne({ where: { appointmentId: appointment.id } });
        if (existingCommendation) return res.status(400).json({ status: "fail", message: "Commendation already submitted ❌" });

        const newCommendation = await MentorCommendation.create({
            commendation,
            rating,
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
