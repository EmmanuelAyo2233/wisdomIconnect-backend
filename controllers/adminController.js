const adminAccounts = require('../services/adminAccountService');
const { HttpError, respondError } = require('../utils/security');
// controllers/adminController.js
const { User, Mentor, Mentee, Appointment, AdminLog, Payment, Report, Review, MentorCommendation, Wallet } = require("../models");
const notificationService = require("../services/notificationService");

// --- Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { count, rows: users } = await User.findAndCountAll({
      order: [["createdAt", "DESC"]],
      limit,
      offset,
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

    res.json({
      users: rows,
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error",});
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
    require('../utils/logger').error("Error fetching stats:", error);
    res.status(500).json({ message: "Error fetching stats",});
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
    require('../utils/logger').error("Error fetching pending mentors:", error);
    res.status(500).json({ message: "Server error",});
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
//     require('../utils/logger').error("Error approving mentor:", error);
//     res.status(500).json({ message: "Error approving mentor",});
//   }
// };

// --- Reject mentor: convert to mentee
// Approve Mentor
exports.approveMentor = async (req,res) => {
  try { const user=await adminAccounts.change(req.user,req.params.id,"approve",req.body?.reason || "");
    notificationService.sendMentorApprovalNotification(user).catch(error=>require('../utils/logger').error('Approval notification failed',error));
    res.json({message:"Mentor approved",user,mentor:user});
  } catch(error) {respondError(res,error);}
};
// Reject Mentor
exports.rejectMentor = async (req,res) => {
  try { const user=await adminAccounts.change(req.user,req.params.id,"reject",req.body?.reason || "");
    res.json({message:"Mentor application rejected; retained as a mentee account",user,mentor:user});
  } catch(error) {respondError(res,error);}
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
    require('../utils/logger').error("Error fetching approved mentors:", error);
    res.status(500).json({ message: "Server error",});
  }
};




exports.deleteMentor = async (req,res) => {
  try { const user=await adminAccounts.change(req.user,req.params.id,"deactivate_mentor",req.body?.reason || "");
    res.json({message:"Mentor deactivated; history retained",user,mentor:user});
  } catch(error) {respondError(res,error);}
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
    require('../utils/logger').error("Error fetching rejected mentors:", error);
    res.status(500).json({ message: "Server error",});
  }
};


exports.reconsiderMentor = async (req,res) => {
  try { const user=await adminAccounts.change(req.user,req.params.id,"reconsider",req.body?.reason || "");
    res.json({message:"Mentor moved to pending",user,mentor:user});
  } catch(error) {respondError(res,error);}
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
    require('../utils/logger').error("Error fetching mentees:", err);
    res.status(500).json({ message: "Server error",});
  }
};



// Delete mentee
exports.deleteMentee = async (req,res) => {
  try { const user=await adminAccounts.change(req.user,req.params.id,"deactivate_mentee",req.body?.reason || "");
    res.json({message:"Mentee deactivated; history retained",user,mentor:user});
  } catch(error) {respondError(res,error);}
};
// --- Advanced User Actions ---

exports.suspendUser = async (req,res) => {
  try { const user=await adminAccounts.change(req.user,req.params.id,"suspend",req.body?.reason || "");
    res.json({message:"User suspended",user,mentor:user});
  } catch(error) {respondError(res,error);}
};
exports.banUser = async (req,res) => {
  try { const user=await adminAccounts.change(req.user,req.params.id,"ban",req.body?.reason || "");
    res.json({message:"User banned",user,mentor:user});
  } catch(error) {respondError(res,error);}
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
    res.status(500).json({ message: "Server error",});
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
    res.status(500).json({ message: "Server error",});
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
    require('../utils/logger').error("Error fetching admin reviews:", error);
    res.status(500).json({ message: "Server error",});
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
    require('../utils/logger').error("Error fetching admin commendations:", error);
    res.status(500).json({ message: "Server error",});
  }
};

// ✅ NEW: Hide a review from profile display
exports.hideReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findByPk(reviewId);
    if (!review) return res.status(404).json({ status: "fail", message: "Review not found" });
    
    review.isHidden = true;
    await review.save();
    
    await AdminLog.create({
      adminId: req.user.id,
      action: "HIDE_REVIEW",
      targetId: reviewId.toString(),
      details: `Hidden review for appointment ${review.appointmentId}`
    });
    
    res.json({ status: "success", message: "Review hidden successfully ✅" });
  } catch (error) {
    require('../utils/logger').error("Error hiding review:", error);
    res.status(500).json({ status: "error", message: "Failed to hide review" });
  }
};

// ✅ NEW: Unhide a review
exports.unhideReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findByPk(reviewId);
    if (!review) return res.status(404).json({ status: "fail", message: "Review not found" });
    
    review.isHidden = false;
    await review.save();
    
    await AdminLog.create({
      adminId: req.user.id,
      action: "UNHIDE_REVIEW",
      targetId: reviewId.toString(),
      details: `Unhidden review for appointment ${review.appointmentId}`
    });
    
    res.json({ status: "success", message: "Review unhidden successfully ✅" });
  } catch (error) {
    require('../utils/logger').error("Error unhiding review:", error);
    res.status(500).json({ status: "error", message: "Failed to unhide review" });
  }
};

// ✅ NEW: Hide a commendation from profile display
exports.hideCommendation = async (req, res) => {
  try {
    const { commendationId } = req.params;
    const commendation = await MentorCommendation.findByPk(commendationId);
    if (!commendation) return res.status(404).json({ status: "fail", message: "Commendation not found" });
    
    commendation.isHidden = true;
    await commendation.save();
    
    await AdminLog.create({
      adminId: req.user.id,
      action: "HIDE_COMMENDATION",
      targetId: commendationId.toString(),
      details: `Hidden commendation for appointment ${commendation.appointmentId}`
    });
    
    res.json({ status: "success", message: "Commendation hidden successfully ✅" });
  } catch (error) {
    require('../utils/logger').error("Error hiding commendation:", error);
    res.status(500).json({ status: "error", message: "Failed to hide commendation" });
  }
};

// ✅ NEW: Unhide a commendation
exports.unhideCommendation = async (req, res) => {
  try {
    const { commendationId } = req.params;
    const commendation = await MentorCommendation.findByPk(commendationId);
    if (!commendation) return res.status(404).json({ status: "fail", message: "Commendation not found" });
    
    commendation.isHidden = false;
    await commendation.save();
    
    await AdminLog.create({
      adminId: req.user.id,
      action: "UNHIDE_COMMENDATION",
      targetId: commendationId.toString(),
      details: `Unhidden commendation for appointment ${commendation.appointmentId}`
    });
    
    res.json({ status: "success", message: "Commendation unhidden successfully ✅" });
  } catch (error) {
    require('../utils/logger').error("Error unhiding commendation:", error);
    res.status(500).json({ status: "error", message: "Failed to unhide commendation" });
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
    require('../utils/logger').error("Error fetching disputes:", error);
    res.status(500).json({ message: "Server error",});
  }
};

exports.resolveDispute = async (req, res) => {
  try { if(req.user.userType !== 'admin') throw new HttpError(403,'Admin required'); const finance = require('../services/financeService'); if(req.body.resolution === 'release_payout') await finance.release(req.params.appointmentId,req.user,true); else if(req.body.resolution === 'refund_mentee') await finance.requestRefund(req.params.appointmentId,req.user,'Admin dispute resolution',true); else throw new HttpError(400,'Invalid resolution'); res.json({success:true,message:'Resolution recorded; refunds await provider confirmation'}); } catch (error) { respondError(res, error); }
};

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
    require('../utils/logger').error("Error in getActivities:", error);
    res.status(500).json({ success: false, message: "Failed to fetch activities",});
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
    require('../utils/logger').error("Error in getRecentActivities:", error);
    res.status(500).json({ success: false, message: "Failed to fetch recent activities",});
  }
};
// ---------------------------------------------------------------
// 🔧 Sync Mentor Levels — fixes mentors stuck on "starter"
//    due to stale sessionsCompleted field
// POST /api/admin/sync-mentor-levels
// ---------------------------------------------------------------
exports.syncMentorLevels = async (req, res) => {
  try {
    const mentors = await Mentor.findAll({ include: ["user"] });
    let updated = 0;
    const results = [];

    for (const mentor of mentors) {
      if (!mentor.user) continue;

      const realCount = await Appointment.count({
        where: { mentorId: mentor.id, status: "completed" }
      });

      const allReviews = await Review.findAll({
        where: { mentorId: mentor.id, isHidden: false }
      });
      const avgRating = allReviews.length > 0
        ? Number((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(1))
        : (mentor.user.rating || 0);

      // Determine correct level — never downgrade from gold
      let correctLevel = mentor.user.mentorLevel;
      if (realCount >= 50 && avgRating >= 4.5) {
        correctLevel = "gold";
      } else if (realCount >= 10 && avgRating >= 4.0) {
        if (correctLevel !== "gold") correctLevel = "verified";
      }
      // No else: keep current level, don't reset to starter

      const oldSessions = mentor.user.sessionsCompleted;
      const oldLevel = mentor.user.mentorLevel;

      mentor.user.sessionsCompleted = realCount;
      mentor.user.rating = avgRating;
      mentor.user.mentorLevel = correctLevel;
      await mentor.user.save();
      updated++;

      results.push({
        mentorId: mentor.id,
        name: mentor.user.name,
        sessionsCompleted: { before: oldSessions, after: realCount },
        rating: avgRating,
        mentorLevel: { before: oldLevel, after: correctLevel },
      });
    }

    return res.json({
      success: true,
      message: `✅ Synced ${updated} mentors`,
      results,
    });
  } catch (error) {
    require('../utils/logger').error("Error in syncMentorLevels:", error);
    res.status(500).json({ success: false, message: "Sync failed",});
  }
};

