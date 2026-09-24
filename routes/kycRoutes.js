const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { authentication, restrictTo } = require("../controllers/authcontrollers");
const {
  submitKyc,
  getMyKycStatus,
  getAllKycSubmissions,
  reviewKyc,
} = require("../controllers/kycController");

// ✅ Rate limiter for KYC submission
const { kycLimiter } = require("../config/rateLimiter");

// ─── Multer Config (Memory Storage → Cloudinary) ─────────────────────────────
// Files are kept in memory (Buffer) and streamed to Cloudinary in the controller.
// No local filesystem writes — safe for Railway/Render deployments.

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype) || file.mimetype === "application/pdf";
  if (extOk && mimeOk) return cb(null, true);
  cb(new Error("Only JPEG, PNG, and PDF files are accepted for KYC uploads ❌"));
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

const kycUpload = upload.fields([
  { name: "id_document", maxCount: 1 },
  { name: "selfie", maxCount: 1 },
]);

// ─── Apply Auth to All Routes ─────────────────────────────────────────────────
router.use(authentication);

// ─── Mentor Routes ─────────────────────────────────────────────────────────────
router.post("/submit", restrictTo("mentor"), kycLimiter, kycUpload, submitKyc);
router.get("/status", restrictTo("mentor"), getMyKycStatus);

// ─── Admin Routes ──────────────────────────────────────────────────────────────
router.get("/admin/all", restrictTo("admin"), getAllKycSubmissions);
router.patch("/admin/:id/review", restrictTo("admin"), reviewKyc);

module.exports = router;
