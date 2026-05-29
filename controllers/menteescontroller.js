const {
    User,
    Mentor,
    Appointment,
    Mentee,
    Availability,
} = require("../models");

// Retrieves a list of all available mentors
const getAllMentors = async (req, res) => {
  try {
    console.log("🔑 Logged-in mentee id:", req.user?.id);

    const mentors = await Mentor.findAll({
      include: [
        {
          model: User,
           as: "user",
          attributes: ["id", "name", "countryCode", "picture", "status", "userType"],
          where: { status: "approved", userType: "mentor" },
        },
      ],
    });

    const formatted = mentors.map((m) => ({
      id: m.id,
      user_id: m.user_id,
     user: {
  id: m.user?.id,
  name: m.user?.name || "Unknown",
  countryCode: m.user?.countryCode || "NG",
   picture: m.user?.picture || "http://localhost:5000/uploads/default.png",
},

      expertise: m.expertise ? JSON.parse(m.expertise) : [],
      yearsOfExperience: m.yearsOfExperience || 0,
      attendance: m.attendance || "0%",
      sessions: m.sessions || 0,
      reviews: m.reviews || 0,
    }));

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
      where: { id, status: "approved" },
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
            "role",
            "linkedinUrl",
            "countryCode",
            "rating",
            "mentorLevel",
            "sessionsCompleted",
          ],
        },
      ],
    });

    if (!mentor) {
      return res.status(404).json({ status: "fail", message: "Mentor not found" });
    }

    // Fetch mentor's available slots
    const availableSlots = await Availability.findAll({
      where: { mentorId: mentor.id },
      order: [
        ["date", "ASC"],
        ["time", "ASC"],
      ],
    });

    // ✅ Fetch reviews (approved only; filter hidden in JS — isHidden col may not exist in DB)
    const Review = require("../models/review");
    const allReviews = await Review.findAll({
      where: { mentorId: mentor.id, status: "approved" },
      include: [{ model: Mentee, as: "mentee", include: [{ model: User, as: "user", attributes: ["id", "name", "picture"] }] }],
      order: [["createdAt", "DESC"]]
    });
    const reviews = allReviews.filter(r => !r.isHidden);

    // ✅ Fetch achievements
    let achievementsList = [];
    try {
      const UserAchievement = require("../models/userAchievement");
      const Achievement = require("../models/achievement");
      const userAchievements = await UserAchievement.findAll({
        where: { user_id: mentor.user_id, role: "mentor" },
        include: [{ model: Achievement, as: "achievement" }]
      });
      achievementsList = userAchievements.map(ua => ({
        id: ua.id,
        title: ua.achievement?.title,
        description: ua.achievement?.description,
        icon: ua.achievement?.icon,
        criteria_type: ua.achievement?.criteria_type,
        earned_at: ua.earned_at
      }));
    } catch(e) {}

    const safeParseJSON = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch(e) { return []; }
    };

    const profile = {
      id: mentor.id,
      user_id: mentor.user_id,
      name: mentor.user?.name || "Unknown",
      email: mentor.user?.email || "",
      picture: mentor.user?.picture || "images/default-avatar.png",
      status: mentor.user?.status || "",
      userType: mentor.user?.userType || "",
      occupation: mentor.role || mentor.user?.role || "",
      role: mentor.role || mentor.user?.role || "",
      linkedinUrl: mentor.linkedinUrl || mentor.user?.linkedinUrl || "",
      countryCode: mentor.user?.countryCode || "NG",
      rating: mentor.user?.rating || 0,
      mentorLevel: mentor.user?.mentorLevel || "starter",
      sessionsCompleted: mentor.user?.sessionsCompleted || 0,
      bio: mentor.bio || "",
      expertise: safeParseJSON(mentor.expertise),
      discipline: safeParseJSON(mentor.discipline),
      disciplines: safeParseJSON(mentor.discipline),
      industries: safeParseJSON(mentor.industries),
      fluentIn: safeParseJSON(mentor.fluentIn),
      education: safeParseJSON(mentor.education),
      experience: safeParseJSON(mentor.experience),
      experienceDescription: mentor.experienceDescription || "",
      yearsOfExperience: mentor.yearsOfExperience || 0,
      sessionPrice: mentor.sessionPrice || 0,
      attendance: mentor.attendance || "0%",
      availableSlots,
      reviews,
      achievements: achievementsList,
    };

    res.status(200).json({ status: "success", data: profile });
  } catch (err) {
    console.error("❌ Error fetching mentor profile:", err);
    res.status(500).json({ status: "fail", message: "Server error" });
  }
};


const { MentorCommendation } = require("../models");

// ✅ Fetch full details of a specific mentee (for mentor/public view)
const getMenteeProfileById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ status: "fail", message: "Mentee ID is required" });

    // Try finding Mentee by mentee table id, or fallback to user_id
    let mentee = await Mentee.findOne({
      where: { id },
      include: [{ model: User, as: "user", attributes: ["id", "name", "picture", "email", "status", "userType", "countryCode"] }]
    });

    if (!mentee) {
      mentee = await Mentee.findOne({
         where: { user_id: id },
         include: [{ model: User, as: "user", attributes: ["id", "name", "picture", "email", "status", "userType", "countryCode"] }]
      });
    }

    if (!mentee) return res.status(404).json({ status: "fail", message: "Mentee not found" });

    // Appointments fetching for impact data
    const appointments = await Appointment.findAll({
      where: { menteeId: mentee.id }
    });

    let minutesLearned = 0;
    let completedCount = 0;
    let scheduledCount = 0;

    appointments.forEach(app => {
      if (app.status === 'completed' || app.status === 'accepted') scheduledCount++;
      if (app.status === 'completed') {
        completedCount++;
        minutesLearned += 60; // Fixed duration per user request
      }
    });

    const attendanceRate = scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0;

    // Mentor Commendations (filter hidden in JS — isHidden col may not exist in DB)
    let commendations = [];
    try {
      if (MentorCommendation) {
         const allComms = await MentorCommendation.findAll({
            where: { menteeId: mentee.id },
            include: [{ model: Mentor, as: "mentor", include: [{ model: User, as: "user", attributes: ["name", "picture", "id"] }] }],
            order: [["createdAt", "DESC"]]
         });
         commendations = allComms.filter(c => !c.isHidden);
      }
    } catch(e) {}

    // Fetch Gamification Badges
    const UserAchievement = require("../models/userAchievement");
    const Achievement = require("../models/achievement");
    
    // Enforce Privacy: profileVisibility
    let privacySettings = {};
    if (mentee.privacySettings) {
      try {
        privacySettings = typeof mentee.privacySettings === 'string' ? JSON.parse(mentee.privacySettings) : mentee.privacySettings;
      } catch (e) {
        privacySettings = mentee.privacySettings;
      }
    }
    const isOwner = req.user?.id === mentee.user_id;

    if (!isOwner && privacySettings.profileVisibility === 'private') {
      return res.status(403).json({ status: "fail", message: "This mentee's profile is private." });
    }

    let achievementsList = [];
    if (isOwner || privacySettings.showAchievements !== false) {
       try {
          const userAchievements = await UserAchievement.findAll({
              where: { user_id: mentee.user_id, role: "mentee" },
              include: [{ model: Achievement, as: "achievement" }]
          });
          achievementsList = userAchievements.map(ua => ({
              id: ua.id,
              title: ua.achievement?.title,
              description: ua.achievement?.description,
              icon: ua.achievement?.icon,
              criteria_type: ua.achievement?.criteria_type,
              earned_at: ua.earned_at
          }));
       } catch(e) {}
    }

    const profileData = {
      ...mentee.toJSON(),
      role: mentee.role || "Mentee",
      name: mentee.user?.name || "Unknown",
      picture: mentee.user?.picture || "http://localhost:5000/uploads/default.png",
      countryCode: mentee.user?.countryCode || "NG",
      email: mentee.user?.email,
      impact: {
        sessionsAttended: completedCount,
        minutesLearned: minutesLearned,
        attendanceRate: attendanceRate
      },
      commendations,
      achievements: achievementsList
    };

    res.status(200).json({ status: "success", data: profileData });
  } catch (err) {
    console.error("error fetching mentee", err);
    res.status(500).json({ status: "fail", message: "Server error" });
  }
};


// Allows a mentee to book an appointment with a mentor
const bookApppointment = async (req, res) => {
    try {
        const { id: mentorId } = req.params;
        const body = req.body;

        const menteeId = req.user.id;

        const mentor = await User.findOne({
            where: { id: mentorId, userType: "mentor" },
            include: [{ model: Mentor, as: "mentor", required: false }],
            attributes: { exclude: ["password"] },
        });

        if (!mentor) {
            return res.status(404).json({
                status: "fail",
                message: "Mentor not found",
            });
        }

        const mentee = await User.findOne({
            where: { id: menteeId },
            include: [{ model: Mentee, as: "mentee", required: false }],
            attributes: { exclude: ["password"] },
        });

        if (!mentee) {
            return res.status(404).json({
                status: "fail",
                message: "Mentee profile not found",
            });
        }

        const appointment = await Appointment.create({
            menteeId: mentee.mentee.id,
            mentorId: mentor.mentor.id,
            date: body.date,
            time: body.time,
        });

        return res.status(201).json({
            status: "success",
            message: "Appointment Booked with Mentor",
            data: appointment,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to book appointment",
            error: error.message,
        });
    }
};

// Allows a mentee to list all appointments
const apppointmentLists = async (req, res) => {
    try {
        const menteeId = req.user.id;

        const appointment = await Appointment.findAll({
            where: { menteeId },
        });

        if (appointment.length === 0) {
            return res.status(404).json({
                status: "fail",
                message: "No appointment found",
            });
        }
        return res.status(201).json({
            status: "success",
            message: "Booked appointments fetched",
            data: appointment,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to lisr all appointments",
            error: error.message,
        });
    }
};

// Allows mentee to reschedule an appointment
const resceduleAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const body = req.body;
        const menteeId = req.user.id;

        const appointment = await Appointment.findOne({
            where: { id: appointmentId, menteeId },
        });

        if (!appointment) {
            return res.status(404).json({
                status: "fail",
                message: "Appointment not found",
            });
        }

        appointment.date = body.date || appointment.date;
        appointment.time = body.time || appointment.time;
        appointment.status = "pending";

        appointment.save();

        return res.status(201).json({
            status: "success",
            message: "Appointment Reschdeuled with Mentor",
            data: appointment,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to reschedule appointment",
            error: error.message,
        });
    }
};

// Allows a mentee to cancel an appointment
const cancelAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const body = req.body;
        const menteeId = req.user.id;

        const appointment = await Appointment.findOne({
            where: { id: appointmentId, menteeId },
        });

        if (!appointment) {
            return res.status(404).json({
                status: "fail",
                message: "Appointment not found",
            });
        }

        appointment.status = body.status;

        appointment.save();

        return res.status(201).json({
            status: "success",
            message: "Appointment Cancelled with Mentor name",
            data: appointment,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to cancel appointment",
            error: error.message,
        });
    }
};

// Allows a mentee to delete an appointment
const deleteAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const body = req.body;
        const menteeId = req.user.id;

        const appointment = await Appointment.findOne({
            where: { id: appointmentId, menteeId },
        });

        if (!appointment) {
            return res.status(404).json({
                status: "fail",
                message: "Appointment not found",
            });
        }

        await appointment.destroy();

        return res.status(201).json({
            status: "success",
            message: "Appointment deleted succefully",
            data: appointment,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete appointment",
            error: error.message,
        });
    }
};

module.exports = {
    getAllMentors,
    getMentorsDetails,
    getMenteeProfileById,
    bookApppointment,
    resceduleAppointment,
    cancelAppointment,
    deleteAppointment,
    apppointmentLists,
};
