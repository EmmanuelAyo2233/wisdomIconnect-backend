const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authentication, restrictTo } = require("../controllers/authcontrollers");
const {
  submitKyc,
  getMyKycStatus,
  getAllKycSubmissions,
  reviewKyc,
} = require("../controllers/kycController");

// ─── Multer Storage Config ──────────────────────────────────────────────────
const kycUploadDir = path.join(__dirname, "../uploads/kyc");
if (!fs.existsSync(kycUploadDir)) {
  fs.mkdirSync(kycUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, kycUploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype) || file.mimetype === "application/pdf";
  if (extOk && mimeOk) return cb(null, true);
  cb(new Error("Only JPEG, PNG, and PDF files are accepted for KYC uploads ❌"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

const kycUpload = upload.fields([
  { name: "id_document", maxCount: 1 },
  { name: "selfie", maxCount: 1 },
]);

// ─── Apply Auth to All Routes ────────────────────────────────────────────────
router.use(authentication);

// ─── Mentor Routes ───────────────────────────────────────────────────────────
router.post("/submit", restrictTo("mentor"), kycUpload, submitKyc);
router.get("/status", restrictTo("mentor"), getMyKycStatus);

// ─── Admin Routes ────────────────────────────────────────────────────────────
router.get("/admin/all", restrictTo("admin"), getAllKycSubmissions);
router.patch("/admin/:id/review", restrictTo("admin"), reviewKyc);

module.exports = router;
