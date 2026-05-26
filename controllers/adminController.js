// controllers/adminController.js
const User = require("../models/user");
const Mentor = require("../models/mentor");
const Mentee = require("../models/mentee");

// --- Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      order: [["createdAt", "DESC"]],
    });
    const rows = users.map(u => ({
      id: u.id,
      firstName: u.name.split(' ')[0] || '',
      lastName: u.name.split(' ').slice(1).join(' ') || '',
      email: u.email,
      role: u.userType.charAt(0).toUpperCase() + u.userType.slice(1),
      isVerified: u.status === 'approved' || (u.userType === 'admin'),
      createdAt: u.createdAt
    }));
    res.json({ users: rows });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// --- Stats
exports.getStats = async (req, res) => {
  try {
   const mentorsPending = await User.count({ where: { userType: "mentor", status: "pending" } });
   const mentorsApproved = await User.count({ where: { userType: "mentor", status: "approved" } });

   // count rejected by status only, no matter userType
   const mentorsRejected = await User.count({ where: { status: "rejected" } });
   const mentees = await User.count({ where: { userType: "mentee" } });

   const totalSessions = await Appointment.count();

   const recentActivity = await AdminLog.findAll({
     limit: 5,
     order: [['createdAt', 'DESC']],
     include: [{ model: User, as: 'admin', attributes: ['name', 'userType'] }]
   });

    res.json({
      mentorsPending,
      mentorsApproved,
      mentorsRejected,
      mentees,
      totalSessions,
      recentActivity
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
      let certUrl = null;

      if (typeof expertise === "string") {
        try { expertise = JSON.parse(expertise); } catch { /* keep string */ }
      }
      
      if (Array.isArray(expertise)) {
        const certEntry = expertise.find(e => typeof e === 'string' && e.startsWith('CERTIFICATE_URL_'));
        if (certEntry) {
           certUrl = certEntry.replace('CERTIFICATE_URL_', '');
           expertise = expertise.filter(e => e !== certEntry);
        }
        expertise = expertise.join(", ");
      }

      return {
        id: plainU.id,
        name: plainU.name,
        email: plainU.email,
        expertise: expertise || null,
        experience: m.yearsOfExperience || null,
        bio: m.bio || null,
        linkedin: m.linkedinUrl || null,
        certificateUrl: certUrl,
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
    
    // 4️⃣ Create Mentee profile if it doesn't exist
    const existingMentee = await Mentee.findOne({ where: { user_id: id } });
    if (!existingMentee) {
      await Mentee.create({ user_id: id });
    }

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
      let certUrl = null;
      
      if (typeof expertise === "string") {
        try { expertise = JSON.parse(expertise); } catch { /* leave as string */ }
      }
      
      if (Array.isArray(expertise)) {
        const certEntry = expertise.find(e => typeof e === 'string' && e.startsWith('CERTIFICATE_URL_'));
        if (certEntry) {
           certUrl = certEntry.replace('CERTIFICATE_URL_', '');
           expertise = expertise.filter(e => e !== certEntry);
        }
        expertise = expertise.join(", ");
      }

      return {
        id: plainU.id,
        name: plainU.name,
        email: plainU.email,
        expertise: expertise || null,
        experience: m.yearsOfExperience || null,
        bio: m.bio || null,
        linkedin: m.linkedinUrl || null,
        certificateUrl: certUrl || null,
        status: plainU.status || null,
        approvedDate: plainU.approvedAt || plainU.updatedAt || null
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
      let certUrl = null;
      
      if (typeof expertise === "string") {
        try { expertise = JSON.parse(expertise); } catch { /* leave string */ }
      }
      
      if (Array.isArray(expertise)) {
        const certEntry = expertise.find(e => typeof e === 'string' && e.startsWith('CERTIFICATE_URL_'));
        if (certEntry) {
           certUrl = certEntry.replace('CERTIFICATE_URL_', '');
           expertise = expertise.filter(e => e !== certEntry);
        }
        expertise = expertise.join(", ");
      }

      return {
        id: plainU.id,
        name: plainU.name,
        email: plainU.email,
        expertise: expertise || null,
        experience: m.yearsOfExperience || null,
        bio: m.bio || null,
        linkedin: m.linkedinUrl || null,
        certificateUrl: certUrl || null,
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

// --- Advanced User Actions ---

const { AdminLog, Payment, Appointment, Report, Review, MentorCommendation } = require('../models');

exports.suspendUser = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.accountStatus = "suspended";
    await user.save();

    await AdminLog.create({
      adminId,
      action: "SUSPEND_USER",
      targetId: id.toString(),
      details: reason || "No reason provided"
    });

    res.json({ message: "User suspended successfully", user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.banUser = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.accountStatus = "banned";
    await user.save();

    await AdminLog.create({
      adminId,
      action: "BAN_USER",
      targetId: id.toString(),
      details: reason || "No reason provided"
    });

    res.json({ message: "User banned successfully", user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.warnUser = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { message } = req.body;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await AdminLog.create({
      adminId,
      action: "WARN_USER",
      targetId: id.toString(),
      details: message
    });

    // In a real application, trigger an email or in-app notification to the user here.

    res.json({ message: "User warned successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getUserActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const sessions = await Appointment.findAll({
      where: user.userType === 'mentor' ? { mentorId: id } : { menteeId: id },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const payments = await Payment.findAll({
      where: { userId: id },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const reportsAgainst = await Report.findAll({
      where: { reportedUserId: id },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      sessions,
      payments,
      reportsAgainst
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getReviewsForAdmin = async (req, res) => {
  try {
    const reviews = await Review.findAll({
      include: [
        {
          model: Appointment,
          as: "appointment",
          attributes: ["date", "startTime", "endTime", "sessionType"]
        },
        {
          model: Mentor,
          as: "mentor",
          include: [{ model: User, as: "user", attributes: ["name", "picture"] }]
        },
        {
          model: Mentee,
          as: "mentee",
          include: [{ model: User, as: "user", attributes: ["name", "picture"] }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });
    res.json({ reviews });
  } catch (error) {
    console.error("Error fetching admin reviews:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getCommendationsForAdmin = async (req, res) => {
  try {
    const commendations = await MentorCommendation.findAll({
      include: [
        {
          model: Appointment,
          as: "appointment",
          attributes: ["date", "startTime", "endTime", "sessionType"]
        },
        {
          model: Mentor,
          as: "mentor",
          include: [{ model: User, as: "user", attributes: ["name", "picture"] }]
        },
        {
          model: Mentee,
          as: "mentee",
          include: [{ model: User, as: "user", attributes: ["name", "picture"] }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });
    res.json({ commendations });
  } catch (error) {
    console.error("Error fetching admin commendations:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getDisputedSessions = async (req, res) => {
  try {
    const disputes = await Appointment.findAll({
      where: { status: "under_review" },
      include: [
        {
          model: Mentor,
          as: "mentor",
          include: [{ model: User, as: "user", attributes: ["id", "name", "picture", "email"] }]
        },
        {
          model: Mentee,
          as: "mentee",
          include: [{ model: User, as: "user", attributes: ["id", "name", "picture", "email"] }]
        },
        {
          model: Payment,
          as: "payment"
        }
      ],
      order: [["updatedAt", "DESC"]]
    });
    res.json({ disputes });
  } catch (error) {
    console.error("Error fetching disputes:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.resolveDispute = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { appointmentId } = req.params;
    const { resolution } = req.body; // 'release_payout' or 'refund_mentee'

    const appointment = await Appointment.findByPk(appointmentId);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    if (appointment.status !== "under_review") {
        return res.status(400).json({ message: "Appointment is not currently under review" });
    }

    const payment = await Payment.findOne({ where: { appointmentId } });

    if (resolution === "release_payout") {
        const Wallet = require("../models/wallet");
        const mentor = await Mentor.findByPk(appointment.mentorId);
        
        appointment.status = "completed";
        appointment.completionMethod = "admin_release";
        await appointment.save();

        if (payment && payment.status === "disputed") {
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

        await AdminLog.create({
            adminId,
            action: "RESOLVE_DISPUTE_RELEASE",
            targetId: appointmentId.toString(),
            details: "Released payout of " + (payment ? payment.amount : 0) + " to mentor."
        });

        return res.json({ message: "Dispute resolved successfully. Payout released to mentor ✅", appointment });
    } else if (resolution === "refund_mentee") {
        appointment.status = "cancelled";
        appointment.completionMethod = "admin_refund";
        await appointment.save();

        if (payment && payment.status === "disputed") {
            payment.status = "refunded";
            await payment.save();

            const mentor = await Mentor.findByPk(appointment.mentorId);
            if (mentor) {
                const mentorWallet = await Wallet.findOne({ where: { userId: mentor.user_id } });
                if (mentorWallet) {
                    mentorWallet.pendingBalance = Math.max(0, mentorWallet.pendingBalance - payment.mentorShare);
                    await mentorWallet.save();
                }
            }

            const admin = await User.findOne({ where: { userType: 'admin' } });
            if (admin) {
                 const adminWallet = await Wallet.findOne({ where: { userId: admin.id } });
                 if (adminWallet) {
                      adminWallet.pendingBalance = Math.max(0, adminWallet.pendingBalance - payment.platformShare);
                      await adminWallet.save();
                 }
            }
        }

        await AdminLog.create({
            adminId,
            action: "RESOLVE_DISPUTE_REFUND",
            targetId: appointmentId.toString(),
            details: "Refunded mentee for payment of " + (payment ? payment.amount : 0)
        });

        return res.json({ message: "Dispute resolved successfully. Mentee refunded ✅", appointment });
    } else {
        return res.status(400).json({ message: "Invalid resolution option. Must be 'release_payout' or 'refund_mentee'" });
    }
  } catch (error) {
    console.error("Error resolving dispute:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// --- Get all activities with advanced search and filters
exports.getActivities = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = "", 
      type = "ALL", 
      status = "ALL", 
      dateRange = "ALL", 
      startDate, 
      endDate, 
      sort = "newest" 
    } = req.query;

    const { Op } = require("sequelize");
    const Activity = require("../models/activity");

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // 1. Activity Type Filter
    if (type && type !== "ALL") {
      const typeMapping = {
        "BOOKINGS": "BOOKING",
        "BOOKING": "BOOKING",
        "PAYMENTS": "PAYMENT",
        "PAYMENT": "PAYMENT",
        "SESSIONS": "SESSION",
        "SESSION": "SESSION",
        "USERS": "USER",
        "USER": "USER",
        "SYSTEM": "SYSTEM"
      };
      const enumType = typeMapping[type.toUpperCase()];
      if (enumType) {
        whereClause.type = enumType;
      }
    }

    // 2. Status Filter
    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    // 3. Date Range Filter
    if (dateRange && dateRange !== "ALL") {
      const now = new Date();
      if (dateRange === "today") {
        const todayStart = new Date(now.setHours(0,0,0,0));
        whereClause.createdAt = { [Op.gte]: todayStart };
      } else if (dateRange === "last 7 days") {
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
        whereClause.createdAt = { [Op.gte]: sevenDaysAgo };
      } else if (dateRange === "last 30 days") {
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
        whereClause.createdAt = { [Op.gte]: thirtyDaysAgo };
      } else if (dateRange === "custom" && startDate) {
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : new Date();
        whereClause.createdAt = { [Op.between]: [start, end] };
      }
    }

    // 4. Search and association
    const userSearchInclude = {
      model: User,
      as: "user",
      attributes: ["id", "name", "email", "userType", "picture"]
    };

    if (search && search.trim() !== "") {
      const searchPattern = `%${search.trim()}%`;
      
      whereClause[Op.or] = [
        { message: { [Op.like]: searchPattern } },
        { type: { [Op.like]: searchPattern } },
        { '$user.name$': { [Op.like]: searchPattern } },
        { '$user.email$': { [Op.like]: searchPattern } }
      ];
    }

    const order = sort === "oldest" ? [["createdAt", "ASC"]] : [["createdAt", "DESC"]];

    const { count, rows } = await Activity.findAndCountAll({
      where: whereClause,
      include: [userSearchInclude],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: order
    });

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error("Error in getActivities:", error);
    res.status(500).json({ success: false, message: "Failed to fetch activities", error: error.message });
  }
};

// --- Get latest 10-20 activities for quick dashboard widget
exports.getRecentActivities = async (req, res) => {
  try {
    const Activity = require("../models/activity");
    const activities = await Activity.findAll({
      limit: 20,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "userType", "picture"]
        }
      ]
    });
    return res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error("Error in getRecentActivities:", error);
    res.status(500).json({ success: false, message: "Failed to fetch recent activities", error: error.message });
  }
};

