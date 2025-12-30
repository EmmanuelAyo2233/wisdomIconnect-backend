// controllers/mentorController.js
const { User, Mentor } = require("../models");
const { Op } = require("sequelize");
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
      where: { id },
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
          ],
        },
      ],
    });

    if (!mentor) {
      return res.status(404).json({ status: "fail", message: "Mentor not found" });
    }

    // Fetch mentor's available slots
    // const availableSlots = await Availability.findAll({
    //   where: { mentorId: mentor.id },
    //   order: [
    //     ["date", "ASC"],
    //     ["time", "ASC"],
    //   ],
    // });

    const profile = {
      id: mentor.id,
      user_id: mentor.user_id,
      name: mentor.user?.name || "Unknown",
      email: mentor.user?.email || "",
      picture: mentor.user?.picture || "images/default-avatar.png",
      status: mentor.user?.status || "",
      userType: mentor.user?.userType || "",
      linkedinUrl: mentor.linkedinUrl || "",
      isOnline: mentor.isOnline,
      countryCode: mentor.user?.countryCode || "NG",
      role: mentor.role || "", // ✅ role comes from mentor table
      bio: mentor.bio || "",
      expertise: mentor.expertise ? JSON.parse(mentor.expertise) : [],
      discipline: mentor.discipline ? JSON.parse(mentor.discipline) : [],
      fluentIn: mentor.fluentIn ? JSON.parse(mentor.fluentIn) : [],
      education: mentor.education ? JSON.parse(mentor.education) : [],
      experience: mentor.experience ? JSON.parse(mentor.experience) : [],
      experienceDescription: mentor.experienceDescription || "",
      yearsOfExperience: mentor.yearsOfExperience || 0,
      attendance: mentor.attendance || "0%",
      // availableSlots,
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