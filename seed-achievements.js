const { db, Achievement } = require("./models");

/**
 * Comprehensive achievement seed for WisdomIconnect.
 * 
 * MENTOR achievements:
 *   - Sessions:    1, 10, 25, 50, 100, 150, 250, 500
 *   - Minutes:     100, 500, 1000, 3000, 5000, 10000
 *   - Leaderboard: Top 100, Top 50, Top 10, Top 1
 *
 * MENTEE achievements:
 *   - Sessions:    1, 5, 10, 25, 50, 100, 150, 250
 *   - Minutes:     50, 100, 300, 500, 1000, 3000, 5000
 *   - Bookings:    1, 5, 20, 50, 100
 *   - Streaks:     3, 7, 14, 30, 60
 */
const achievements = [
    // ═══════════════════════════════════════
    // MENTOR — Session Milestones
    // ═══════════════════════════════════════
    { title: "First Mentorship Session", description: "Completed your very first mentorship session", icon: "🌱", criteria_type: "mentor_sessions", criteria_threshold: 1, role: "mentor" },
    { title: "Rising Mentor", description: "Completed 10 mentorship sessions", icon: "📚", criteria_type: "mentor_sessions", criteria_threshold: 10, role: "mentor" },
    { title: "Dedicated Mentor", description: "Completed 25 mentorship sessions", icon: "🎯", criteria_type: "mentor_sessions", criteria_threshold: 25, role: "mentor" },
    { title: "Silver Mentor", description: "Completed 50 mentorship sessions", icon: "🥈", criteria_type: "mentor_sessions", criteria_threshold: 50, role: "mentor" },
    { title: "Gold Mentor", description: "Completed 100 mentorship sessions", icon: "🥇", criteria_type: "mentor_sessions", criteria_threshold: 100, role: "mentor" },
    { title: "Platinum Mentor", description: "Completed 150 mentorship sessions", icon: "💎", criteria_type: "mentor_sessions", criteria_threshold: 150, role: "mentor" },
    { title: "Elite Mentor", description: "Completed 250 mentorship sessions", icon: "👑", criteria_type: "mentor_sessions", criteria_threshold: 250, role: "mentor" },
    { title: "Legendary Mentor", description: "Completed 500 mentorship sessions", icon: "🏛️", criteria_type: "mentor_sessions", criteria_threshold: 500, role: "mentor" },

    // MENTOR — Minutes Milestones
    { title: "100 Minutes Trained", description: "Spent 100 minutes in mentorship sessions", icon: "⏱️", criteria_type: "mentor_minutes", criteria_threshold: 100, role: "mentor" },
    { title: "500 Minutes Trained", description: "Spent 500 minutes guiding mentees", icon: "⏳", criteria_type: "mentor_minutes", criteria_threshold: 500, role: "mentor" },
    { title: "1,000 Minutes Trained", description: "Invested 1,000 minutes in mentorship", icon: "🔥", criteria_type: "mentor_minutes", criteria_threshold: 1000, role: "mentor" },
    { title: "3,000 Minutes Trained", description: "Reached 3,000 mentorship minutes — incredible!", icon: "🚀", criteria_type: "mentor_minutes", criteria_threshold: 3000, role: "mentor" },
    { title: "5,000 Minutes Trained", description: "Surpassed 5,000 mentorship minutes!", icon: "⭐", criteria_type: "mentor_minutes", criteria_threshold: 5000, role: "mentor" },
    { title: "10,000 Minutes Trained", description: "Legendary 10,000 minutes of mentorship", icon: "🏆", criteria_type: "mentor_minutes", criteria_threshold: 10000, role: "mentor" },

    // MENTOR — Leaderboard
    { title: "Top 100 Mentor", description: "Ranked in the Top 100 Mentors on the platform", icon: "📊", criteria_type: "mentor_leaderboard", criteria_threshold: 100, role: "mentor" },
    { title: "Top 50 Mentor", description: "Ranked in the Top 50 Mentors on the platform", icon: "📈", criteria_type: "mentor_leaderboard", criteria_threshold: 50, role: "mentor" },
    { title: "Top 10 Mentor", description: "Ranked in the Top 10 Mentors — elite status!", icon: "🏅", criteria_type: "mentor_leaderboard", criteria_threshold: 10, role: "mentor" },
    { title: "Top 1 Mentor", description: "The #1 Mentor on WisdomIconnect!", icon: "🥇", criteria_type: "mentor_leaderboard", criteria_threshold: 1, role: "mentor" },

    // ═══════════════════════════════════════
    // MENTEE — Session Milestones
    // ═══════════════════════════════════════
    { title: "First Learning Session", description: "Attended your very first mentorship session", icon: "🌱", criteria_type: "mentee_sessions", criteria_threshold: 1, role: "mentee" },
    { title: "Curious Mind", description: "Attended 5 mentorship sessions", icon: "🧠", criteria_type: "mentee_sessions", criteria_threshold: 5, role: "mentee" },
    { title: "Active Learner", description: "Attended 10 mentorship sessions", icon: "📚", criteria_type: "mentee_sessions", criteria_threshold: 10, role: "mentee" },
    { title: "Dedicated Learner", description: "Attended 25 mentorship sessions", icon: "🎯", criteria_type: "mentee_sessions", criteria_threshold: 25, role: "mentee" },
    { title: "Knowledge Seeker", description: "Attended 50 mentorship sessions", icon: "🎓", criteria_type: "mentee_sessions", criteria_threshold: 50, role: "mentee" },
    { title: "Master Learner", description: "Attended 100 mentorship sessions", icon: "🏅", criteria_type: "mentee_sessions", criteria_threshold: 100, role: "mentee" },
    { title: "Scholar", description: "Attended 150 mentorship sessions", icon: "💎", criteria_type: "mentee_sessions", criteria_threshold: 150, role: "mentee" },
    { title: "Lifelong Learner", description: "Attended 250 mentorship sessions", icon: "👑", criteria_type: "mentee_sessions", criteria_threshold: 250, role: "mentee" },

    // MENTEE — Minutes Milestones
    { title: "50 Minutes Learned", description: "Spent 50 minutes in learning sessions", icon: "⏱️", criteria_type: "mentee_minutes", criteria_threshold: 50, role: "mentee" },
    { title: "100 Minutes Learned", description: "Invested 100 minutes in your growth", icon: "⏳", criteria_type: "mentee_minutes", criteria_threshold: 100, role: "mentee" },
    { title: "300 Minutes Learned", description: "Reached 300 learning minutes", icon: "🔥", criteria_type: "mentee_minutes", criteria_threshold: 300, role: "mentee" },
    { title: "500 Minutes Learned", description: "Passed 500 minutes of focused learning", icon: "🚀", criteria_type: "mentee_minutes", criteria_threshold: 500, role: "mentee" },
    { title: "1,000 Minutes Learned", description: "1,000 minutes invested in knowledge — amazing!", icon: "⭐", criteria_type: "mentee_minutes", criteria_threshold: 1000, role: "mentee" },
    { title: "3,000 Minutes Learned", description: "3,000 minutes of dedicated learning", icon: "🏆", criteria_type: "mentee_minutes", criteria_threshold: 3000, role: "mentee" },
    { title: "5,000 Minutes Learned", description: "An incredible 5,000 minutes of learning", icon: "🏛️", criteria_type: "mentee_minutes", criteria_threshold: 5000, role: "mentee" },

    // MENTEE — Bookings Milestones
    { title: "First Booking", description: "Made your first session booking", icon: "📅", criteria_type: "mentee_bookings", criteria_threshold: 1, role: "mentee" },
    { title: "5 Bookings", description: "Booked 5 mentorship sessions", icon: "📋", criteria_type: "mentee_bookings", criteria_threshold: 5, role: "mentee" },
    { title: "20 Bookings", description: "Booked 20 mentorship sessions — committed!", icon: "📓", criteria_type: "mentee_bookings", criteria_threshold: 20, role: "mentee" },
    { title: "50 Bookings", description: "Booked 50 sessions — you're unstoppable!", icon: "📖", criteria_type: "mentee_bookings", criteria_threshold: 50, role: "mentee" },
    { title: "100 Bookings", description: "Booked 100 sessions — incredible dedication!", icon: "📘", criteria_type: "mentee_bookings", criteria_threshold: 100, role: "mentee" },

    // MENTEE — Streak Milestones
    { title: "3-Day Streak", description: "Booked sessions for 3 consecutive days", icon: "🔥", criteria_type: "mentee_streaks", criteria_threshold: 3, role: "mentee" },
    { title: "7-Day Streak", description: "A full week of daily session bookings!", icon: "💪", criteria_type: "mentee_streaks", criteria_threshold: 7, role: "mentee" },
    { title: "14-Day Streak", description: "Two weeks of consistent learning!", icon: "⚡", criteria_type: "mentee_streaks", criteria_threshold: 14, role: "mentee" },
    { title: "30-Day Streak", description: "One month of daily sessions — legendary!", icon: "🏆", criteria_type: "mentee_streaks", criteria_threshold: 30, role: "mentee" },
    { title: "60-Day Streak", description: "60 days of unbroken learning — unstoppable!", icon: "👑", criteria_type: "mentee_streaks", criteria_threshold: 60, role: "mentee" },
];

const seedAchievements = async () => {
    try {
        await db.sequelize.sync();

        console.log("🧹 Wiping all user_achievements and achievements for a clean re-seed...");

        // Must wipe user_achievements first (FK dependency), use DELETE not TRUNCATE
        const UserAchievement = require("./models/userAchievement");
        await UserAchievement.destroy({ where: {} });
        await Achievement.destroy({ where: {} });

        console.log("✅ Cleared. Seeding fresh achievements...");
        await Achievement.bulkCreate(achievements);
        console.log(`✅ Seeded ${achievements.length} achievements successfully!`);
        
        process.exit(0);
    } catch (err) {
        console.error("❌ Error seeding achievements:", err);
        process.exit(1);
    }
};

seedAchievements();
