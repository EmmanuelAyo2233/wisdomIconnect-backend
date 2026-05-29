const { Appointment, Mentor, Mentee, User, Review, MentorCommendation, Payment, Wallet } = require("../models");
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

async function performSessionCompletion(appointment, completionMethod = 'automatic') {
    if (appointment.status === "completed") return;

    appointment.status = "completed";
    appointment.completionMethod = completionMethod;
    if (!appointment.callEndedAt) appointment.callEndedAt = new Date();
    if (!appointment.callStartedAt) appointment.callStartedAt = appointment.actualStartTime || appointment.createdAt || new Date();

    if (!appointment.duration) {
        const diffMs = appointment.callEndedAt - appointment.callStartedAt;
        appointment.duration = Math.max(1, Math.round(diffMs / 60000));
    }

    await appointment.save();

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
    if (payment && (payment.status === "pending" || payment.status === "awaiting_acceptance" || payment.status === "disputed")) {
        payment.status = "released";
        await payment.save();

        if (mentor) {
            const mentorWallet = await Wallet.findOne({ where: { userId: mentor.user_id } });
            if (mentorWallet) {
                mentorWallet.pendingBalance -= payment.mentorShare;
                mentorWallet.availableBalance += payment.mentorShare;
                mentorWallet.totalEarned += payment.mentorShare;
                await mentorWallet.save();
            }
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

function autoModerateText(text) {
    if (!text) return "approved";
    
    // Email pattern
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
    // Phone number pattern (looks for strings of 7 to 15 digits, optionally with spaces/dashes/pluses)
    const phoneRegex = /(\+?\d[\s-]?){8,15}\d/;
    // Common Bypass Keywords
    const bypassRegex = /\b(whatsapp|telegram|instagram|phone|email|contact|skype|zoom|meet\.google|pay\s*me|transfer|bank|account|cash|crypto|usdt|solana)\b/i;
    // Abusive word checklist
    const abuseKeywords = /\b(scam|fraud|bastard|idiot|fool|stupid|asshole|bitch|fucking|cheat|steal|rob)\b/i;

    if (emailRegex.test(text) || phoneRegex.test(text) || bypassRegex.test(text) || abuseKeywords.test(text)) {
        return "flagged";
    }
    return "approved";
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

        await appointment.save();

        // Release immediately if mentor and mentee confirmed
        if (appointment.mentorConfirmed && appointment.menteeConfirmed) {
            await performSessionCompletion(appointment, "dual_confirm");
        }

        res.status(200).json({ status: "success", message: "Session completion status updated ✅", data: appointment });
    } catch (error) {
        console.error("❌ Complete session error:", error);
        res.status(500).json({ status: "error", message: "Server error ❌", error: error.message });
    }
};

exports.joinSession = async (req, res) => {
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
            if (!appointment.mentorJoinTime) {
                appointment.mentorJoinTime = new Date();
            }
        } else if (role === "mentee") {
            const mentee = await Mentee.findOne({ where: { user_id: userId } });
            if (!mentee || appointment.menteeId !== mentee.id) {
                return res.status(403).json({ status: "fail", message: "Unauthorized ❌" });
            }
            if (!appointment.menteeJoinTime) {
                appointment.menteeJoinTime = new Date();
            }
        }

        // If both joined, record actualStartTime and update status = ongoing
        if (appointment.mentorJoinTime && appointment.menteeJoinTime && !appointment.actualStartTime) {
            appointment.actualStartTime = new Date();
            if (appointment.status === "accepted") {
                appointment.status = "ongoing";
            }
        }

        await appointment.save();

        logActivity({
            type: "SESSION",
            message: `${req.user.name} (${role}) joined session (Appointment ID ${appointment.id})`,
            userId,
            targetId: appointment.id,
            status: "success",
            metadata: {
                role,
                appointmentId
            }
        });

        if (appointment.mentorJoinTime && appointment.menteeJoinTime && appointment.status === "ongoing") {
            logActivity({
                type: "SESSION",
                message: `Session is now live (ongoing) for Appointment ID ${appointment.id}`,
                userId: null,
                targetId: appointment.id,
                status: "success",
                metadata: {
                    appointmentId
                }
            });
        }

        res.status(200).json({ status: "success", message: "Joined session successfully ✅", data: appointment });
    } catch (error) {
        console.error("❌ Join session error:", error);
        res.status(500).json({ status: "error", message: "Server error ❌", error: error.message });
    }
};

exports.endSession = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const userId = req.user.id;
        const role = req.user.userType;
        const { endReason, clientElapsedMinutes } = req.body;

        const appointment = await Appointment.findByPk(appointmentId);
        if (!appointment) return res.status(404).json({ status: "fail", message: "Appointment not found ❌" });

        let isAuthorized = false;
        if (role === "mentor") {
            const mentor = await Mentor.findOne({ where: { user_id: userId } });
            if (mentor && appointment.mentorId === mentor.id) isAuthorized = true;
        } else if (role === "mentee") {
            const mentee = await Mentee.findOne({ where: { user_id: userId } });
            if (mentee && appointment.menteeId === mentee.id) isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ status: "fail", message: "Unauthorized ❌" });
        }

        if (appointment.status === "completed") {
            return res.status(200).json({ status: "success", message: "Session already completed ✅", data: appointment, completed: true });
        }

        // Mark times
        appointment.actualEndTime = new Date();
        appointment.callEndedAt = new Date();
        appointment.endedBy = role;
        appointment.endReason = endReason || "User clicked end call";

        // Compute scheduled duration
        let scheduledMinutes = 60;
        if (appointment.startTime && appointment.endTime) {
            try {
                const [sh, sm] = appointment.startTime.split(":").map(Number);
                const [eh, em] = appointment.endTime.split(":").map(Number);
                scheduledMinutes = (eh * 60 + em) - (sh * 60 + sm);
            } catch (e) {
                console.warn("Failed to parse start/end time:", e);
            }
        }

        // Compute actual duration using server timestamps first,
        // then fall back to the client-measured elapsed time if server start is missing.
        // This prevents a false dispute when actualStartTime was never written to the DB
        // (e.g., the /join endpoint wasn't called before both peers connected via WebRTC).
        let actualMinutes = 0;
        if (appointment.actualStartTime) {
            const diffMs = appointment.actualEndTime - appointment.actualStartTime;
            actualMinutes = Math.max(1, Math.round(diffMs / 60000));
        } else if (appointment.callStartedAt) {
            const diffMs = appointment.actualEndTime - appointment.callStartedAt;
            actualMinutes = Math.max(1, Math.round(diffMs / 60000));
        } else if (clientElapsedMinutes && typeof clientElapsedMinutes === 'number' && clientElapsedMinutes > 0) {
            // Client-side fallback: trusted elapsed time measured in the browser
            console.log(`[endSession] Using client elapsed time fallback: ${clientElapsedMinutes}m (no server actualStartTime)`);
            actualMinutes = Math.round(clientElapsedMinutes);
        }
        appointment.duration = actualMinutes;

        // Auto-complete free sessions
        if (appointment.sessionType === "free") {
            await performSessionCompletion(appointment, "automatic");
            logActivity({
                type: "SESSION",
                message: `Free session completed successfully (Appointment ID ${appointment.id})`,
                userId,
                targetId: appointment.id,
                status: "success",
                metadata: {
                    appointmentId,
                    sessionType: "free"
                }
            });
            return res.status(200).json({
                status: "success",
                message: "Free session completed successfully ✅",
                data: appointment,
                completed: true
            });
        }

        // Validate 70% threshold for paid sessions
        const threshold = 0.70 * scheduledMinutes;
        if (actualMinutes < threshold) {
            // Under threshold -> Dispute
            appointment.status = "under_review";
            appointment.disputedBy = "system";
            appointment.disputeReason = `Session ended early. Scheduled: ${scheduledMinutes}m, Actual: ${actualMinutes}m. Under 70% threshold (${Math.round(threshold)}m).`;
            await appointment.save();

            const payment = await Payment.findOne({ where: { appointmentId: appointment.id } });
            if (payment) {
                payment.status = "disputed";
                await payment.save();
            }

            logActivity({
                type: "SESSION",
                message: `Session early end dispute triggered for Appointment ID ${appointment.id} (Under 70% threshold)`,
                userId,
                targetId: appointment.id,
                status: "failed",
                metadata: {
                    appointmentId,
                    scheduledMinutes,
                    actualMinutes,
                    threshold
                }
            });

            return res.status(200).json({
                status: "success",
                message: "Session ended early and marked under review. Escrow locked 🔒",
                data: appointment,
                underReview: true
            });
        } else {
            // Threshold met -> Auto-Complete and release escrow immediately!
            await performSessionCompletion(appointment, "automatic");
            logActivity({
                type: "SESSION",
                message: `Paid session completed successfully and payout released (Appointment ID ${appointment.id})`,
                userId,
                targetId: appointment.id,
                status: "success",
                metadata: {
                    appointmentId,
                    scheduledMinutes,
                    actualMinutes,
                    sessionType: "paid"
                }
            });
            return res.status(200).json({
                status: "success",
                message: "Session completed successfully. Payout released! ✅",
                data: appointment,
                completed: true
            });
        }
    } catch (error) {
        console.error("❌ End session error:", error);
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

        const appointment = await Appointment.findOne({ 
            where: { 
                id: appointmentId, 
                menteeId: mentee.id, 
                status: { [Op.in]: ["completed", "call_ended", "under_review", "ongoing"] } 
            } 
        });
        if (!appointment) return res.status(404).json({ status: "fail", message: "Appointment not found ❌" });

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
            isFlagged: moderationStatus === "flagged" // Mark for admin review if flagged
        });

        appointment.menteeConfirmed = true;
        await appointment.save();

        // If also mentor confirmed and not yet completed, complete it (payout release)
        if (appointment.mentorConfirmed && appointment.status !== "completed") {
            await performSessionCompletion(appointment, "dual_confirm");
        }

        // Update mentor's average rating (only based on approved reviews to keep data authentic)
        const allReviews = await Review.findAll({ where: { mentorId: appointment.mentorId, status: "approved" } });
        const allReviews2 = allReviews.filter(r => !r.isHidden); // filter hidden in JS (isHidden may not exist in DB)
        if (allReviews2.length > 0) {
            const avgRating = allReviews2.reduce((sum, r) => sum + r.rating, 0) / allReviews2.length;
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
        }

        res.status(201).json({ status: "success", message: "Review submitted successfully ✅", data: review });
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

        const appointment = await Appointment.findOne({ 
            where: { 
                id: appointmentId, 
                mentorId: mentor.id, 
                status: { [Op.in]: ["completed", "call_ended", "under_review", "ongoing"] } 
            } 
        });
        if (!appointment) return res.status(404).json({ status: "fail", message: "Appointment not found ❌" });

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
            isFlagged: moderationStatus === "flagged" // Mark for admin review if flagged
        });

        appointment.mentorConfirmed = true;
        await appointment.save();

        // If also mentee confirmed and not yet completed, complete it (payout release)
        if (appointment.menteeConfirmed && appointment.status !== "completed") {
            await performSessionCompletion(appointment, "dual_confirm");
        }

        res.status(201).json({ status: "success", message: "Commendation submitted successfully ✅", data: newCommendation });
    } catch (error) {
        console.error("❌ Submit commendation error:", error);
        res.status(500).json({ status: "error", message: "Server error ❌", error: error.message });
    }
};
