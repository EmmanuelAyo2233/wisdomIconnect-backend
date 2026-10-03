const {respondError,text} = require('../utils/security');
const kycService = require('../services/kycService');
const Mentor = require("../models/mentor");
const MentorKyc = require("../models/mentorKyc");
const User = require("../models/user");
const { logActivity } = require("../services/activityLogger");
const notificationService = require("../services/notificationService");
const path = require("path");
const { cloudinary } = require("../utils/cloudinary");
const streamifier = require("streamifier");

const uploadBufferToCloudinary = (fileBuffer, folder = "kyc_documents") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto", type: "authenticated" },
      (err, result) => {
        if (err) return reject(err);
        resolve(JSON.stringify({publicId:result.public_id,resourceType:result.resource_type,format:result.format}));
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

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

    require("../utils/uploadValidation").validateFile(files.id_document[0]);
    require("../utils/uploadValidation").validateFile(files.selfie[0],true);
    // Stream upload directly to Cloudinary from memory buffer
    const [idDocumentUrl, selfieUrl] = await Promise.all([
      uploadBufferToCloudinary(files.id_document[0].buffer, "kyc_documents/id_documents"),
      uploadBufferToCloudinary(files.selfie[0].buffer, "kyc_documents/selfies"),
    ]);

    await kycService.submit(req.user,{id_type,id_document_url:idDocumentUrl,selfie_url:selfieUrl,phone_number:phone_number ? text(phone_number,'Phone number',30):null});

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
      }).catch(error=>require('../utils/logger').error('KYC notification failed',error));
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
    require('../utils/logger').error("❌ KYC submission error:", error);
    return res.status(500).json({ status: "error", message: "Failed to submit KYC ❌",});
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
        kyc: mentor.kyc ? {status:mentor.kyc.status,id_type:mentor.kyc.id_type,createdAt:mentor.kyc.createdAt} : null,
      },
    });
  } catch (error) {
    require('../utils/logger').error("❌ Get KYC status error:", error);
    return res.status(500).json({ status: "error", message: "Failed to get KYC status ❌",});
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
    require('../utils/logger').error("❌ Get all KYC submissions error:", error);
    return res.status(500).json({ status: "error", message: "Failed to fetch KYC submissions ❌",});
  }
};

// =========================================================
// 🛡️ ADMIN: Review KYC (Approve / Reject)
// =========================================================
exports.reviewKyc = async (req,res) => {
  try {
    const {kyc,mentor}=await kycService.review(req.user,req.params.id,req.body.action,req.body.admin_note);
    notificationService.sendNotification({receiverId:mentor.id,receiverType:'mentor',type:'system',title:kyc.status==='verified'?'KYC verified':'KYC rejected',message:kyc.status==='verified'?'Your identity has been verified.':'Please review the KYC feedback and resubmit your documents.',link:'/mentor/kyc'}).catch(error=>require('../utils/logger').error('KYC notification failed',error));
    res.json({status:'success',message:'KYC review recorded'});
  } catch(error) {respondError(res,error);}
};

exports.getDocument = async (req,res) => {
 try {
  if(req.user.userType !== 'admin') return res.sendStatus(403);
  const kyc = await MentorKyc.findByPk(req.params.id);
  if(!kyc || !['id_document_url','selfie_url'].includes(req.params.field)) return res.sendStatus(404);
  let asset; try {asset=JSON.parse(kyc[req.params.field]);} catch {return res.status(409).json({message:'Legacy document requires secure storage migration'});}
  const url=cloudinary.utils.private_download_url(asset.publicId,asset.format,{resource_type:asset.resourceType,type:'authenticated',expires_at:Math.floor(Date.now()/1000)+300});
  res.set('Cache-Control','no-store').json({url});
 } catch {res.status(500).json({message:'Document retrieval failed'});}
};
