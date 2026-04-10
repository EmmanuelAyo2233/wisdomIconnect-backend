const { User, Mentee, Mentor, Appointment, Review, MentorCommendation } = require("../models");
const UserAchievement = require("../models/userAchievement");
const Achievement = require("../models/achievement");
const { cloudinary } = require("../utils/cloudinary");
const streamifier = require("streamifier");

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
          sessionsCompleted: completedCount, // Changed from menteesGuided
          attendanceRate: scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 100
       };

       reviews = await Review.findAll({
          where: { mentorId: user.mentor.id },
          include: [{ model: Mentee, as: "mentee", include: [{ model: User, as: "user", attributes: ["id", "name", "picture"] }] }],
          order: [["createdAt", "DESC"]]
       });
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
          sessionsAttended: completedCount,
          minutesLearned: completedCount * 60,
          attendanceRate: scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 100
       };

       commendations = await MentorCommendation.findAll({
          where: { menteeId: user.mentee.id },
          include: [{ model: Mentor, as: "mentor", include: [{ model: User, as: "user", attributes: ["id", "name", "picture"] }] }],
          order: [["createdAt", "DESC"]]
       });
    }

    // Fetch Gamification Badges
    const userAchievements = await UserAchievement.findAll({
        where: { user_id: user.id },
        include: [{ model: Achievement, as: "achievement" }]
    });
    const achievementsList = userAchievements.map(ua => ({
        id: ua.id,
        title: ua.achievement?.title,
        description: ua.achievement?.description,
        icon: ua.achievement?.icon,
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

module.exports = {
  getdetails,
  updateDetails,
  uploadprofilePicture,
  deleteAccount,
};
