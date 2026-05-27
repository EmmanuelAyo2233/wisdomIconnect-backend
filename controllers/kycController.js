const Mentor = require("../models/mentor");
const MentorKyc = require("../models/mentorKyc");
const User = require("../models/user");
const { logActivity } = require("../services/activityLogger");
const notificationService = require("../services/notificationService");
const path = require("path");
const fs = require("fs");

// =========================================================
// 🧑‍💼 MENTOR: Submit KYC Documents
// =========================================================
exports.submitKyc = async (req, res) => {
  try {
    const mentorUserId = req.user.id;
    const mentor = await Mentor.findOne({ where: { user_id: mentorUserId } });
    if (!mentor) return res.status(404).json({ status: "fail", message: "Mentor profile not found ❌" });

    // Already verified — nothing to re-submit
    if (mentor.kyc_status === "verified") {
      return res.status(400).json({ status: "fail", message: "Your KYC is already verified ✅" });
    }

    // Already pending — prevent spamming
    if (mentor.kyc_status === "pending") {
      return res.status(400).json({ status: "fail", message: "Your KYC submission is already under review. Please wait for admin approval ⏳" });
    }

    const { id_type, phone_number } = req.body;

    if (!id_type) {
      return res.status(400).json({ status: "fail", message: "Please select an ID type ❌" });
    }

    const validIdTypes = ["national_id", "drivers_license", "international_passport", "voters_card"];
    if (!validIdTypes.includes(id_type)) {
      return res.status(400).json({ status: "fail", message: "Invalid ID type ❌" });
    }

    // Validate uploaded files
    const files = req.files;
    if (!files || !files.id_document || !files.selfie) {
      return res.status(400).json({ status: "fail", message: "Both ID document and selfie photo are required ❌" });
    }

    const idDocumentUrl = `/uploads/kyc/${files.id_document[0].filename}`;
    const selfieUrl = `/uploads/kyc/${files.selfie[0].filename}`;

    // Remove old pending KYC if rejected and re-submitting
    await MentorKyc.destroy({ where: { mentorId: mentor.id } });

    // Create new KYC submission
    await MentorKyc.create({
      mentorId: mentor.id,
      id_type,
      id_document_url: idDocumentUrl,
      selfie_url: selfieUrl,
      phone_number: phone_number || null,
      status: "pending",
    });

    // Update mentor kyc_status to pending
    mentor.kyc_status = "pending";
    await mentor.save();

    // Notify admin(s)
    const adminUser = await User.findOne({ where: { userType: "admin" } });
    if (adminUser) {
      notificationService.sendNotification({
        receiverId: adminUser.id,
        receiverType: "admin",
        type: "system",
        title: "New KYC Submission",
        message: `Mentor ${req.user.name} has submitted their KYC documents for review.`,
        emailData: null,
      }).catch(console.error);
    }

    logActivity({
      type: "USER",
      message: `Mentor ${req.user.name} submitted KYC documents for review`,
      userId: req.user.id,
      status: "success",
      metadata: { mentorId: mentor.id, id_type },
    });

    return res.status(201).json({
      status: "success",
      message: "KYC documents submitted successfully! We'll review them within 24–48 hours ✅",
    });
  } catch (error) {
    console.error("❌ KYC submission error:", error);
    return res.status(500).json({ status: "error", message: "Failed to submit KYC ❌", error: error.message });
  }
};

// =========================================================
// 🧑‍💼 MENTOR: Get My KYC Status
// =========================================================
exports.getMyKycStatus = async (req, res) => {
  try {
    const mentorUserId = req.user.id;
    const mentor = await Mentor.findOne({
      where: { user_id: mentorUserId },
      include: [{ model: MentorKyc, as: "kyc" }],
    });

    if (!mentor) return res.status(404).json({ status: "fail", message: "Mentor not found ❌" });

    return res.status(200).json({
      status: "success",
      data: {
        kyc_status: mentor.kyc_status,
        kyc_rejection_reason: mentor.kyc_rejection_reason || null,
        kyc: mentor.kyc || null,
      },
    });
  } catch (error) {
    console.error("❌ Get KYC status error:", error);
    return res.status(500).json({ status: "error", message: "Failed to get KYC status ❌", error: error.message });
  }
};

// =========================================================
// 🛡️ ADMIN: Get All Pending KYC Submissions
// =========================================================
exports.getAllKycSubmissions = async (req, res) => {
  try {
    const { status } = req.query; // optional filter: pending | verified | rejected

    const whereClause = status ? { status } : {};

    const submissions = await MentorKyc.findAll({
      where: whereClause,
      include: [
        {
          model: Mentor,
          as: "mentor",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "name", "email", "picture", "mentorLevel"],
            },
          ],
          attributes: ["id", "user_id", "kyc_status", "kyc_rejection_reason", "role", "expertise"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      status: "success",
      count: submissions.length,
      data: submissions,
    });
  } catch (error) {
    console.error("❌ Get all KYC submissions error:", error);
    return res.status(500).json({ status: "error", message: "Failed to fetch KYC submissions ❌", error: error.message });
  }
};

// =========================================================
// 🛡️ ADMIN: Review KYC (Approve / Reject)
// =========================================================
exports.reviewKyc = async (req, res) => {
  try {
    const { id } = req.params; // KYC record ID
    const { action, admin_note } = req.body; // action: 'approve' | 'reject'

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ status: "fail", message: "Action must be 'approve' or 'reject' ❌" });
    }

    const kyc = await MentorKyc.findByPk(id, {
      include: [
        {
          model: Mentor,
          as: "mentor",
          include: [{ model: User, as: "user", attributes: ["id", "name", "email"] }],
        },
      ],
    });

    if (!kyc) return res.status(404).json({ status: "fail", message: "KYC submission not found ❌" });
    if (kyc.status !== "pending") {
      return res.status(400).json({ status: "fail", message: `This KYC has already been ${kyc.status} ❌` });
    }

    const mentor = kyc.mentor;
    const mentorUser = mentor?.user;

    if (action === "approve") {
      kyc.status = "verified";
      kyc.admin_note = admin_note || "Verified by admin";
      kyc.reviewed_by = req.user.id;
      kyc.reviewed_at = new Date();
      await kyc.save();

      mentor.kyc_status = "verified";
      mentor.kyc_rejection_reason = null;
      await mentor.save();

      // Notify mentor
      if (mentorUser) {
        notificationService.sendNotification({
          receiverId: mentor.id,
          receiverType: "mentor",
          type: "system",
          title: "✅ KYC Verified!",
          message: "Congratulations! Your identity has been verified. You can now create paid sessions and withdraw your earnings.",
          emailData: {
            to: mentorUser.email,
            html: `<p>Hi ${mentorUser.name},</p>
                   <p>Your KYC verification has been <strong>approved</strong>! 🎉</p>
                   <p>You can now:</p>
                   <ul>
                     <li>Create paid mentorship sessions</li>
                     <li>Withdraw your earnings</li>
                   </ul>
                   <p>Thank you for verifying your identity on WizdomBridge.</p>`
          },
        }).catch(console.error);
      }

      logActivity({
        type: "USER",
        message: `Admin approved KYC for Mentor ID ${mentor.id} (${mentorUser?.name})`,
        userId: req.user.id,
        status: "success",
        metadata: { mentorId: mentor.id, kycId: kyc.id },
      });

      return res.status(200).json({ status: "success", message: `KYC for ${mentorUser?.name} approved ✅` });
    } else {
      // reject
      if (!admin_note) {
        return res.status(400).json({ status: "fail", message: "Please provide a rejection reason for the mentor ❌" });
      }

      kyc.status = "rejected";
      kyc.admin_note = admin_note;
      kyc.reviewed_by = req.user.id;
      kyc.reviewed_at = new Date();
      await kyc.save();

      mentor.kyc_status = "rejected";
      mentor.kyc_rejection_reason = admin_note;
      await mentor.save();

      // Notify mentor
      if (mentorUser) {
        notificationService.sendNotification({
          receiverId: mentor.id,
          receiverType: "mentor",
          type: "system",
          title: "❌ KYC Rejected",
          message: `Your KYC submission was rejected. Reason: ${admin_note}. Please re-submit with the correct documents.`,
          emailData: {
            to: mentorUser.email,
            html: `<p>Hi ${mentorUser.name},</p>
                   <p>Unfortunately, your KYC submission was <strong>rejected</strong>.</p>
                   <p><strong>Reason:</strong> ${admin_note}</p>
                   <p>Please log in and re-submit your KYC with the correct documents.</p>`,
          },
        }).catch(console.error);
      }

      logActivity({
        type: "USER",
        message: `Admin rejected KYC for Mentor ID ${mentor.id} (${mentorUser?.name}). Reason: ${admin_note}`,
        userId: req.user.id,
        status: "failed",
        metadata: { mentorId: mentor.id, kycId: kyc.id, reason: admin_note },
      });

      return res.status(200).json({ status: "success", message: `KYC for ${mentorUser?.name} rejected ❌` });
    }
  } catch (error) {
    console.error("❌ Review KYC error:", error);
    return res.status(500).json({ status: "error", message: "Failed to review KYC ❌", error: error.message });
  }
};
