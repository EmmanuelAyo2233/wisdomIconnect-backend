const { User, Mentee, Mentor, Appointment, Review, MentorCommendation, Achievement } = require("../models");
const UserAchievement = require("../models/userAchievement");
const { cloudinary } = require("../utils/cloudinary");
const streamifier = require("streamifier");
const { bcrypt } = require("../config/reuseablePackages");

// Helper to safely parse JSON or fallback to array
const safeParseJSON = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && value !== null) return value;
  try {
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
};

// --- Get user details ---
const getdetails = async (req, res) => {
  try {
    const user = req.user; // populated via authentication middleware
    let extraInfo = {};

    if (user.userType === "mentor" && user.mentor) {
      extraInfo = user.mentor.dataValues;
    } else if (user.userType === "mentee" && user.mentee) {
      extraInfo = user.mentee.dataValues;
    }

    // Impact Statistics & Reviews/Commendations
    let impact = { sessionsAttended: 0, minutesLearned: 0, minutesTrained: 0, menteesGuided: 0, attendanceRate: 0 };
    let reviews = [];
    let commendations = [];

    if (user.userType === 'mentor' && user.mentor) {
       const appointments = await Appointment.findAll({ where: { mentorId: user.mentor.id } });
       const uniqueMentees = new Set();
       let completedCount = 0;
       let scheduledCount = 0;

       appointments.forEach(app => {
          if (app.status === 'completed' || app.status === 'accepted') scheduledCount++;
          if (app.status === 'completed') {
             completedCount++;
             uniqueMentees.add(app.menteeId);
          }
       });

       impact = {
          sessionsAttended: completedCount,
          minutesTrained: completedCount * 60,
          sessionsCompleted: completedCount || user.sessionsCompleted || 0, // Fallback to user model if no appointments found
          attendanceRate: scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 100
       };

       const allReviews = await Review.findAll({
          where: { mentorId: user.mentor.id, status: "approved" },
          include: [{ model: Mentee, as: "mentee", include: [{ model: User, as: "user", attributes: ["id", "name", "picture"] }] }],
          order: [["createdAt", "DESC"]]
       });
       // Filter hidden reviews in JS (isHidden column may not exist in DB yet)
       reviews = allReviews.filter(r => !r.isHidden);
    } else if (user.userType === 'mentee' && user.mentee) {
       const appointments = await Appointment.findAll({ where: { menteeId: user.mentee.id } });
       let completedCount = 0;
       let scheduledCount = 0;

       appointments.forEach(app => {
          if (app.status === 'completed' || app.status === 'accepted') scheduledCount++;
          if (app.status === 'completed') {
             completedCount++;
          }
       });

       impact = {
          sessionsAttended: completedCount || user.sessionsCompleted || 0,
          minutesLearned: completedCount * 60,
          attendanceRate: scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 100
       };

       const allCommendations = await MentorCommendation.findAll({
          where: { menteeId: user.mentee.id, status: "approved" },
          include: [{ model: Mentor, as: "mentor", include: [{ model: User, as: "user", attributes: ["id", "name", "picture"] }] }],
          order: [["createdAt", "DESC"]]
       });
       // Filter hidden commendations in JS (isHidden column may not exist in DB yet)
       commendations = allCommendations.filter(c => !c.isHidden);
    }

    // --- Gamification Sync Logic (Dynamic Milestone System) ---
    // STRICT: only fetch achievements for this exact role — never award cross-role achievements
    const roleAchievements = await Achievement.findAll({
       where: { role: user.userType }
    });
    const existingUserAchievements = await UserAchievement.findAll({ where: { user_id: user.id, role: user.userType } });
    const existingEarnedIds = new Set(existingUserAchievements.map(ua => ua.achievement_id));

    // Build comprehensive stats
    const sessionCount = impact.sessionsCompleted || impact.sessionsAttended || 0;
    const minuteCount = impact.minutesTrained || impact.minutesLearned || 0;

    let stats = {
       sessions: sessionCount,
       minutes: minuteCount,
       rating: user.rating || 0,
       bookings: 0,
    };

    // Count bookings for mentees
    if (user.userType === 'mentee' && user.mentee) {
       const totalBookings = await Appointment.count({ where: { menteeId: user.mentee.id } });
       stats.bookings = totalBookings;
    }

    // Map criteria_type to current stat value
    const statMap = {
       mentor_sessions:    stats.sessions,
       mentor_minutes:     stats.minutes,
       mentee_sessions:    stats.sessions,
       mentee_minutes:     stats.minutes,
       mentee_bookings:    stats.bookings,
       mentee_streaks:     0,
    };

    const newBadgesToAward = [];
    for (const ach of roleAchievements) {
       if (existingEarnedIds.has(ach.id)) continue;

       if (ach.criteria_type === 'mentor_leaderboard') {
          // Count how many approved mentors exist — award if user ranks within threshold
          const totalMentors = await Mentor.count();
          if (totalMentors <= ach.criteria_threshold) {
             newBadgesToAward.push({ user_id: user.id, role: user.userType, achievement_id: ach.id, earned_at: new Date() });
          }
       } else {
          const currentVal = statMap[ach.criteria_type] ?? 0;
          if (currentVal >= ach.criteria_threshold) {
             newBadgesToAward.push({ user_id: user.id, role: user.userType, achievement_id: ach.id, earned_at: new Date() });
          }
       }
    }

    if (newBadgesToAward.length > 0) {
       console.log(`🏆 Awarding ${newBadgesToAward.length} new achievements to user ${user.id} (${user.userType})`);
       try {
          await UserAchievement.bulkCreate(newBadgesToAward, { ignoreDuplicates: true });
       } catch(bulkErr) {
          console.error("bulkCreate error:", bulkErr.message);
          // Insert one-by-one as fallback
          for (const badge of newBadgesToAward) {
             try { await UserAchievement.create(badge); } catch(e) {}
          }
       }
    }

    // Fetch final achievements list (ONLY unlocked)
    const finalUserAchievements = await UserAchievement.findAll({
        where: { user_id: user.id, role: user.userType },
        include: [{ model: Achievement, as: "achievement" }]
    });
    const achievementsList = finalUserAchievements.map(ua => ({
        id: ua.achievement?.id,
        title: ua.achievement?.title,
        description: ua.achievement?.description,
        icon: ua.achievement?.icon,
        criteria_type: ua.achievement?.criteria_type,
        earned_at: ua.earned_at
    }));

    const userData = {
      id: user.id,
      mentor_id: user.mentor?.id,
      mentee_id: user.mentee?.id,
      name: user.name || "",
      email: user.email || "",
      userType: user.userType || "",
      status: user.status || "",
      picture: user.picture || null,
      countryCode: user.countryCode || "NG",
      mentorLevel: user.mentorLevel || 'starter',
      rating: user.rating || 0,
      bio: extraInfo.bio || "",
      role: extraInfo.role || "",
      phone: extraInfo.phone || "",
      linkedinUrl: extraInfo.linkedinUrl || "",
      expertise: safeParseJSON(extraInfo.expertise) || [],
      fluentIn: safeParseJSON(extraInfo.fluentIn) || [],
      industries: safeParseJSON(extraInfo.industries) || [],
      experience: safeParseJSON(extraInfo.experience) || [],
      interest: safeParseJSON(extraInfo.interest) || safeParseJSON(extraInfo.interests) || [],
      discipline: safeParseJSON(extraInfo.discipline) || [],
      education: safeParseJSON(extraInfo.education) || [],
      topics: safeParseJSON(extraInfo.topics) || [],
      default_duration: extraInfo.default_duration || 30,
      sessionPrice: extraInfo.sessionPrice || 0,
      yearsOfExperience: extraInfo.yearsOfExperience || 0,
      experienceDescription: extraInfo.experienceDescription || "",
      // Mentor settings fields
      autoAccept: extraInfo.autoAccept ?? false,
      instantBooking: extraInfo.instantBooking ?? false,
      maxSessionsPerDay: extraInfo.maxSessionsPerDay ?? 5,
      showInExplore: extraInfo.showInExplore ?? true,
      showPricing: extraInfo.showPricing ?? true,
      notifPrefs: extraInfo.notifPrefs || null,
      privacySettings: extraInfo.privacySettings || null,
      impact,
      reviews,
      commendations,
      achievements: achievementsList
    };

    return res.status(200).json({
      status: "success",
      message: "Fetched user details successfully",
      data: userData,
    });
  } catch (err) {
    console.error("Error in getdetails:", err);
    res.status(500).json({ status: "fail", message: "Server error" });
  }
};

// --- Get all available platform achievements ---
const getAllPlatformAchievements = async (req, res) => {
  try {
    const achievements = await Achievement.findAll();
    return res.status(200).json({
      status: "success",
      data: achievements
    });
  } catch (err) {
    console.error("Error fetching all platform achievements:", err);
    res.status(500).json({ status: "fail", message: "Server error fetching achievements" });
  }
};

// --- Update user details ---
const updateDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ status: "error", message: "User not found" });

    // Update base User fields only if provided
    user.name = body.name || user.name;
    user.email = body.email || user.email;
    if (body.password) user.password = body.password;
    await user.save();

    // Update Mentor or Mentee
    if (user.userType === "mentor") {
      const mentor = await Mentor.findOne({ where: { user_id: userId } });
      if (mentor) {
        mentor.bio = body.bio || mentor.bio;
        mentor.experienceDescription = body.experienceDescription || mentor.experienceDescription;
        mentor.gender = body.gender || mentor.gender;
        mentor.role = body.occupation || body.role || mentor.role;
        mentor.yearsOfExperience = body.yearsOfExperience ?? mentor.yearsOfExperience ?? 0;
        mentor.available = body.available ?? mentor.available;
        mentor.slotBooked = body.slotBooked ?? mentor.slotBooked;
        mentor.phone = body.phone || mentor.phone;
        mentor.linkedinUrl = body.linkedinUrl || mentor.linkedinUrl || "";
        mentor.expertise = JSON.stringify(body.expertise || safeParseJSON(mentor.expertise));
        mentor.fluentIn = JSON.stringify(body.fluentIn || safeParseJSON(mentor.fluentIn));
        mentor.discipline = JSON.stringify(body.disciplines || safeParseJSON(mentor.discipline));
        mentor.industries = JSON.stringify(body.industries || safeParseJSON(mentor.industries));
        mentor.education = JSON.stringify(body.education || safeParseJSON(mentor.education));
        mentor.experience = JSON.stringify(body.experience || safeParseJSON(mentor.experience));
        if (body.topics !== undefined) mentor.topics = JSON.stringify(body.topics);
        if (body.default_duration !== undefined) mentor.default_duration = parseInt(body.default_duration);
        if (body.sessionPrice !== undefined) mentor.sessionPrice = parseFloat(body.sessionPrice);
        mentor.startDate = body.startDate || mentor.startDate;
        mentor.endDate = body.endDate || mentor.endDate;

        await mentor.save();
      }
    } else if (user.userType === "mentee") {
      const mentee = await Mentee.findOne({ where: { user_id: userId } });
      if (mentee) {
        mentee.bio = body.bio || mentee.bio;
        mentee.gender = body.gender || mentee.gender;
        mentee.role = body.occupation || body.role || mentee.role;
        mentee.phone = body.phone || mentee.phone;
        mentee.linkedinUrl = body.linkedinUrl || mentee.linkedinUrl || "";
        mentee.fluentIn = JSON.stringify(body.fluentIn || safeParseJSON(mentee.fluentIn));
        mentee.interest = JSON.stringify(body.interests || safeParseJSON(mentee.interest));
        
        // New fields
        mentee.expertise = JSON.stringify(body.expertise || safeParseJSON(mentee.expertise));
        mentee.discipline = JSON.stringify(body.disciplines || safeParseJSON(mentee.discipline));
        mentee.industries = JSON.stringify(body.industries || safeParseJSON(mentee.industries));
        mentee.experience = JSON.stringify(body.experience || safeParseJSON(mentee.experience));
        mentee.education = JSON.stringify(body.education || safeParseJSON(mentee.education));

        mentee.startDate = body.startDate || mentee.startDate;
        mentee.endDate = body.endDate || mentee.endDate;

        await mentee.save();
      }
    }
    console.log("Updated Profile for userId:", userId);

    return res.status(200).json({
      status: "success",
      message: "User details updated successfully",
    });
  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to update details",
      error: err.message,
    });
  }

  
};
const uploadprofilePicture = async (req, res) => {
  try {
    const user = req.user;
    const file = req.file;

    if (!file || !file.buffer) {
      return res.status(400).json({ status: "fail", message: "No image provided" });
    }

    const publicId = `emmanuel_profile_${user.id}`; // stable id per user

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER_NAME,
        resource_type: "image",
        public_id: publicId,
        overwrite: true,
        invalidate: true, // ✅ ask CDN to invalidate cached version
      },
      async (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ status: "error", message: "Cloudinary upload failed" });
        }

        const imageUrl = result.secure_url; // has a new /v####/ version every overwrite

        // ✅ write to the right column
        const [updatedRows] = await User.update(
          { picture: imageUrl },
          { where: { id: user.id } }
        );

        if (updatedRows === 0) {
          return res.status(404).json({ status: "fail", message: "User not found" });
        }

        return res.status(200).json({
          status: "success",
          message: "Profile picture updated successfully",
          imageUrl,
        });
      }
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  } catch (err) {
    console.error("Upload profile picture error:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to update profile picture",
      error: err.message,
    });
  }
};

// --- Delete authenticated user account ---
const deleteAccount = async (req, res) => {
  try {
    const useremail = req.user.email;

    const user = await User.findOne({
      where: { email: req.user.email },
      include: [
        { model: Mentee, as: "mentee", required: false },
        { model: Mentor, as: "mentor", required: false },
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    if (useremail !== user.email) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    await user.destroy();

    return res.status(201).json({
      status: "success",
      message: "Account deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to delete account",
      error: error.message,
    });
  }
};

// --- Change Password ---
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ status: 'fail', message: 'currentPassword and newPassword are required' });
    if (newPassword.length < 8)
      return res.status(400).json({ status: 'fail', message: 'Password must be at least 8 characters' });

    const user = await User.findByPk(req.user.id, { attributes: ['id', 'password'] });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ status: 'fail', message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashed });
    return res.status(200).json({ status: 'success', message: 'Password updated successfully' });
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to change password' });
  }
};

// --- Change Email ---
const changeEmail = async (req, res) => {
  try {
    const { newEmail, password } = req.body;
    if (!newEmail || !password)
      return res.status(400).json({ status: 'fail', message: 'newEmail and password are required' });

    const user = await User.findByPk(req.user.id, { attributes: ['id', 'password', 'email'] });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ status: 'fail', message: 'Password is incorrect' });

    const exists = await User.findOne({ where: { email: newEmail } });
    if (exists) return res.status(400).json({ status: 'fail', message: 'Email already in use' });

    await user.update({ email: newEmail });
    return res.status(200).json({ status: 'success', message: 'Email updated successfully' });
  } catch (err) {
    console.error('changeEmail error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to change email' });
  }
};

// --- Update Settings (booking control, privacy, notifications) ---
const updateMentorSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body;

    if (req.user.userType === 'mentor') {
      const mentor = await Mentor.findOne({ where: { user_id: userId } });
      if (!mentor) return res.status(404).json({ status: 'fail', message: 'Mentor profile not found' });

      // Booking control
      if (body.autoAccept !== undefined) mentor.autoAccept = body.autoAccept;
      if (body.instantBooking !== undefined) mentor.instantBooking = body.instantBooking;
      if (body.maxSessionsPerDay !== undefined) mentor.maxSessionsPerDay = parseInt(body.maxSessionsPerDay);
      if (body.showInExplore !== undefined) mentor.showInExplore = body.showInExplore;
      if (body.showPricing !== undefined) mentor.showPricing = body.showPricing;

      // Notification & Privacy
      if (body.notifPrefs !== undefined) mentor.notifPrefs = body.notifPrefs;
      if (body.privacySettings !== undefined) mentor.privacySettings = body.privacySettings;

      await mentor.save();
    } else if (req.user.userType === 'mentee') {
      const mentee = await Mentee.findOne({ where: { user_id: userId } });
      if (!mentee) return res.status(404).json({ status: 'fail', message: 'Mentee profile not found' });

      // Notification & Privacy
      if (body.notifPrefs !== undefined) mentee.notifPrefs = body.notifPrefs;
      if (body.privacySettings !== undefined) mentee.privacySettings = body.privacySettings;
      
      await mentee.save();
    }

    return res.status(200).json({ status: 'success', message: 'Settings updated successfully' });
  } catch (err) {
    console.error('updateSettings error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to update settings' });
  }
};

module.exports = {
  getdetails,
  updateDetails,
  uploadprofilePicture,
  deleteAccount,
  getAllPlatformAchievements,
  changePassword,
  changeEmail,
  updateMentorSettings,
};
