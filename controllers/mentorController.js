const { User, Mentor, Appointment, Review, Mentee } = require("../models");
const UserAchievement = require("../models/userAchievement");
const Achievement = require("../models/achievement");
const { Op } = require("sequelize");
const getAllMentors = async (req, res) => {
  try {
    console.log("🔑 Logged-in mentee id:", req.user?.id);

    const mentors = await Mentor.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "countryCode", "picture", "status", "userType", "mentorLevel", "sessionsCompleted", "rating"],
          where: { status: "approved", userType: "mentor" },
        },
      ],
    });

    // safe parser helper
    const safeParse = (val) => {
       if (!val) return [];
       if (Array.isArray(val)) return val;
       if (typeof val === 'string') {
          try { return JSON.parse(val); } catch(e) { return [val]; }
       }
       return [];
    };

    const formatted = await Promise.all(mentors.map(async (m) => {
      const reviewCount = await Review.count({ where: { mentorId: m.id } });
      return {
        id: m.id,
        user_id: m.user_id,
        user: {
          id: m.user?.id,
          name: m.user?.name || "Unknown",
          countryCode: m.user?.countryCode || "NG",
          picture: m.user?.picture || "http://localhost:5000/uploads/default.png",
          mentorLevel: m.user?.mentorLevel || 'starter',
          sessionsCompleted: m.user?.sessionsCompleted || 0,
          rating: m.user?.rating || 0,
        },
        role: m.role || "Mentor",
        expertise: safeParse(m.expertise),
        yearsOfExperience: m.yearsOfExperience || 0,
        attendance: m.attendance || "0%",
        sessions: m.user?.sessionsCompleted || 0,
        reviews: reviewCount,
      };
    }));

    // 🏆 Custom Ranking System
    // 1. mentor_level (gold first, then verified, then starter)
    // 2. rating (descending)
    // 3. sessions_completed (descending)
    const levelScore = { gold: 3, verified: 2, starter: 1 };
    
    formatted.sort((a, b) => {
      const aScore = levelScore[a.user.mentorLevel] || 1;
      const bScore = levelScore[b.user.mentorLevel] || 1;
      
      if (aScore !== bScore) return bScore - aScore; // Descending
      if (a.user.rating !== b.user.rating) return b.user.rating - a.user.rating; // Descending
      return b.user.sessionsCompleted - a.user.sessionsCompleted; // Descending
    });

    res.status(200).json({
      status: "success",
      results: formatted.length,
      data: formatted,
    });
  } catch (err) {
    console.error("❌ Error fetching mentors:", err);
    res.status(500).json({ status: "fail", message: "Server error" });
  }
};

// ✅ Fetch full details of a specific mentor (for mentee)
const getMentorsDetails = async (req, res) => {
  try {
    const id = req.params.id || req.query.id;
    if (!id) {
      return res.status(400).json({ status: "fail", message: "Mentor ID is required" });
    }

    const mentor = await Mentor.findOne({
      where: {
        [Op.or]: [
          { id: id },
          { user_id: id }
        ]
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "name",
            "email",
            "picture",
            "status",
            "userType",
            "countryCode",
            "mentorLevel",
            "sessionsCompleted",
            "rating",
          ],
        },
      ],
    });

    if (!mentor) {
      return res.status(404).json({ status: "fail", message: "Mentor not found" });
    }

    // Fetch appointments for metrics
    const appointments = await Appointment.findAll({
      where: { mentorId: mentor.id }
    });

    let minutesTrained = 0;
    const uniqueMentees = new Set();
    let completedCount = 0;
    let scheduledCount = 0;

    appointments.forEach(app => {
      if (app.status === 'completed' || app.status === 'accepted') {
        scheduledCount++;
      }
      if (app.status === 'completed') {
        completedCount++;
        uniqueMentees.add(app.menteeId);
        minutesTrained += 60; // Fixed duration since call integration is missing
      }
    });

    const attendanceRate = scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0;

    // Fetch Reviews
    const reviews = await Review.findAll({
      where: { mentorId: mentor.id },
      include: [
        {
          model: Mentee,
          as: "mentee",
          include: [{ model: User, as: "user", attributes: ["id", "name", "picture"] }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    const safeParse = (val) => {
       if (!val) return [];
       if (Array.isArray(val)) return val;
       if (typeof val === 'string') {
          try { return JSON.parse(val); } catch(e) { return [val]; }
       }
       return [];
    };

    // Fetch Gamification Badges
    const userAchievements = await UserAchievement.findAll({
        where: { user_id: mentor.user_id },
        include: [{ model: Achievement, as: "achievement" }]
    });
    const achievementsList = userAchievements.map(ua => ({
        id: ua.id,
        title: ua.achievement?.title,
        description: ua.achievement?.description,
        icon: ua.achievement?.icon,
        earned_at: ua.earned_at
    }));

    const profile = {
      id: mentor.id,
      user_id: mentor.user_id,
      name: mentor.user?.name || "Unknown",
      email: mentor.user?.email || "",
      picture: mentor.user?.picture || "http://localhost:5000/uploads/default.png",
      status: mentor.user?.status || "",
      userType: mentor.user?.userType || "",
      mentorLevel: mentor.user?.mentorLevel || "starter",
      sessionsCompleted: mentor.user?.sessionsCompleted || 0,
      rating: mentor.user?.rating || 0,
      linkedinUrl: mentor.linkedinUrl || "",
      isOnline: mentor.isOnline,
      countryCode: mentor.user?.countryCode || "NG",
      role: mentor.role || "", // ✅ role comes from mentor table
      bio: mentor.bio || "",
      expertise: safeParse(mentor.expertise),
      topics: safeParse(mentor.topics),
      discipline: safeParse(mentor.discipline),
      fluentIn: safeParse(mentor.fluentIn),
      education: safeParse(mentor.education),
      experience: safeParse(mentor.experience),
      experienceDescription: mentor.experienceDescription || "",
      yearsOfExperience: mentor.yearsOfExperience || 0,
      attendanceRate: attendanceRate + "%",
      minutesTrained: minutesTrained,
      menteesGuided: uniqueMentees.size,
      reviews: reviews,
      achievements: achievementsList
    };

    res.status(200).json({ status: "success", data: profile });
  } catch (err) {
    console.error("❌ Error fetching mentor profile:", err);
    res.status(500).json({ status: "fail", message: "Server error" });
  }
};


module.exports = {
    getAllMentors,
    getMentorsDetails,
}