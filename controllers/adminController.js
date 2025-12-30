// controllers/adminController.js
const User = require("../models/user");
const Mentor = require("../models/mentor");
const Mentee = require("../models/mentee");

// --- Stats
exports.getStats = async (req, res) => {
  try {
   const mentorsPending = await User.count({ where: { userType: "mentor", status: "pending" } });
const mentorsApproved = await User.count({ where: { userType: "mentor", status: "approved" } });

// ✅ count rejected by status only, no matter userType
const mentorsRejected = await User.count({ where: { status: "rejected" } });

const mentees = await User.count({ where: { userType: "mentee" } });


    res.json({
      mentorsPending,
      mentorsApproved,
      mentorsRejected,
      mentees,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Error fetching stats", error: error.message });
  }
};

// --- Get pending mentors with mentor table fields merged
exports.getPendingMentors = async (req, res) => {
  try {
    // Make sure you have associations set: User.hasOne(Mentor) and Mentor.belongsTo(User)
   const users = await User.findAll({
  where: { userType: "mentor", status: "pending" },
  attributes: ["id", "name", "email", "status", "createdAt"],
  include: [{
    model: Mentor,
    as: "mentor", // ✅ MUST match the alias you used in your associations
    attributes: ["expertise", "yearsOfExperience", "bio", "linkedinUrl"],
    required: false
  }],
  order: [["createdAt", "DESC"]],
});


    // Normalize Sequelize instances to plain objects and merge mentor fields
    const rows = users.map(u => {
      const plainU = u.get ? u.get({ plain: true }) : u;
      const m = plainU.Mentor || plainU.mentor || {}; // handle either casing

      // If expertise stored as JSON string, try to parse; otherwise leave as-is
      let expertise = m.expertise ?? null;
      if (typeof expertise === "string") {
        try { expertise = JSON.parse(expertise); } catch { /* keep string */ }
      }
      // Make expertise display-friendly (comma list) if array
      if (Array.isArray(expertise)) expertise = expertise.join(", ");

      return {
        id: plainU.id,
        name: plainU.name,
        email: plainU.email,
        expertise: expertise || null,
        experience: m.yearsOfExperience || null,
        bio: m.bio || null,
        linkedin: m.linkedinUrl || null,
        status: plainU.status || null,
      };
    });

    res.json(rows);
  } catch (error) {
    console.error("Error fetching pending mentors:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// --- Approve mentor
// exports.approveMentor = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const mentorUser = await User.findByPk(id);

//     if (!mentorUser || mentorUser.userType !== "mentor") {
//       return res.status(404).json({ message: "Mentor not found" });
//     }

//     mentorUser.status = "approved";
// mentorUser.approvedAt = new Date();
// await mentorUser.save();

//     mentorUser.status = "approved";
//     await mentorUser.save();

//     res.json({ message: "Mentor approved successfully", mentor: mentorUser });
//   } catch (error) {
//     console.error("Error approving mentor:", error);
//     res.status(500).json({ message: "Error approving mentor", error: error.message });
//   }
// };

// --- Reject mentor: convert to mentee
// Approve Mentor
exports.approveMentor = async (req, res) => {
  try {
    const { id } = req.params;

    const mentorUser = await User.findByPk(id);
    if (!mentorUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Set approval info
    mentorUser.status = "approved";      // mark as approved
    mentorUser.userType = "mentor";      // ensure userType is mentor
   mentorUser.approvedAt = new Date(); // set the approved date

    await mentorUser.save();             // save once

    res.json({ message: "Mentor approved successfully", mentor: mentorUser });
  } catch (err) {
    console.error("Error approving mentor:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Reject Mentor
exports.rejectMentor = async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Check the user
    const mentorUser = await User.findByPk(id);
    if (!mentorUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Update the user to mentee + rejected
    mentorUser.userType = "mentee";
    mentorUser.status = "rejected";
    await mentorUser.save();

    // 3️⃣ Remove or mark their mentor profile
    await Mentor.destroy({ where: { user_id: id } });
    // OR if you want to keep history:
    // await Mentor.update({ status: "rejected" }, { where: { user_id: id } });

    res.json({
      message: "Mentor rejected successfully, switched to mentee and removed from mentor list"
    });
  } catch (err) {
    console.error("Error rejecting mentor:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Get all approved mentors with mentor table fields merged
exports.getApprovedMentors = async (req, res) => {
  try {
    const users = await User.findAll({
  where: { userType: "mentor", status: "approved" },
  attributes: ["id", "name", "email", "status", "createdAt", "approvedAt"], // ✅ added approvedAt
  include: [{
    model: Mentor,
    as: "mentor",
    attributes: ["expertise", "yearsOfExperience", "bio", "linkedinUrl"],
    required: false
  }],
  order: [["createdAt", "DESC"]],
});


    const rows = users.map(u => {
      const plainU = u.get ? u.get({ plain: true }) : u;
      const m = plainU.Mentor || plainU.mentor || {};

      let expertise = m.expertise ?? null;
      if (typeof expertise === "string") {
        try { expertise = JSON.parse(expertise); } catch { /* leave as string */ }
      }
      if (Array.isArray(expertise)) expertise = expertise.join(", ");

      return {
        id: plainU.id,
        name: plainU.name,
        email: plainU.email,
        expertise: expertise || null,
        experience: m.yearsOfExperience || null,
        bio: m.bio || null,
        linkedin: m.linkedinUrl || null,
        status: plainU.status || null,
       approvedDate: plainU.approvedAt || null// you can use updatedAt as approved date
      };
    });

    res.json(rows);
  } catch (error) {
    console.error("Error fetching approved mentors:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




exports.deleteMentor = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "Mentor not found" });

    await user.destroy(); // deletes the user
    res.json({ message: "Mentor deleted successfully" });
  } catch (err) {
    console.error("Error deleting mentor:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};



// --- Get all rejected mentors
exports.getRejectedMentors = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { status: "rejected" }, // include all rejected users regardless of type
      attributes: ["id", "name", "email", "status", "updatedAt"], // updatedAt will serve as rejected date
      include: [{
        model: Mentor,
        as: "mentor",
        attributes: ["expertise", "yearsOfExperience", "bio", "linkedinUrl"],
        required: false
      }],
      order: [["updatedAt", "DESC"]],
    });

    const rows = users.map(u => {
      const plainU = u.get ? u.get({ plain: true }) : u;
      const m = plainU.Mentor || plainU.mentor || {};

      let expertise = m.expertise ?? null;
      if (typeof expertise === "string") {
        try { expertise = JSON.parse(expertise); } catch { /* leave string */ }
      }
      if (Array.isArray(expertise)) expertise = expertise.join(", ");

      return {
        id: plainU.id,
        name: plainU.name,
        email: plainU.email,
        expertise: expertise || null,
        experience: m.yearsOfExperience || null,
        bio: m.bio || null,
        linkedin: m.linkedinUrl || null,
        status: plainU.status || null,
        rejectedDate: plainU.updatedAt || null
      };
    });

    res.json(rows);
  } catch (error) {
    console.error("Error fetching rejected mentors:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.reconsiderMentor = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.userType = "mentor";    // revert to mentor
    user.status = "pending";     // or approved if you want
    await user.save();

    res.json({ message: "Mentor moved back to pending" });
  } catch (err) {
    console.error("Error reconsidering mentor:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};




// Get all mentees
// Get all mentees with bio & interests
exports.getMentees = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { userType: "mentee" },
      attributes: ["id", "name", "email", "status", "createdAt"],

      include: [{
        model: Mentee, // make sure association exists: User.hasOne(Mentee)
        as: "mentee",  // match alias in associations
        attributes: ["bio", "interest"],
        required: false
      }],
      order: [["createdAt", "DESC"]],
    });

    const mentees = users.map(u => {
      const plainU = u.get({ plain: true });
      const m = plainU.Mentee || plainU.mentee || {};

      return {
        id: plainU.id,
        name: plainU.name,
        email: plainU.email,
        status: plainU.status,
        joinDate: plainU.createdAt,
        bio: m.bio || "N/A",
        interest: m.interest || "N/A",
      };
    });

    res.json(mentees);
  } catch (err) {
    console.error("Error fetching mentees:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};



// Delete mentee
exports.deleteMentee = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user || user.userType !== "mentee") {
      return res.status(404).json({ message: "Mentee not found" });
    }

    await user.destroy();
    res.json({ message: "Mentee deleted successfully" });
  } catch (err) {
    console.error("Error deleting mentee:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
